// app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

/* ======================================================
   Helpers
====================================================== */

async function syncParticipant(participant_id: string) {
  try {
    const { data } = await supabase
      .from("participants")
      .select("id")
      .eq("id", participant_id)
      .maybeSingle();

    if (!data) {
      await supabase.from("participants").insert({ id: participant_id });
    } else {
      await supabase
        .from("participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", participant_id);
    }
  } catch (e) {
    console.error("syncParticipant error:", e);
  }
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function snapshotSingle(option_id: string) {
  return { voting_type: "single", option_id };
}
function snapshotMultiple(option_ids: string[]) {
  return { voting_type: "multiple", option_ids };
}
function snapshotRanking(option_ids: string[]) {
  return { voting_type: "ranking", option_ids };
}

/* ======================================================
   Handler
====================================================== */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      poll_id,
      option_id,
      option_ids,
      participant_id,
      user_hash,
    } = body as any;

    if (!poll_id || !participant_id) {
      return NextResponse.json({ error: "missing_data" }, { status: 400 });
    }

    /* =========================
       Load poll
    ========================= */
    const { data: poll } = await supabase
      .from("polls")
      .select(
        `
        id,
        status,
        voting_type,
        vote_cooldown_seconds,
        max_votes_per_user,
        allow_multiple
      `
      )
      .eq("id", poll_id)
      .single();

    if (!poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    if (poll.status !== "open") {
      return NextResponse.json({ error: "poll_not_open" }, { status: 403 });
    }

    const effectiveMaxVotes =
      poll.max_votes_per_user ??
      (poll.allow_multiple ? Infinity : 1);

    /* =========================
       Cooldown
    ========================= */
    if (poll.vote_cooldown_seconds && poll.vote_cooldown_seconds > 0) {
      const { data: lastVote } = await supabase
        .from("votes")
        .select("created_at, updated_at")
        .eq("poll_id", poll_id)
        .eq("participant_id", participant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastVote) {
        const lastTs = Math.max(
          new Date(lastVote.created_at).getTime(),
          lastVote.updated_at
            ? new Date(lastVote.updated_at).getTime()
            : 0
        );

        const cooldownEnd =
          lastTs + poll.vote_cooldown_seconds * 1000;

        if (Date.now() < cooldownEnd) {
          return NextResponse.json(
            {
              error: "cooldown_active",
              remaining_seconds: Math.ceil(
                (cooldownEnd - Date.now()) / 1000
              ),
            },
            { status: 429 }
          );
        }
      }
    }

    /* =========================
       syncParticipant
    ========================= */
    await syncParticipant(participant_id);

    /* ======================================================
       MODE: VOTO ÚNICO (max_votes_per_user = 1)
    ======================================================= */
    if (effectiveMaxVotes === 1) {
      const { data: existingVote } = await supabase
        .from("votes")
        .select("id, option_id")
        .eq("poll_id", poll_id)
        .eq("participant_id", participant_id)
        .maybeSingle();

      let voteId = existingVote?.id ?? randomUUID();
      let beforeState: any = null;
      let afterState: any = null;
      let isUpdate = Boolean(existingVote);

      /* ---------- SINGLE ---------- */
      if (poll.voting_type === "single") {
        if (!option_id) {
          return NextResponse.json(
            { error: "missing_option" },
            { status: 400 }
          );
        }

        if (existingVote) {
          beforeState = snapshotSingle(existingVote.option_id);
          if (existingVote.option_id === option_id) {
            return NextResponse.json({ success: true, updated: false });
          }

          await supabase
            .from("votes")
            .update({
              option_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", voteId);
        } else {
          await supabase.from("votes").insert({
            id: voteId,
            poll_id,
            option_id,
            participant_id,
            user_hash,
          });
        }

        afterState = snapshotSingle(option_id);
      }

      /* ---------- MULTIPLE ---------- */
      if (poll.voting_type === "multiple") {
        if (!Array.isArray(option_ids) || option_ids.length === 0) {
          return NextResponse.json(
            { error: "invalid_payload" },
            { status: 400 }
          );
        }

        const dedup = Array.from(new Set(option_ids));
        if (dedup.length === 0) {
          return NextResponse.json(
            { error: "invalid_payload" },
            { status: 400 }
          );
        }

        if (existingVote) {
          const { data: prev } = await supabase
            .from("vote_options")
            .select("option_id")
            .eq("vote_id", voteId);

          const prevIds = prev?.map(r => r.option_id) ?? [];
          beforeState = snapshotMultiple(prevIds);

          if (arraysEqual(prevIds.sort(), dedup.sort())) {
            return NextResponse.json({ success: true, updated: false });
          }

          await supabase.from("vote_options").delete().eq("vote_id", voteId);
        } else {
          await supabase.from("votes").insert({
            id: voteId,
            poll_id,
            participant_id,
            user_hash,
          });
        }

        await supabase.from("vote_options").insert(
          dedup.map(opt => ({
            vote_id: voteId,
            option_id: opt,
          }))
        );

        afterState = snapshotMultiple(dedup);
      }

      /* ---------- RANKING ---------- */
      if (poll.voting_type === "ranking") {
        if (!Array.isArray(option_ids) || option_ids.length === 0) {
          return NextResponse.json(
            { error: "invalid_payload" },
            { status: 400 }
          );
        }

        if (new Set(option_ids).size !== option_ids.length) {
          return NextResponse.json(
            { error: "invalid_ranking_duplicate_option" },
            { status: 400 }
          );
        }

        if (existingVote) {
          const { data: prev } = await supabase
            .from("vote_rankings")
            .select("option_id")
            .eq("vote_id", voteId)
            .order("ranking");

          const prevIds = prev?.map(r => r.option_id) ?? [];
          beforeState = snapshotRanking(prevIds);

          if (arraysEqual(prevIds, option_ids)) {
            return NextResponse.json({ success: true, updated: false });
          }

          await supabase.from("vote_rankings").delete().eq("vote_id", voteId);
        } else {
          await supabase.from("votes").insert({
            id: voteId,
            poll_id,
            participant_id,
            user_hash,
          });
        }

        await supabase.from("vote_rankings").insert(
          option_ids.map((opt, idx) => ({
            id: randomUUID(),
            vote_id: voteId,
            option_id: opt,
            ranking: idx + 1,
          }))
        );

        afterState = snapshotRanking(option_ids);
      }

      await supabase.from("vote_events").insert({
        poll_id,
        vote_id: voteId,
        participant_id,
        event_type: isUpdate ? "updated" : "created",
        before_state: beforeState,
        after_state: afterState,
      });

      return NextResponse.json({ success: true, updated: isUpdate });
    }

    /* ======================================================
       MODE: BIG BROTHER (max_votes_per_user > 1)
    ======================================================= */
    const voteId = randomUUID();

    if (poll.voting_type === "single") {
      if (!option_id) {
        return NextResponse.json(
          { error: "missing_option" },
          { status: 400 }
        );
      }

      await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        option_id,
        participant_id,
        user_hash,
      });
    }

    if (poll.voting_type === "multiple") {
      if (!Array.isArray(option_ids) || option_ids.length === 0) {
        return NextResponse.json(
          { error: "invalid_payload" },
          { status: 400 }
        );
      }

      const dedup = Array.from(new Set(option_ids));

      await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        participant_id,
        user_hash,
      });

      await supabase.from("vote_options").insert(
        dedup.map(opt => ({
          vote_id: voteId,
          option_id: opt,
        }))
      );
    }

    if (poll.voting_type === "ranking") {
      if (!Array.isArray(option_ids) || option_ids.length === 0) {
        return NextResponse.json(
          { error: "invalid_payload" },
          { status: 400 }
        );
      }

      if (new Set(option_ids).size !== option_ids.length) {
        return NextResponse.json(
          { error: "invalid_ranking_duplicate_option" },
          { status: 400 }
        );
      }

      await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        participant_id,
        user_hash,
      });

      await supabase.from("vote_rankings").insert(
        option_ids.map((opt, idx) => ({
          id: randomUUID(),
          vote_id: voteId,
          option_id: opt,
          ranking: idx + 1,
        }))
      );
    }

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error("internal_error", e);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
