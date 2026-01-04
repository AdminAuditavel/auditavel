// app/api/admin/results/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { isAdminRequest } from "@/lib/admin-auth";

type Ctx = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(req: NextRequest, context: Ctx) {
  try {
    // =========================
    // AUTH (token OU sessão)
    // =========================
    const token = req.nextUrl.searchParams.get("token");

    const admin = await isAdminRequest({ token });
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // =========================
    // PARAMS (compat: Promise | plain)
    // =========================
    const resolvedParams =
      context?.params && typeof (context.params as any).then === "function"
        ? await (context.params as Promise<{ id: string }>)
        : (context.params as { id: string });

    const pollId = (resolvedParams?.id || "").trim();
    if (!pollId) {
      return NextResponse.json({ error: "invalid_poll_id" }, { status: 400 });
    }

    // =========================
    // POLL
    // =========================
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select(
        "id,title,voting_type,status,allow_multiple,max_votes_per_user,show_partial_results"
      )
      .eq("id", pollId)
      .maybeSingle();

    if (pollError || !poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    const votingType = (poll.voting_type || "single") as
      | "single"
      | "multiple"
      | "ranking";

    // =========================
    // OPTIONS
    // =========================
    const { data: options, error: optError } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", pollId);

    if (optError) {
      return NextResponse.json(
        { error: "failed_to_load_options", details: optError.message },
        { status: 500 }
      );
    }

    // =========================
    // VOTES (pai)
    // =========================
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("id, option_id, participant_id")
      .eq("poll_id", pollId);

    if (votesError) {
      return NextResponse.json(
        { error: "failed_to_load_votes", details: votesError.message },
        { status: 500 }
      );
    }

    const totalSubmissions = votes?.length || 0;
    const totalParticipants = new Set(
      (votes ?? []).map((v: any) => v.participant_id)
    ).size;

    // vote_id -> participant_id
    const participantByVoteId = new Map<string, string>();
    for (const v of votes ?? []) {
      if (v?.id && v?.participant_id) participantByVoteId.set(v.id, v.participant_id);
    }

    // =========================
    // SINGLE (admin detalhado)
    // =========================
    if (votingType === "single") {
      const count: Record<string, number> = {};
      const uniqueByOption = new Map<string, Set<string>>();

      for (const v of votes ?? []) {
        if (!v.option_id) continue;

        count[v.option_id] = (count[v.option_id] || 0) + 1;

        if (!uniqueByOption.has(v.option_id)) uniqueByOption.set(v.option_id, new Set());
        uniqueByOption.get(v.option_id)!.add(v.participant_id);
      }

      const rows =
        (options ?? [])
          .map((o: any) => {
            const unique = uniqueByOption.get(o.id)?.size || 0;
            const pctParticipants =
              totalParticipants > 0 ? Math.round((unique / totalParticipants) * 100) : 0;

            return {
              option_id: o.id,
              option_text: o.option_text,
              unique_voters: unique,
              pct_participants: pctParticipants,
              votes: count[o.id] || 0,
            };
          })
          .sort((a: any, b: any) => b.unique_voters - a.unique_voters) || [];

      return NextResponse.json({
        poll,
        totals: { totalParticipants, totalSubmissions },
        rows,
      });
    }

    // =========================
    // MULTIPLE (admin detalhado)
    // =========================
    if (votingType === "multiple") {
      const voteIds = (votes ?? []).map((v: any) => v.id).filter(Boolean);

      const { data: marks, error: marksError } = voteIds.length
        ? await supabase
            .from("vote_options")
            .select("vote_id, option_id")
            .in("vote_id", voteIds)
        : { data: [], error: null };

      if (marksError) {
        return NextResponse.json(
          { error: "failed_to_load_marks", details: marksError.message },
          { status: 500 }
        );
      }

      const marksByOption: Record<string, number> = {};
      const uniqueByOption = new Map<string, Set<string>>();

      for (const m of marks ?? []) {
        if (!m.option_id || !m.vote_id) continue;

        marksByOption[m.option_id] = (marksByOption[m.option_id] || 0) + 1;

        const participantId = participantByVoteId.get(m.vote_id);
        if (!participantId) continue;

        if (!uniqueByOption.has(m.option_id)) uniqueByOption.set(m.option_id, new Set());
        uniqueByOption.get(m.option_id)!.add(participantId);
      }

      const totalMarks = (marks ?? []).length;

      const rows =
        (options ?? [])
          .map((o: any) => {
            const unique = uniqueByOption.get(o.id)?.size || 0;
            const marksCount = marksByOption[o.id] || 0;

            return {
              option_id: o.id,
              option_text: o.option_text,
              unique_voters: unique,
              pct_participants:
                totalParticipants > 0 ? Math.round((unique / totalParticipants) * 100) : 0,
              marks: marksCount,
              pct_marks: totalMarks > 0 ? Math.round((marksCount / totalMarks) * 100) : 0,
            };
          })
          .sort((a: any, b: any) => b.unique_voters - a.unique_voters) || [];

      return NextResponse.json({
        poll,
        totals: { totalParticipants, totalSubmissions, totalMarks },
        rows,
      });
    }

    // =========================
    // RANKING (admin detalhado)
    // =========================
    const voteIds = (votes ?? []).map((v: any) => v.id).filter(Boolean);

    const { data: rankings, error: rankError } = voteIds.length
      ? await supabase
          .from("vote_rankings")
          .select("vote_id, option_id, ranking")
          .in("vote_id", voteIds)
      : { data: [], error: null };

    if (rankError) {
      return NextResponse.json(
        { error: "failed_to_load_rankings", details: rankError.message },
        { status: 500 }
      );
    }

    const sumByOption: Record<string, number> = {};
    const countByOption: Record<string, number> = {};
    const uniqueByOption = new Map<string, Set<string>>();

    for (const r of rankings ?? []) {
      if (!r.option_id || !r.vote_id) continue;

      const rk = Number(r.ranking || 0);
      sumByOption[r.option_id] = (sumByOption[r.option_id] || 0) + rk;
      countByOption[r.option_id] = (countByOption[r.option_id] || 0) + 1;

      const participantId = participantByVoteId.get(r.vote_id);
      if (!participantId) continue;

      if (!uniqueByOption.has(r.option_id)) uniqueByOption.set(r.option_id, new Set());
      uniqueByOption.get(r.option_id)!.add(participantId);
    }

    const rows =
      (options ?? [])
        .map((o: any) => {
          const appearances = countByOption[o.id] || 0;
          const unique = uniqueByOption.get(o.id)?.size || 0;
          const avgRank = appearances > 0 ? sumByOption[o.id] / appearances : null;

          return {
            option_id: o.id,
            option_text: o.option_text,
            unique_voters: unique,
            pct_participants:
              totalParticipants > 0 ? Math.round((unique / totalParticipants) * 100) : 0,
            appearances,
            avg_rank: avgRank !== null ? Number(avgRank.toFixed(2)) : null,
          };
        })
        // melhor ranking primeiro: menor avg_rank; desempate por mais votos únicos
        .sort((a: any, b: any) => {
          if (a.avg_rank === null) return 1;
          if (b.avg_rank === null) return -1;
          if (a.avg_rank !== b.avg_rank) return a.avg_rank - b.avg_rank;
          return b.unique_voters - a.unique_voters;
        }) || [];

    return NextResponse.json({
      poll,
      totals: { totalParticipants, totalSubmissions },
      rows,
    });
  } catch (err: any) {
    console.error("admin results error:", err);
    return NextResponse.json(
      { error: "unknown_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
