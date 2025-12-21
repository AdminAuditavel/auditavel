// app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

/* ======================================================
   Types
====================================================== */

type OptCheckOk = { ok: true; dedup: string[] };
type OptCheckFail = {
  ok: false;
  error:
    | "invalid_payload"
    | "invalid_option_for_poll"
    | "internal_error";
};
type OptCheck = OptCheckOk | OptCheckFail;

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
  return { voting_type: "single" as const, option_id };
}
function snapshotMultiple(option_ids: string[]) {
  return { voting_type: "multiple" as const, option_ids };
}
function snapshotRanking(option_ids: string[]) {
  return { voting_type: "ranking" as const, option_ids };
}

function normalizeFinitePositiveInt(val: any, fallback: number) {
  const n = typeof val === "number" && Number.isFinite(val) ? val : fallback;
  return Math.max(0, Math.floor(n));
}

async function assertOptionsBelongToPoll(poll_id: string, ids: string[]): Promise<OptCheck> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "invalid_payload" };
  }

  const dedup = Array.from(new Set(ids));
  const { data, error } = await supabase
    .from("poll_options")
    .select("id")
    .eq("poll_id", poll_id)
    .in("id", dedup);

  if (error) {
    console.error("assertOptionsBelongToPoll error:", error);
    return { ok: false, error: "internal_error" };
  }

  const found = new Set((data ?? []).map((r: any) => r.id));
  const allOk = dedup.every((id) => found.has(id));

  if (!allOk) return { ok: false, error: "invalid_option_for_poll" };
  return { ok: true, dedup };
}

/* ======================================================
   Handler
====================================================== */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, option_id, option_ids, participant_id, user_hash } = body as any;

    if (!poll_id || !participant_id || !user_hash) {
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
        allow_multiple,
        max_options_per_vote
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

    if (!["single", "multiple", "ranking"].includes(poll.voting_type)) {
      return NextResponse.json({ error: "invalid_poll_type" }, { status: 400 });
    }

    // Regras canônicas:
    // allow_multiple=false => max_votes_per_user=1 (voto editável; último vale)
    // allow_multiple=true  => max_votes_per_user define quantidade
    const allowMultiple = Boolean(poll.allow_multiple);
    const effectiveMaxVotes = allowMultiple
      ? Math.max(1, normalizeFinitePositiveInt(poll.max_votes_per_user, 1))
      : 1;

    const cooldownSeconds = normalizeFinitePositiveInt(poll.vote_cooldown_seconds, 0);

    const maxOptionsPerVote =
      poll.max_options_per_vote === null || poll.max_options_per_vote === undefined
        ? null
        : Math.max(1, normalizeFinitePositiveInt(poll.max_options_per_vote, 1));

    /* =========================
       Cooldown (criar e alterar)
       Usa GREATEST(created_at, updated_at)
    ========================= */
    if (cooldownSeconds > 0) {
      const { data: lastVote } = await supabase
        .from("votes")
        .select("created_at, updated_at")
        .eq("poll_id", poll_id)
        .eq("participant_id", participant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastVote?.created_at) {
        const createdMs = new Date(lastVote.created_at).getTime();
        const updatedMs = lastVote.updated_at ? new Date(lastVote.updated_at).getTime() : 0;
        const lastMs = Math.max(createdMs, updatedMs, createdMs);

        const cooldownEnd = lastMs + cooldownSeconds * 1000;
        if (Date.now() < cooldownEnd) {
          return NextResponse.json(
            {
              error: "cooldown_active",
              remaining_seconds: Math.ceil((cooldownEnd - Date.now()) / 1000),
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
       MODE: BIG BROTHER (max_votes_per_user > 1)
    ======================================================= */
    if (effectiveMaxVotes > 1) {
      const { count } = await supabase
        .from("votes")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", poll_id)
        .eq("participant_id", participant_id);

      const used = typeof count === "number" ? count : 0;
      if (used >= effectiveMaxVotes) {
        return NextResponse.json({ error: "vote_limit_reached" }, { status: 403 });
      }

      const voteId = randomUUID();

      if (poll.voting_type === "single") {
        if (!option_id) {
          return NextResponse.json({ error: "missing_option" }, { status: 400 });
        }

        const optCheck = await assertOptionsBelongToPoll(poll_id, [option_id]);
        if (!optCheck.ok) {
          return NextResponse.json(
            { error: optCheck.error },
            { status: optCheck.error === "internal_error" ? 500 : 400 }
          );
        }

        await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          option_id,
          participant_id,
          user_hash,
        });

        return NextResponse.json({ success: true });
      }

      if (poll.voting_type === "multiple") {
        if (!Array.isArray(option_ids) || option_ids.length === 0) {
          return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }

        const optCheck = await assertOptionsBelongToPoll(poll_id, option_ids);
        if (!optCheck.ok) {
          return NextResponse.json(
            { error: optCheck.error },
            { status: optCheck.error === "internal_error" ? 500 : 400 }
          );
        }
        const dedup = optCheck.dedup;

        if (maxOptionsPerVote !== null && dedup.length > maxOptionsPerVote) {
          return NextResponse.json({ error: "max_options_exceeded" }, { status: 400 });
        }

        await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          participant_id,
          user_hash,
        });

        await supabase.from("vote_options").insert(
          dedup.map((opt) => ({
            vote_id: voteId,
            option_id: opt,
          }))
        );

        return NextResponse.json({ success: true });
      }

      // ranking
      if (!Array.isArray(option_ids) || option_ids.length === 0) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }

      if (new Set(option_ids).size !== option_ids.length) {
        return NextResponse.json({ error: "invalid_ranking_duplicate_option" }, { status: 400 });
      }

      const optCheck = await assertOptionsBelongToPoll(poll_id, option_ids);
      if (!optCheck.ok) {
        return NextResponse.json(
          { error: optCheck.error },
          { status: optCheck.error === "internal_error" ? 500 : 400 }
        );
      }

      await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        participant_id,
        user_hash,
      });

      await supabase.from("vote_rankings").insert(
        option_ids.map((opt: string, idx: number) => ({
          id: randomUUID(),
          vote_id: voteId,
          option_id: opt,
          ranking: idx + 1,
        }))
      );

      return NextResponse.json({ success: true });
    }

    /* ======================================================
       MODE: VOTO ÚNICO (max_votes_per_user = 1)
    ======================================================= */

    const { data: existingVote } = await supabase
      .from("votes")
      .select("id, option_id")
      .eq("poll_id", poll_id)
      .eq("participant_id", participant_id)
      .maybeSingle();

    const voteId = existingVote?.id ?? randomUUID();
    const isUpdate = Boolean(existingVote);

    let beforeState: any = null;
    let afterState: any = null;

    /* ---------- SINGLE ---------- */
    if (poll.voting_type === "single") {
      if (!option_id) {
        return NextResponse.json({ error: "missing_option" }, { status: 400 });
      }

      const optCheck = await assertOptionsBelongToPoll(poll_id, [option_id]);
      if (!optCheck.ok) {
        return NextResponse.json(
          { error: optCheck.error },
          { status: optCheck.error === "internal_error" ? 500 : 400 }
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
            user_hash,
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
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }

      const optCheck = await assertOptionsBelongToPoll(poll_id, option_ids);
      if (!optCheck.ok) {
        return NextResponse.json(
          { error: optCheck.error },
          { status: optCheck.error === "internal_error" ? 500 : 400 }
        );
      }

      let dedup = optCheck.dedup;
      if (dedup.length === 0) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }

      if (maxOptionsPerVote !== null && dedup.length > maxOptionsPerVote) {
        return NextResponse.json({ error: "max_options_exceeded" }, { status: 400 });
      }

      // order irrelevante: snapshot ordenado para comparação consistente
      dedup = dedup.slice().sort();

      if (existingVote) {
        const { data: prev } = await supabase
          .from("vote_options")
          .select("option_id")
          .eq("vote_id", voteId);

        const prevIds = (prev?.map((r: any) => r.option_id) ?? []).slice().sort();
        beforeState = snapshotMultiple(prevIds);

        if (arraysEqual(prevIds, dedup)) {
          return NextResponse.json({ success: true, updated: false });
        }

        await supabase.from("vote_options").delete().eq("vote_id", voteId);

        await supabase
          .from("votes")
          .update({ user_hash, updated_at: new Date().toISOString() })
          .eq("id", voteId);
      } else {
        await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          participant_id,
          user_hash,
        });
      }

      await supabase.from("vote_options").insert(
        dedup.map((opt: string) => ({
          vote_id: voteId,
          option_id: opt,
        }))
      );

      afterState = snapshotMultiple(dedup);
    }

    /* ---------- RANKING ---------- */
    if (poll.voting_type === "ranking") {
      if (!Array.isArray(option_ids) || option_ids.length === 0) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }

      if (new Set(option_ids).size !== option_ids.length) {
        return NextResponse.json({ error: "invalid_ranking_duplicate_option" }, { status: 400 });
      }

      const optCheck = await assertOptionsBelongToPoll(poll_id, option_ids);
      if (!optCheck.ok) {
        return NextResponse.json(
          { error: optCheck.error },
          { status: optCheck.error === "internal_error" ? 500 : 400 }
        );
      }

      if (existingVote) {
        const { data: prev } = await supabase
          .from("vote_rankings")
          .select("option_id")
          .eq("vote_id", voteId)
          .order("ranking");

        const prevIds = prev?.map((r: any) => r.option_id) ?? [];
        beforeState = snapshotRanking(prevIds);

        if (arraysEqual(prevIds, option_ids)) {
          return NextResponse.json({ success: true, updated: false });
        }

        await supabase.from("vote_rankings").delete().eq("vote_id", voteId);

        await supabase
          .from("votes")
          .update({ user_hash, updated_at: new Date().toISOString() })
          .eq("id", voteId);
      } else {
        await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          participant_id,
          user_hash,
        });
      }

      await supabase.from("vote_rankings").insert(
        option_ids.map((opt: string, idx: number) => ({
          id: randomUUID(),
          vote_id: voteId,
          option_id: opt,
          ranking: idx + 1,
        }))
      );

      afterState = snapshotRanking(option_ids);
    }

    if (!afterState) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
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
  } catch (e) {
    console.error("internal_error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
