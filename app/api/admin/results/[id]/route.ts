//app/api/admin/results/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // token via query (mesmo padrão do resto do admin)
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const pollId = (params?.id || "").trim();
    if (!pollId) {
      return NextResponse.json({ error: "invalid_poll_id" }, { status: 400 });
    }

    // 1) Poll
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

    // 2) Options
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

    // 3) Votes (pai)
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

    const vt = (poll.voting_type || "single") as
      | "single"
      | "ranking"
      | "multiple";

    // =======================
    // SINGLE (admin detalhado)
    // =======================
    if (vt === "single") {
      const count: Record<string, number> = {};
      for (const v of votes ?? []) {
        if (!v.option_id) continue;
        count[v.option_id] = (count[v.option_id] || 0) + 1;
      }

      const rows =
        (options ?? [])
          .map((o: any) => ({
            option_id: o.id,
            option_text: o.option_text,
            votes: count[o.id] || 0,
          }))
          .sort((a: any, b: any) => b.votes - a.votes) || [];

      return NextResponse.json({
        poll,
        totals: { totalParticipants, totalSubmissions },
        rows,
      });
    }

    // =========================
    // MULTIPLE (admin detalhado)
    // =========================
    if (vt === "multiple") {
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

      const count: Record<string, number> = {};
      for (const m of marks ?? []) {
        if (!m.option_id) continue;
        count[m.option_id] = (count[m.option_id] || 0) + 1;
      }

      const rows =
        (options ?? [])
          .map((o: any) => ({
            option_id: o.id,
            option_text: o.option_text,
            marks: count[o.id] || 0,
          }))
          .sort((a: any, b: any) => b.marks - a.marks) || [];

      return NextResponse.json({
        poll,
        totals: {
          totalParticipants,
          totalSubmissions,
          totalMarks: (marks ?? []).length,
        },
        rows,
      });
    }

    // =========================
    // RANKING (placeholder admin)
    // =========================
    return NextResponse.json({
      poll,
      totals: { totalParticipants, totalSubmissions },
      rows: [],
      note:
        "Ranking: detalhamento admin será expandido (distribuição por posição, médias, etc.).",
    });
  } catch (err: any) {
    console.error("admin results error:", err);
    return NextResponse.json(
      { error: "unknown_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
