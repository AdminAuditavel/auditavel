import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const poll_id = params.id;

  console.log("API RESULTS — poll_id recebido:", poll_id);

  // ============================================================
  // 1) Validação básica do parâmetro
  // ============================================================
  if (!poll_id || poll_id.trim() === "") {
    console.error("API RESULTS — ID inválido:", poll_id);
    return NextResponse.json(
      { error: "invalid_poll_id", message: "Poll ID is missing or invalid." },
      { status: 400 }
    );
  }

  // ============================================================
  // 2) Buscar opções da poll
  // ============================================================
  const { data: optionsList, error: optionsErr } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", poll_id);

  if (optionsErr) {
    console.error("Erro ao obter opções:", optionsErr);
    return NextResponse.json(
      { error: "options_fetch_error", details: optionsErr.message },
      { status: 500 }
    );
  }

  if (!optionsList || optionsList.length === 0) {
    return NextResponse.json(
      { error: "no_options", message: "No options found for poll." },
      { status: 404 }
    );
  }

  const numOptions = optionsList.length;

  // ============================================================
  // 3) Buscar vote_rankings
  // ============================================================
  const optionIds = optionsList.map((o) => o.id);

  const { data: rankingsRowsRaw, error: rankingsErr } = await supabase
    .from("vote_rankings")
    .select("option_id, ranking, poll_options(option_text)")
    .in("option_id", optionIds);

  if (rankingsErr) {
    console.error("Erro ao obter vote_rankings:", rankingsErr);
    return NextResponse.json(
      { error: "rankings_fetch_error", details: rankingsErr.message },
      { status: 500 }
    );
  }

  // rankingsRowsRaw pode ser null → normalizamos para []
  const rankingsRows = rankingsRowsRaw ?? [];

  // ============================================================
  // 4) Sistema de Borda
  // ============================================================
  const scores: Record<
    string,
    {
      option_text: string;
      score: number;
      counts_per_position: Record<number, number>;
      total_rankings: number;
    }
  > = {};

  // Initialize scores
  for (const o of optionsList) {
    scores[o.id] = {
      option_text: o.option_text,
      score: 0,
      counts_per_position: {},
      total_rankings: 0,
    };
  }

  rankingsRows.forEach((row: any) => {
    const optId = row.option_id;
    const rank = Number(row.ranking);

    const validRank = Math.min(Math.max(rank, 1), numOptions);
    const points = numOptions - validRank + 1;

    const entry = scores[optId];
    if (!entry) return;

    entry.score += points;
    entry.total_rankings++;
    entry.counts_per_position[validRank] =
      (entry.counts_per_position[validRank] || 0) + 1;
  });

  // ============================================================
  // 5) Resultado final
  // ============================================================
  const result = Object.entries(scores)
    .map(([option_id, data]) => ({
      option_id,
      option_text: data.option_text,
      score: data.score,
      total_rankings: data.total_rankings,
      counts_per_position: data.counts_per_position,
    }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    poll_id,
    num_options: numOptions,
    result,
  });
}
