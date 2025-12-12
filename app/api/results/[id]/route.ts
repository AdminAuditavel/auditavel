import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  // Compatibilidade: params pode ser um objeto ou uma Promise<{ id: string }>
  const { params } = context;
  const { id: poll_id } = (await params) as { id: string };

  // 1) contar opções da poll
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

  const numOptions = optionsList?.length ?? 0;
  if (numOptions === 0) {
    return NextResponse.json(
      { error: "no_options", message: "No options found for poll" },
      { status: 404 }
    );
  }

  // 2) buscar vote_rankings relacionados à poll (join via poll_options)
  // Selecionamos option_id, ranking e poll_options.option_text
  const { data: rankingsRows, error: rankingsErr } = await supabase
    .from("vote_rankings")
    .select("option_id, ranking, poll_options(option_text)")
    .in(
      "option_id",
      (optionsList as any[]).map((o: any) => o.id)
    );

  if (rankingsErr) {
    console.error("Erro ao obter vote_rankings:", rankingsErr);
    return NextResponse.json(
      { error: "rankings_fetch_error", details: rankingsErr.message },
      { status: 500 }
    );
  }

  // 3) agregar Borda
  const scores: Record<
    string,
    {
      option_text: string;
      score: number;
      counts_per_position?: Record<number, number>;
      total_rankings: number;
    }
  > = {};

  // initialize scores with option list to ensure options with zero votes appear
  for (const o of optionsList as any[]) {
    scores[o.id] = {
      option_text: o.option_text,
      score: 0,
      counts_per_position: {},
      total_rankings: 0,
    };
  }

  (rankingsRows ?? []).forEach((row: any) => {
    const optId = row.option_id;
    const rank = Number(row.ranking) || 0;

    // safety: if ranking outside range, clamp
    const clampedRank = Math.min(Math.max(rank, 1), numOptions);

    const points = numOptions - clampedRank + 1;

    if (!scores[optId]) {
      // fallback, but ideally all option_ids exist in optionsList
      scores[optId] = {
        option_text: row.poll_options?.option_text ?? "Unknown",
        score: 0,
        counts_per_position: {},
        total_rankings: 0,
      };
    }

    scores[optId].score += points;
    scores[optId].total_rankings += 1;
    const counts = scores[optId].counts_per_position!;
    counts[clampedRank] = (counts[clampedRank] || 0) + 1;
  });

  // 4) prepare result array and sort
  const result = Object.entries(scores)
    .map(([option_id, obj]) => ({
      option_id,
      option_text: obj.option_text,
      score: obj.score,
      total_rankings: obj.total_rankings,
      counts_per_position: obj.counts_per_position,
    }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ poll_id, num_options: numOptions, result });
}
