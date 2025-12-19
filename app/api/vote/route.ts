// app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

/* =========================
   Helper — syncParticipant
========================= */
async function syncParticipant(participant_id: string) {
  try {
    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id")
      .eq("id", participant_id)
      .maybeSingle();

    if (!existingParticipant) {
      await supabase.from("participants").insert({
        id: participant_id,
      });
    } else {
      await supabase
        .from("participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", participant_id);
    }
  } catch (e) {
    console.error("Erro ao sincronizar participante:", e);
    // não bloqueia o voto
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      poll_id,
      option_id,
      option_ids,
      user_hash,
      participant_id,
    } = body as {
      poll_id?: string;
      option_id?: string;
      option_ids?: string[];
      user_hash?: string;
      participant_id?: string;
    };

    if (!poll_id || !user_hash || !participant_id) {
      return NextResponse.json(
        {
          error: "missing_data",
          message: "poll_id, user_hash e participant_id são obrigatórios",
        },
        { status: 400 }
      );
    }

    /* =========================
       POLL CONFIG
    ========================= */
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple, vote_cooldown_seconds, voting_type, status")
      .eq("id", poll_id)
      .single();

    if (pollError || !poll) {
      return NextResponse.json(
        { error: "poll_not_found" },
        { status: 404 }
      );
    }

    if (poll.status !== "open") {
      return NextResponse.json(
        { error: "poll_not_open" },
        { status: 403 }
      );
    }

    const allowMultiple = Boolean(poll.allow_multiple);
    const cooldownSeconds = poll.vote_cooldown_seconds ?? 0;
    const votingType = poll.voting_type ?? "single";

    /* =========================
       RANKING (V1 — PRESERVADO)
    ========================= */
    if (Array.isArray(option_ids) && votingType === "ranking") {
      if (option_ids.length === 0) {
        return NextResponse.json(
          { error: "invalid_data" },
          { status: 400 }
        );
      }

      if (cooldownSeconds > 0) {
        const { data: lastVote } = await supabase
          .from("votes")
          .select("created_at")
          .eq("poll_id", poll_id)
          .eq("user_hash", user_hash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastVote) {
          const cooldownEnd =
            new Date(lastVote.created_at).getTime() +
            cooldownSeconds * 1000;

          if (Date.now() < cooldownEnd) {
            const remainingSeconds = Math.ceil(
              (cooldownEnd - Date.now()) / 1000
            );

            return NextResponse.json(
              {
                error: "cooldown_active",
                remaining_seconds: remainingSeconds,
              },
              { status: 429 }
            );
          }
        }
      }

      // syncParticipant somente após validações
      await syncParticipant(participant_id);

      if (!allowMultiple) {
        const { data: previousVotes } = await supabase
          .from("votes")
          .select("id")
          .eq("poll_id", poll_id)
          .eq("user_hash", user_hash);

        if (previousVotes && previousVotes.length > 0) {
          const ids = previousVotes.map(v => v.id);
          await supabase.from("vote_rankings").delete().in("vote_id", ids);
          await supabase.from("votes").delete().in("id", ids);
        }
      }

      const voteId = randomUUID();

      await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        user_hash,
        participant_id,
      });

      const rows = option_ids.map((optId, idx) => ({
        id: randomUUID(),
        vote_id: voteId,
        option_id: optId,
        ranking: idx + 1,
      }));

      await supabase.from("vote_rankings").insert(rows);

      return NextResponse.json({ success: true });
    }

    /* =========================
       MULTIPLE (NOVO — ISOLADO)
    ========================= */
    if (Array.isArray(option_ids) && votingType === "multiple") {
      if (option_ids.length === 0) {
        return NextResponse.json(
          { error: "invalid_data" },
          { status: 400 }
        );
      }

      const uniqueOptionIds = Array.from(new Set(option_ids));

      if (cooldownSeconds > 0) {
        const { data: lastVote } = await supabase
          .from("votes")
          .select("created_at")
          .eq("poll_id", poll_id)
          .eq("user_hash", user_hash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastVote) {
          const cooldownEnd =
            new Date(lastVote.created_at).getTime() +
            cooldownSeconds * 1000;

          if (Date.now() < cooldownEnd) {
            const remainingSeconds = Math.ceil(
              (cooldownEnd - Date.now()) / 1000
            );

            return NextResponse.json(
              {
                error: "cooldown_active",
                remaining_seconds: remainingSeconds,
              },
              { status: 429 }
            );
          }
        }
      }

      // syncParticipant somente após validações
      await syncParticipant(participant_id);

      const voteId = randomUUID();

      await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        user_hash,
        participant_id,
      });

      const rows = uniqueOptionIds.map(optId => ({
        vote_id: voteId,
        option_id: optId,
      }));

      await supabase.from("vote_options").insert(rows);

      return NextResponse.json({
        success: true,
        inserted: uniqueOptionIds.length,
      });
    }

    /* =========================
       SINGLE (V1 — PRESERVADO)
    ========================= */
    if (!option_id) {
      return NextResponse.json(
        { error: "missing_option" },
        { status: 400 }
      );
    }

    if (!allowMultiple) {
      const { data: existing } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .maybeSingle();

      // syncParticipant somente antes da escrita
      await syncParticipant(participant_id);

      if (existing) {
        await supabase
          .from("votes")
          .update({
            option_id,
            participant_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        return NextResponse.json({ success: true, updated: true });
      }

      await supabase.from("votes").insert({
        id: randomUUID(),
        poll_id,
        option_id,
        user_hash,
        participant_id,
        votes_count: 1,
      });

      return NextResponse.json({ success: true });
    }

    // SINGLE allowMultiple = true (V1)
    if (cooldownSeconds > 0) {
      const { data: lastVote } = await supabase
        .from("votes")
        .select("created_at")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastVote) {
        const cooldownEnd =
          new Date(lastVote.created_at).getTime() +
          cooldownSeconds * 1000;

        if (Date.now() < cooldownEnd) {
          const remainingSeconds = Math.ceil(
            (cooldownEnd - Date.now()) / 1000
          );

          return NextResponse.json(
            {
              error: "cooldown_active",
              remaining_seconds: remainingSeconds,
            },
            { status: 429 }
          );
        }
      }
    }

    await syncParticipant(participant_id);

    await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      participant_id,
      votes_count: 1,
    });

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
