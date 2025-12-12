import { supabaseServer as supabase } from "@/lib/supabase-server";

export type ResultRow = {
  option_id: string;
  option_text: string;
  score: number;
};

/**
 * Calcula resultados para uma poll em modo "ranking" (Borda-like).
 * Suporta:
 * - votos armazenados como votes.option_ids (array ordenado)
 * - votos normalizados em vote_rankings (vote_id, option_id, ranking)
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

  // inicializa scores
  const scores: Record<string, number> = {};
  options.forEach((o: any) => {
    scores[o.id] = 0;
  });

  // 2) tentar buscar votos no formato array (votes.option_ids)
  const { data: votesData, error: votesError } = await supabase
    .from("votes")
    .select("option_ids")
    .eq("poll_id", pollId);

  if (votesError) {
    console.error("getResults — erro ao buscar votes (option_ids):", votesError);
    // não retorna ainda — vamos tentar vote_rankings em seguida
  }

  let foundAny = false;

  if (Array.isArray(votesData) && votesData.length > 0) {
    // verificar se pelo menos um registro tem option_ids como array
    for (const v of votesData) {
      if (Array.isArray(v?.option_ids) && v.option_ids.length > 0) {
        foundAny = true;
        break;
      }
    }

    if (foundAny) {
      // aplicar pontuação Borda usando option_ids arrays
      for (const v of votesData) {
        const ordered: string[] = v.option_ids ?? [];
        if (!Array.isArray(ordered) || ordered.length === 0) continue;
        for (let i = 0; i < ordered.length; i++) {
          const optId = ordered[i];
          const pts = Math.max(n - i, 0);
          if (typeof optId === "string") {
            scores[optId] = (scores[optId] || 0) + pts;
          }
        }
      }
    }
  }

  // 3) se não encontramos votos no formato array, tentar vote_rankings normalizado
  if (!foundAny) {
    // Precisamos agregar as linhas por vote_id e ordenar por ranking (assume ranking: 1 = topo)
    // Fazemos join com votes para garantir poll_id correto (vote_rankings referencia vote_id)
    const { data: vrData, error: vrError } = await supabase
      .from("vote_rankings")
      .select("vote_id, option_id, ranking")
      .in(
        "vote_id",
        // subselect dos votos dessa poll
        // NOTE: Supabase does not support subselect in .in() easily; em vez disso, buscamos os vote ids primeiro.
        [] as string[]
      );

    if (vrError) {
      // Se a consulta direta falhar (ou se não conseguirmos usar in desta forma), fazemos outra estratégia:
      // buscar vote ids primeiro e então buscar vote_rankings
      const { data: voteIdsData, error: voteIdsError } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", pollId);

      if (voteIdsError) {
        console.error("getResults — erro ao buscar vote ids para vote_rankings:", voteIdsError);
      } else {
        const voteIds = (voteIdsData ?? []).map((r: any) => r.id);
        if (voteIds.length > 0) {
          const { data: vrRows, error: vrRowsError } = await supabase
            .from("vote_rankings")
            .select("vote_id, option_id, ranking")
            .in("vote_id", voteIds)
            .order("vote_id", { ascending: true })
            .order("ranking", { ascending: true });

          if (vrRowsError) {
            console.error("getResults — erro ao buscar vote_rankings por vote_ids:", vrRowsError);
          } else if (Array.isArray(vrRows) && vrRows.length > 0) {
            // agrupar por vote_id
            const grouped: Record<string, { option_id: string; ranking: number }[]> = {};
            for (const row of vrRows) {
              const vid = row.vote_id;
              grouped[vid] = grouped[vid] || [];
              grouped[vid].push({ option_id: row.option_id, ranking: Number(row.ranking) });
            }
            // para cada voto (group), ordenar por ranking asc (1 = top) e pontuar
            for (const vid of Object.keys(grouped)) {
              const ordered = grouped[vid]
                .slice()
                .sort((a, b) => a.ranking - b.ranking)
                .map((r) => r.option_id);
              for (let i = 0; i < ordered.length; i++) {
                const optId = ordered[i];
                const pts = Math.max(n - i, 0);
                if (typeof optId === "string") {
                  scores[optId] = (scores[optId] || 0) + pts;
                }
              }
            }
          }
        }
      }
    } else {
      // Caso a primeira tentativa com .in() tenha retornado sem erro (raro), processar vrData
      if (Array.isArray(vrData) && vrData.length > 0) {
        const grouped: Record<string, { option_id: string; ranking: number }[]> = {};
        for (const row of vrData) {
          const vid = row.vote_id;
          grouped[vid] = grouped[vid] || [];
          grouped[vid].push({ option_id: row.option_id, ranking: Number(row.ranking) });
        }
        for (const vid of Object.keys(grouped)) {
          const ordered = grouped[vid]
            .slice()
            .sort((a, b) => a.ranking - b.ranking)
            .map((r) => r.option_id);
          for (let i = 0; i < ordered.length; i++) {
            const optId = ordered[i];
            const pts = Math.max(n - i, 0);
            if (typeof optId === "string") {
              scores[optId] = (scores[optId] || 0) + pts;
            }
          }
        }
      }
    }
  }

  // 4) montar resultado ordenado
  const result: ResultRow[] = options.map((o: any) => ({
    option_id: o.id,
    option_text: o.option_text,
    score: scores[o.id] || 0,
  }));

  result.sort((a, b) => b.score - a.score);

  return { result };
}
