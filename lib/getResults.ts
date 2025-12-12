import { supabaseServer as supabase } from "@/lib/supabase-server";

export type ResultRow = {
  option_id: string;
  option_text: string;
  score: number;
};

/**
 * Calcula resultados para uma poll em modo "ranking" (Borda-like).
 * - Busca opções da poll
 * - Busca votos (assume que votos de ranking armazenam `option_ids` como array ordenado)
 * - Para cada voto, atribui pontuação decrescente: n - posição
 */
export async function getResults(pollId: string): Promise<{ result: ResultRow[] }> {
  if (!pollId) return { result: [] };

  // 1) buscar opções
  const { data: optionsData, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", pollId);

  if (optionsError) {
    console.error("getResults — erro ao buscar options:", optionsError);
    return { result: [] };
  }

  const options = optionsData ?? [];

  const n = options.length;
  if (n === 0) return { result: [] };

  // inicializa pontuações
  const scores: Record<string, number> = {};
  options.forEach((o: any) => {
    scores[o.id] = 0;
  });

  // 2) buscar votos de ranking (campo option_ids)
  const { data: votesData, error: votesError } = await supabase
    .from("votes")
    .select("option_ids")
    .eq("poll_id", pollId);

  if (votesError) {
    console.error("getResults — erro ao buscar votes:", votesError);
    return { result: [] };
  }

  const votes = votesData ?? [];

  // 3) pontuação estilo Borda
  votes.forEach((v: any) => {
    const ordered: string[] = v.option_ids ?? [];
    if (!Array.isArray(ordered)) return;
    for (let i = 0; i < ordered.length; i++) {
      const optId = ordered[i];
      const pts = Math.max(n - i, 0);
      if (typeof optId === "string") {
        scores[optId] = (scores[optId] || 0) + pts;
      }
    }
  });

  // 4) montar e ordenar resultado
  const result: ResultRow[] = options.map((o: any) => ({
    option_id: o.id,
    option_text: o.option_text,
    score: scores[o.id] || 0,
  }));

  result.sort((a, b) => b.score - a.score);

  return { result };
}
