import { supabaseServer } from "@/lib/supabase-server";

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
 *
 * Emite logs informativos usados para debugging no deploy.
 */
export async function getResults(pollId: string): Promise<{ result: ResultRow[] }> {
  if (!pollId) return { result: [] };

  // ✅ supabaseServer agora é função: instanciar o client
  const supabase = supabaseServer();

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
  if (n === 0) {
    console.info("getResults — sem opções para poll:", pollId);
    return { result: [] };
  }

  // inicializa scores
  const scores: Record<string, number> = {};
  options.forEach((o: any) => {
    scores[o.id] = 0;
  });

  let foundAny = false;

  // 2) tentar formato votes.option_ids (se existir a coluna)
  try {
    const { data: votesData, error: votesError } = await supabase
      .from("votes")
      .select("option_ids")
      .eq("poll_id", pollId);

    if (votesError) {
      // a coluna pode não existir; logamos e seguimos para vote_rankings
      console.info(
        "getResults — coluna option_ids ausente ou erro ao buscar votes:",
        votesError
      );
    } else if (Array.isArray(votesData) && votesData.length > 0) {
      // verificar se pelo menos um registro tem option_ids como array
      for (const v of votesData) {
        if (Array.isArray((v as any)?.option_ids) && (v as any).option_ids.length > 0) {
          foundAny = true;
          break;
        }
      }

      if (foundAny) {
        // aplicar pontuação Borda usando option_ids arrays
        let counted = 0;
        for (const v of votesData as any[]) {
          const ordered: string[] = v.option_ids ?? [];
          if (!Array.isArray(ordered) || ordered.length === 0) continue;
          counted++;
          for (let i = 0; i < ordered.length; i++) {
            const optId = ordered[i];
            const pts = Math.max(n - i, 0);
            if (typeof optId === "string") {
              scores[optId] = (scores[optId] || 0) + pts;
            }
          }
        }
        console.info("getResults — processados votos do tipo option_ids:", counted);
      }
    }
  } catch (e) {
    console.info(
      "getResults — exceção ao tentar ler votes.option_ids (esperado se coluna não existir):",
      String(e)
    );
  }

  // 3) se não encontramos votos via option_ids, usar vote_rankings normalizado
  if (!foundAny) {
    // buscar todos os vote ids desta poll
    const { data: voteIdsData, error: voteIdsError } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", pollId);

    if (voteIdsError) {
      console.error("getResults — erro ao buscar vote ids:", voteIdsError);
    } else {
      const voteIds = (voteIdsData ?? []).map((r: any) => r.id).filter(Boolean);
      console.info("getResults — voteIds encontrados:", voteIds.length);

      if (voteIds.length > 0) {
        const { data: vrRows, error: vrRowsError } = await supabase
          .from("vote_rankings")
          .select("vote_id, option_id, ranking")
          .in("vote_id", voteIds)
          .order("vote_id", { ascending: true })
          .order("ranking", { ascending: true });

        if (vrRowsError) {
          console.error(
            "getResults — erro ao buscar vote_rankings por vote_ids:",
            vrRowsError
          );
        } else if (Array.isArray(vrRows) && vrRows.length > 0) {
          console.info("getResults — linhas em vote_rankings encontradas:", vrRows.length);

          // agrupar por vote_id
          const grouped: Record<string, { option_id: string; ranking: number }[]> = {};
          for (const row of vrRows as any[]) {
            const vid = row.vote_id;
            grouped[vid] = grouped[vid] || [];
            grouped[vid].push({
              option_id: row.option_id,
              ranking: Number(row.ranking),
            });
          }

          // para cada voto (group), ordenar por ranking asc (1 = top) e pontuar
          let votesCounted = 0;
          for (const vid of Object.keys(grouped)) {
            const ordered = grouped[vid]
              .slice()
              .sort((a, b) => a.ranking - b.ranking)
              .map((r) => r.option_id);

            if (ordered.length === 0) continue;
            votesCounted++;

            for (let i = 0; i < ordered.length; i++) {
              const optId = ordered[i];
              const pts = Math.max(n - i, 0);
              if (typeof optId === "string") {
                scores[optId] = (scores[optId] || 0) + pts;
              }
            }
          }

          console.info(
            "getResults — votos contabilizados via vote_rankings (grupos):",
            votesCounted
          );
          foundAny = votesCounted > 0;
        } else {
          console.info("getResults — nenhuma linha em vote_rankings para esses vote_ids");
        }
      } else {
        console.info("getResults — nenhum vote_id encontrado para a poll:", pollId);
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

  if (!foundAny) {
    console.info("getResults — nenhum voto detectado para poll:", pollId);
  } else {
    console.info("getResults — resultado final preparado para poll:", pollId);
  }

  return { result };
}
