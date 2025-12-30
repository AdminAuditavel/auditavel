//app/api/admin/results/[id]/route.ts

import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

// Ajuste aqui para a MESMA regra que você já usa nos outros endpoints admin
function assertAdminTokenOrThrow(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  const expected = process.env.ADMIN_TOKEN || "";
  if (!expected) throw new Error("ADMIN_TOKEN não configurado no servidor.");

  if (!token || token !== expected) {
    const err: any = new Error("Token inválido.");
    err.status = 401;
    throw err;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    assertAdminTokenOrThrow(req);

    const pollId = (params?.id || "").trim();
    if (!pollId) {
      return NextResponse.json({ error: "poll_id inválido." }, { status: 400 });
    }

    // 1) Poll
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("id,title,voting_type,status,allow_multiple,max_votes_per_user,show_partial_results")
      .eq("id", pollId)
      .maybeSingle();

    if (!poll || pollError) {
      return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
    }

    // 2) Options
    const { data: options, error: optError } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", pollId);

    if (optError) {
      return NextResponse.json({ error: "Falha ao carregar opções." }, { status: 500 });
    }

    // 3) Votes (pai)
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("id, option_id, participant_id")
      .eq("poll_id", pollId);

    if (votesError) {
      return NextResponse.json({ error: "Falha ao carregar votos." }, { status: 500 });
    }

    const totalSubmissions = votes?.length || 0;
    const totalParticipants = new Set((votes || []).map((v) => v.participant_id)).size;

    // 4) Breakdown por tipo
    const vt = poll.voting_type as "single" | "ranking" | "multiple";

    // SINGLE: contagem bruta por option_id (você pode evoluir para unique por participante depois)
    if (vt === "single") {
      const count: Record<string, number> = {};
      for (const v of votes || []) {
        if (!v.option_id) continue;
        count[v.option_id] = (count[v.option_id] || 0) + 1;
      }

      const rows = (options || [])
        .map((o) => ({
          option_id: o.id,
          option_text: o.option_text,
          votes: count[o.id] || 0,
        }))
        .sort((a, b) => b.votes - a.votes);

      return NextResponse.json({
        poll,
        totals: { totalParticipants, totalSubmissions },
        rows,
      });
    }

    // MULTIPLE: precisa ler vote_options e contar “marcas” (ou únicos por participante, se você preferir)
    if (vt === "multiple") {
      const voteIds = (votes || []).map((v) => v.id);

      const { data: marks, error: marksError } = voteIds.length
        ? await supabase.from("vote_options").select("vote_id, option_id").in("vote_id", voteIds)
        : { data: [], error: null };

      if (marksError) {
        return NextResponse.json({ error: "Falha ao carregar marcas." }, { status: 500 });
      }

      const count: Record<string, number> = {};
      for (const m of marks || []) {
        if (!m.option_id) continue;
        count[m.option_id] = (count[m.option_id] || 0) + 1;
      }

      const rows = (options || [])
        .map((o) => ({
          option_id: o.id,
          option_text: o.option_text,
          marks: count[o.id] || 0,
        }))
        .sort((a, b) => b.marks - a.marks);

      return NextResponse.json({
        poll,
        totals: { totalParticipants, totalSubmissions, totalMarks: (marks || []).length },
        rows,
      });
    }

    // RANKING: por enquanto, devolve o básico (você já tem getResults no público; aqui é “admin detalhado”)
    // Se quiser, depois a gente adiciona: distribuição por posição, média, etc.
    return NextResponse.json({
      poll,
      totals: { totalParticipants, totalSubmissions },
      rows: [],
      note: "Ranking: detalhamento admin será expandido (posições/médias/distribuição).",
    });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e?.message || "Erro interno." }, { status });
  }
}
