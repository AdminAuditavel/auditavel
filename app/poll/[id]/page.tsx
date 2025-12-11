// app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, option_id, option_ids, user_hash } = body;

    if (!poll_id || !user_hash || (!option_id && !Array.isArray(option_ids))) {
      return NextResponse.json({ error: "missing_data" }, { status: 400 });
    }

    // Carrega configuração da poll
    const { data: poll, error: pollErr } = await supabase
      .from("polls")
      .select("allow_multiple, voting_type, vote_cooldown_seconds, max_votes_per_user")
      .eq("id", poll_id)
      .single();

    if (pollErr || !poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    const allowMultiple: boolean = Boolean(poll.allow_multiple);
    const votingType: string = poll.voting_type ?? "single";
    const cooldownSeconds: number | null = poll.vote_cooldown_seconds ?? null;
    const maxVotesPerUser: number | null = poll.max_votes_per_user ?? null;

    // --- RANKING PATH ---
    if (votingType === "ranking") {
      // option_ids expected
      const ids: string[] = Array.isArray(option_ids) ? option_ids : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: "missing_option_ids" }, { status: 400 });
      }

      // cooldown check (if configured)
      if (cooldownSeconds) {
        // busca último voto do user nesta poll
        const { data: lastVoteData } = await supabase
          .from("votes")
          .select("created_at")
          .eq("poll_id", poll_id)
          .eq("user_hash", user_hash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastVoteData?.created_at) {
          const lastTs = new Date(lastVoteData.created_at).getTime();
          const now = Date.now();
          const diffSec = Math.floor((now - lastTs) / 1000);
          if (diffSec < cooldownSeconds) {
            return NextResponse.json({
              error: "cooldown_active",
              remaining_seconds: cooldownSeconds - diffSec,
              message: `Você deve esperar ${cooldownSeconds - diffSec} segundo(s) antes de votar novamente.`
            }, { status: 429 });
          }
        }
      }

      // if allowMultiple === false => upsert (single ranking per user)
      if (!allowMultiple) {
        // check existing vote by (poll_id, user_hash)
        const { data: existing, error: existingErr } = await supabase
          .from("votes")
          .select("id")
          .eq("poll_id", poll_id)
          .eq("user_hash", user_hash)
          .maybeSingle();

        if (existingErr) {
          console.error("Erro buscando voto existente (ranking/upsert):", existingErr);
        }

        if (existing && existing.id) {
          // update vote row (option_id = first item for legacy compatibility)
          const { error: updateErr } = await supabase
            .from("votes")
            .update({
              option_id: ids[0] ?? null,
              updated_at: new Date().toISOString()
            })
            .eq("id", existing.id);

          if (updateErr) {
            console.error("Erro ao atualizar vote (ranking):", updateErr);
            return NextResponse.json({ error: "update_failed" }, { status: 500 });
          }

          // delete previous rankings for this vote_id and reinsert new rankings
          const { error: delErr } = await supabase
            .from("vote_rankings")
            .delete()
            .eq("vote_id", existing.id);

          if (delErr) {
            console.error("Erro ao deletar antigos rankings:", delErr);
            // continue anyway
          }

          const rankings = ids.map((optId: string, idx: number) => ({
            id: randomUUID(),
            vote_id: existing.id,
            option_id: optId,
            ranking: idx + 1
          }));

          const { error: insertRankErr } = await supabase
            .from("vote_rankings")
            .insert(rankings);

          if (insertRankErr) {
            console.error("Erro ao inserir vote_rankings (update):", insertRankErr);
            return NextResponse.json({ error: "rankings_insert_failed" }, { status: 500 });
          }

          return NextResponse.json({ success: true, updated: true });
        }

        // no existing -> insert new vote + rankings
        const newVoteId = randomUUID();
        const { error: voteInsErr } = await supabase
          .from("votes")
          .insert({
            id: newVoteId,
            poll_id,
            option_id: ids[0] ?? null,
            user_hash,
            votes_count: 1
          });

        if (voteInsErr) {
          console.error("Erro ao inserir vote (ranking):", voteInsErr);
          return NextResponse.json({ error: "insert_failed" }, { status: 500 });
        }

        const rankings = ids.map((optId: string, idx: number) => ({
          id: randomUUID(),
          vote_id: newVoteId,
          option_id: optId,
          ranking: idx + 1
        }));

        const { error: insertRankErr } = await supabase
          .from("vote_rankings")
          .insert(rankings);

        if (insertRankErr) {
          console.error("Erro ao inserir vote_rankings:", insertRankErr);
          return NextResponse.json({ error: "rankings_insert_failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      // if allowMultiple === true => insert new vote per submission (respect max_votes_per_user)
      if (allowMultiple) {
        if (maxVotesPerUser) {
          // count existing votes by this user for this poll
          const { data: existingVotesCount } = await supabase
            .from("votes")
            .select("id", { count: "exact", head: true })
            .eq("poll_id", poll_id)
            .eq("user_hash", user_hash);

          const count = (existingVotesCount?.count ?? 0) as number;
          if (count >= maxVotesPerUser) {
            return NextResponse.json({ error: "max_votes_exceeded", message: "Número máximo de submissões atingido." }, { status: 403 });
          }
        }

        // insert new vote
        const newVoteId = randomUUID();
        const { error: voteInsErr } = await supabase
          .from("votes")
          .insert({
            id: newVoteId,
            poll_id,
            option_id: ids[0] ?? null,
            user_hash,
            votes_count: 1
          });

        if (voteInsErr) {
          console.error("Erro ao inserir vote (ranking/multiple):", voteInsErr);
          return NextResponse.json({ error: "insert_failed" }, { status: 500 });
        }

        const rankings = ids.map((optId: string, idx: number) => ({
          id: randomUUID(),
          vote_id: newVoteId,
          option_id: optId,
          ranking: idx + 1
        }));

        const { error: insertRankErr } = await supabase
          .from("vote_rankings")
          .insert(rankings);

        if (insertRankErr) {
          console.error("Erro ao inserir vote_rankings (multiple):", insertRankErr);
          return NextResponse.json({ error: "rankings_insert_failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, created: true });
      }
    } // fim ranking

    // --- NON-RANKING PATH (existing behaviour) ---
    // maintain current behaviour for option_id single/multiple votes
    // NOTE: you already have this implemented; keep it (insert or upsert depending on allowMultiple)
    // For safety, handle a basic fallback:
    if (option_id) {
      // (replicate your prior logic here or call existing function)
      // Very simple fallback insert (no cooldown/max checks implemented here)
      const { data: duplicate, error: dupError } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .eq("option_id", option_id)
        .maybeSingle();

      if (dupError) console.error("dup check error:", dupError);
      if (duplicate) {
        return NextResponse.json({ success: true, message: "duplicate_vote_ignored" });
      }
      const { error } = await supabase.from("votes").insert({
        id: randomUUID(),
        poll_id,
        option_id,
        user_hash,
        votes_count: 1
      });

      if (error) {
        console.error("Erro ao inserir voto (fallback):", error);
        return NextResponse.json({ error: "insert_failed" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json({ error: "internal_error", details: String(e) }, { status: 500 });
  }
}
