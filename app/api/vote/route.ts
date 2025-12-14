// app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

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
       PARTICIPANT (V2.1)
    ========================= */
    if (participant_id) {
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
        // NÃO bloqueia o voto
      }
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
      console.error("Erro ao buscar poll:", pollError);
      return NextResponse.json(
        { error: "poll_not_found", details: pollError?.message ?? null },
        { status: 404 }
      );
    }

    const allowMultiple = Boolean(poll.allow_multiple);
    const cooldownSeconds = poll.vote_cooldown_seconds ?? 0;
    const votingType = (poll.voting_type ?? "single") as string;
    const status = poll.status;

    if (status !== "open") {
      return NextResponse.json(
        {
          error: "poll_not_open",
          message: "Esta pesquisa não está aberta para votos",
        },
        { status: 403 }
      );
    }

    /* =========================
       RANKING
    ========================= */
    if (Array.isArray(option_ids)) {
      if (votingType !== "ranking") {
        return NextResponse.json(
          {
            error: "ranking_not_allowed",
            message: "This poll is not configured for ranking votes",
          },
          { status: 400 }
        );
      }

      if (option_ids.length === 0) {
        return NextResponse.json(
          {
            error: "invalid_data",
            message: "option_ids must contain at least one id",
          },
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
                message: `Você deve esperar ${remainingSeconds} segundos antes de votar novamente.`,
                remaining_seconds: remainingSeconds,
              },
              { status: 429 }
            );
          }
        }
      }

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

      const parentVoteId = randomUUID();
      const parentPayload = {
        id: parentVoteId,
        poll_id,
        user_hash,
        participant_id: participant_id ?? null,
      };

      const { data: parentVoteData, error: parentVoteError } = await supabase
        .from("votes")
        .insert(parentPayload)
        .select("id")
        .single();

      if (parentVoteError || !parentVoteData) {
        return NextResponse.json(
          { error: "parent_vote_insert_failed" },
          { status: 500 }
        );
      }

      const voteId = parentVoteData.id;

      const rows = option_ids.map((optId, idx) => ({
        id: randomUUID(),
        vote_id: voteId,
        option_id: optId,
        ranking: idx + 1,
      }));

      const { error: insertRankingError } = await supabase
        .from("vote_rankings")
        .insert(rows);

      if (insertRankingError) {
        await supabase.from("votes").delete().eq("id", voteId);
        return NextResponse.json(
          { error: "insert_failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        vote_id: voteId,
        inserted: rows.length,
      });
    }

    /* =========================
       SINGLE / MULTIPLE
    ========================= */
    if (!option_id) {
      return NextResponse.json(
        {
          error: "missing_option",
          message: "option_id or option_ids must be provided",
        },
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

      if (existing) {
        await supabase
          .from("votes")
          .update({
            option_id,
            participant_id: participant_id ?? null,
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
        participant_id: participant_id ?? null,
        votes_count: 1,
      });

      return NextResponse.json({ success: true });
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
              message: `Você deve esperar ${remainingSeconds} segundos antes de votar novamente.`,
              remaining_seconds: remainingSeconds,
            },
            { status: 429 }
          );
        }
      }
    }

    await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      participant_id: participant_id ?? null,
      votes_count: 1,
    });

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json(
      { error: "internal_error", details: String(e) },
      { status: 500 }
    );
  }
}
