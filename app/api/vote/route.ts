//app/api/vote/route.ts

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
    let { poll_id, option_id, option_ids, participant_id, user_hash } = body as any;

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

    // Normalização defensiva: aceitar option_ids array para um single vote (pegar primeiro)
    if (poll.voting_type === "single" && (!option_id || option_id == null) && Array.isArray(option_ids) && option_ids.length > 0) {
      option_id = option_ids[0];
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
       Usa GREATEST(created_at, updated_at) calculado no DB via EXTRACT(EPOCH ...)
    ========================= */
    if (cooldownSeconds > 0) {
      // Pedimos ao Postgres o maior timestamp (created/updated) em epoch (segundos)
      const res: any = await supabase
        .from('votes')
        .select(
          "extract(epoch from greatest(created_at, coalesce(updated_at, created_at))) as last_epoch"
        )
        .eq('poll_id', poll_id)
        .eq('participant_id', participant_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastRow = res?.data;
      const votesErr = res?.error;

      if (votesErr) {
        console.error('cooldown: error fetching last_epoch from votes:', votesErr);
      } else if (lastRow && lastRow.last_epoch != null) {
        // last_epoch vem em segundos (pode ser string ou number)
        const lastEpochSec =
          typeof lastRow.last_epoch === 'number'
            ? lastRow.last_epoch
            : Number(lastRow.last_epoch);

        if (!Number.isFinite(lastEpochSec)) {
          console.warn('cooldown: invalid last_epoch from db:', lastRow.last_epoch);
        } else {
          const lastMs = Math.floor(lastEpochSec * 1000);
          const nowMs = Date.now();

          // proteja contra clock skew do DB (timestamp no futuro)
          let effectiveLastMs = lastMs;
          if (lastMs > nowMs) {
            console.warn('vote cooldown: last activity from DB is in the future; clamping', {
              poll_id,
              participant_id,
              lastMs,
              nowMs,
            });
            effectiveLastMs = nowMs;
          }

          const cooldownEnd = effectiveLastMs + cooldownSeconds * 1000;
          if (nowMs < cooldownEnd) {
            return NextResponse.json(
              {
                error: 'cooldown_active',
                remaining_seconds: Math.ceil((cooldownEnd - nowMs) / 1000),
              },
              { status: 429 }
            );
          }
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

        const { error: voteErr } = await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          option_id,
          participant_id,
          user_hash,
        });

        if (voteErr) {
          console.error("insert vote (single, big brother) failed:", voteErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }

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

        const { error: voteErr } = await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          participant_id,
          user_hash,
        });

        if (voteErr) {
          console.error("insert vote (multiple, big brother) failed:", voteErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }

        const { error: optsErr } = await supabase.from("vote_options").insert(
          dedup.map((opt) => ({
            vote_id: voteId,
            option_id: opt,
          }))
        );

        if (optsErr) {
          console.error("insert vote_options failed, rolling back vote:", optsErr);
          // rollback vote
          await supabase.from("votes").delete().eq("id", voteId);
          return NextResponse.json({ error: "insert_vote_options_failed" }, { status: 500 });
        }

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

      const { error: voteErr } = await supabase.from("votes").insert({
        id: voteId,
        poll_id,
        participant_id,
        user_hash,
      });

      if (voteErr) {
        console.error("insert vote (ranking, big brother) failed:", voteErr);
        return NextResponse.json({ error: "internal_error" }, { status: 500 });
      }

      const { error: rankErr } = await supabase.from("vote_rankings").insert(
        option_ids.map((opt: string, idx: number) => ({
          id: randomUUID(),
          vote_id: voteId,
          option_id: opt,
          ranking: idx + 1,
        }))
      );

      if (rankErr) {
        console.error("insert vote_rankings failed, rolling back vote:", rankErr);
        await supabase.from("votes").delete().eq("id", voteId);
        return NextResponse.json({ error: "insert_vote_rankings_failed" }, { status: 500 });
      }

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

        const { error: updErr } = await supabase
          .from("votes")
          .update({
            option_id,
            user_hash,
            updated_at: new Date().toISOString(),
          })
          .eq("id", voteId);

        if (updErr) {
          console.error("failed to update existing single vote:", updErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }
      } else {
        const { error: insErr } = await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          option_id,
          participant_id,
          user_hash,
        });

        if (insErr) {
          console.error("failed to insert single vote:", insErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }
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

      // fetch prev rows to allow restore if new insert fails
      let prevRows: { option_id: string }[] = [];
      if (existingVote) {
        const { data: prev } = await supabase
          .from("vote_options")
          .select("option_id")
          .eq("vote_id", voteId);

        prevRows = prev ?? [];
        const prevIds = (prev?.map((r: any) => r.option_id) ?? []).slice().sort();
        beforeState = snapshotMultiple(prevIds);

        if (arraysEqual(prevIds, dedup)) {
          return NextResponse.json({ success: true, updated: false });
        }

        const { error: delErr } = await supabase.from("vote_options").delete().eq("vote_id", voteId);
        if (delErr) {
          console.error("failed to delete previous vote_options:", delErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }

        const { error: updErr } = await supabase
          .from("votes")
          .update({ user_hash, updated_at: new Date().toISOString() })
          .eq("id", voteId);

        if (updErr) {
          console.error("failed to update votes row after deleting vote_options:", updErr);
          // attempt to restore prevRows
          if (prevRows.length > 0) {
            await supabase.from("vote_options").insert(prevRows.map(r => ({ vote_id: voteId, option_id: r.option_id })));
          }
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }
      } else {
        const { error: insErr } = await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          participant_id,
          user_hash,
        });

        if (insErr) {
          console.error("failed to insert vote (multiple):", insErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }
      }

      const { error: optsErr } = await supabase.from("vote_options").insert(
        dedup.map((opt: string) => ({
          vote_id: voteId,
          option_id: opt,
        }))
      );

      if (optsErr) {
        console.error("insert vote_options failed (multiple), attempting restore:", optsErr);
        // attempt to rollback created vote if it was newly created
        if (!existingVote) {
          await supabase.from("votes").delete().eq("id", voteId);
        } else {
          // try to restore prevRows
          if (prevRows.length > 0) {
            await supabase.from("vote_options").insert(prevRows.map(r => ({ vote_id: voteId, option_id: r.option_id })));
          }
        }
        return NextResponse.json({ error: "insert_vote_options_failed" }, { status: 500 });
      }

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

      // fetch prev rankings to allow restore if needed
      let prevRankingRows: { option_id: string, ranking?: number }[] = [];
      if (existingVote) {
        const { data: prev } = await supabase
          .from("vote_rankings")
          .select("option_id, ranking")
          .eq("vote_id", voteId)
          .order("ranking");

        prevRankingRows = prev ?? [];
        const prevIds = prevRankingRows.map((r) => r.option_id);
        beforeState = snapshotRanking(prevIds);

        if (arraysEqual(prevIds, option_ids)) {
          return NextResponse.json({ success: true, updated: false });
        }

        const { error: delErr } = await supabase.from("vote_rankings").delete().eq("vote_id", voteId);
        if (delErr) {
          console.error("failed to delete previous vote_rankings:", delErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }

        const { error: updErr } = await supabase
          .from("votes")
          .update({ user_hash, updated_at: new Date().toISOString() })
          .eq("id", voteId);

        if (updErr) {
          console.error("failed to update votes row after deleting vote_rankings:", updErr);
          // attempt to restore prev rankings
          if (prevRankingRows.length > 0) {
            await supabase.from("vote_rankings").insert(prevRankingRows.map(r => ({ id: randomUUID(), vote_id: voteId, option_id: r.option_id, ranking: r.ranking })));
          }
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }
      } else {
        const { error: insErr } = await supabase.from("votes").insert({
          id: voteId,
          poll_id,
          participant_id,
          user_hash,
        });

        if (insErr) {
          console.error("failed to insert vote (ranking):", insErr);
          return NextResponse.json({ error: "internal_error" }, { status: 500 });
        }
      }

      const { error: rankErr } = await supabase.from("vote_rankings").insert(
        option_ids.map((opt: string, idx: number) => ({
          id: randomUUID(),
          vote_id: voteId,
          option_id: opt,
          ranking: idx + 1,
        }))
      );

      if (rankErr) {
        console.error("insert vote_rankings failed, attempting restore:", rankErr);
        if (!existingVote) {
          await supabase.from("votes").delete().eq("id", voteId);
        } else {
          if (prevRankingRows.length > 0) {
            await supabase.from("vote_rankings").insert(prevRankingRows.map(r => ({ id: randomUUID(), vote_id: voteId, option_id: r.option_id, ranking: r.ranking })));
          }
        }
        return NextResponse.json({ error: "insert_vote_rankings_failed" }, { status: 500 });
      }

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
