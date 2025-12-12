import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PollRow = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  voting_type?: string | null; // e.g. 'ranking' ou 'simple'
};

type PollOptionRow = {
  id: string;
  poll_id: string;
  option_text: string;
  votes_count?: number | null;
};

type VoteRankingRow = {
  id: string;
  vote_id: string;
  option_id: string;
  ranking: number;
  poll_id?: string; // pode não existir; usaremos a tabela join via where
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function computeStatusFromDates(p: PollRow) {
  const now = new Date();
  const start = p.start_date ? new Date(p.start_date) : null;
  const end = p.end_date ? new Date(p.end_date) : null;
  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
}

function statusBadgeClasses(s: string) {
  if (s === "open") return "bg-green-100 text-green-800";
  if (s === "not_started") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

/**
 * Home page: lista de polls com badges, total, porcentagem/média e leader destaque.
 */
export default async function Home() {
  // 1) buscar polls principais (mantendo created_at para ordenação)
  const { data: pollsData, error: pollsError } = await supabase
    .from<PollRow>("polls")
    .select("id, title, start_date, end_date, created_at, voting_type")
    .order("created_at", { ascending: false });

  if (pollsError) {
    console.error("Erro ao buscar polls:", pollsError);
    // fallback UI simples
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>
        <p className="text-red-600">Erro ao carregar pesquisas. Veja o console.</p>
      </main>
    );
  }

  const polls = Array.isArray(pollsData) ? pollsData : [];

  // se não há polls, retorna a UI com mensagem
  if (!polls.length) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>
        <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>
      </main>
    );
  }

  // 2) buscar poll_options para todos os polls (por poll_id IN (...))
  const pollIds = polls.map((p) => p.id);

  const { data: optionsData, error: optionsError } = await supabase
    .from<PollOptionRow>("poll_options")
    .select("id, poll_id, option_text, votes_count")
    .in("poll_id", pollIds);

  if (optionsError) {
    console.error("Erro ao buscar poll_options:", optionsError);
    // mesmo se houver erro, continuamos com arrays vazios para não quebrar UI
  }

  const options = Array.isArray(optionsData) ? optionsData : [];

  // 3) buscar vote_rankings para polls do tipo ranking
  const { data: rankingsData, error: rankingsError } = await supabase
    .from<VoteRankingRow>("vote_rankings")
    .select("id, vote_id, option_id, ranking")
    // não há poll_id diretamente na tabela vote_rankings; iremos filtrar por vote_id
    // O passo abaixo supõe que a tabela votes contém poll_id (se não, filtragem será por outro caminho).
    // Para garantir compatibilidade, buscamos todos vote_rankings e filtramos em JS por option->poll.
    ;

  if (rankingsError) {
    console.error("Erro ao buscar vote_rankings:", rankingsError);
  }

  const rankings = Array.isArray(rankingsData) ? rankingsData : [];

  // 4) montar map poll_id -> options[]
  const optionsByPoll = new Map<string, PollOptionRow[]>();
  for (const o of options) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  }

  // 5) montar map option_id -> rankings[] (para calcular média por option)
  const rankingsByOption = new Map<string, VoteRankingRow[]>();
  for (const r of rankings) {
    if (!r.option_id) continue;
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  }

  // 6) render
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-2 text-center">Auditável — Pesquisas</h1>

      <div className="space-y-4">
        {polls.map((p) => {
          const status = computeStatusFromDates(p);
          const opts = optionsByPoll.get(p.id) || [];

          // Se pesquisa for tipo 'ranking', usamos vote_rankings para computar média por option.
          const isRanking = (p.voting_type || "").toLowerCase() === "ranking";

          // total de votos (para pesquisas simples: soma votes_count)
          const totalVotes = opts.reduce((acc, o) => acc + (o.votes_count || 0), 0);

          // calcular líder para pesquisas simples
          const leaderOptionSimple =
            opts.slice().sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0))[0] ||
            null;

          // Para ranking: calcular média de ranking por option usando rankingsByOption
          type RankingSummary = { option: PollOptionRow; avg: number; count: number };
          const rankingSummaries: RankingSummary[] = [];

          if (isRanking) {
            for (const opt of opts) {
              const rks = rankingsByOption.get(opt.id) || [];
              if (!rks.length) {
                rankingSummaries.push({ option: opt, avg: Number.POSITIVE_INFINITY, count: 0 });
              } else {
                const sum = rks.reduce((s, r) => s + (r.ranking || 0), 0);
                const avg = sum / rks.length;
                rankingSummaries.push({ option: opt, avg, count: rks.length });
              }
            }
          }

          const leaderRanking =
            isRanking && rankingSummaries.length
              ? rankingSummaries
                  .slice()
                  .sort((a, b) => a.avg - b.avg) // menor média = melhor posição
                  [0]
              : null;

          // porcentagem do líder (apenas para pesquisa simples)
          const leaderPct =
            leaderOptionSimple && totalVotes > 0
              ? Math.round(((leaderOptionSimple.votes_count || 0) / totalVotes) * 1000) / 10
              : 0; // uma casa decimal

          return (
            <Link
              key={p.id}
              href={`/poll/${p.id}`}
              className="block p-4 border rounded-lg hover:shadow transition-shadow duration-150 bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{p.title}</h2>

                  <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-3">
                    <span>Início: {formatDate(p.start_date)}</span>
                    <span>Fim: {formatDate(p.end_date)}</span>
                    <span>Tipo: {isRanking ? "Ranking" : "Voto único / múltiplo"}</span>
                  </div>

                  <div className="mt-3 text-sm text-gray-700 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    {/* Para polls simples: mostrar total e líder com porcentagem destacada */}
                    {!isRanking && (
                      <>
                        <div>
                          <span className="font-medium">Total de votos:</span>{" "}
                          <span>{totalVotes}</span>
                        </div>

                        {leaderOptionSimple && (
                          <div className="mt-2 sm:mt-0">
                            <span className="font-medium">Líder:</span>{" "}
                            <span className="font-semibold">{leaderOptionSimple.option_text}</span>{" "}
                            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-sm font-bold bg-blue-50 text-blue-800">
                              {leaderPct}% 
                            </span>
                            <span className="ml-2 text-sm text-gray-600">({leaderOptionSimple.votes_count || 0} votos)</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Para polls de ranking: mostrar média e contagem */}
                    {isRanking && leaderRanking && leaderRanking.count > 0 && (
                      <div>
                        <span className="font-medium">Líder (média):</span>{" "}
                        <span className="font-semibold">{leaderRanking.option.option_text}</span>{" "}
                        <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-sm font-bold bg-blue-50 text-blue-800">
                          Média {Number(leaderRanking.avg).toFixed(2)}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">({leaderRanking.count} rankings)</span>
                      </div>
                    )}

                    {/* Caso não haja dados ainda */}
                    {isRanking && (!leaderRanking || leaderRanking.count === 0) && (
                      <div className="text-sm text-gray-600">Sem registros de ranking ainda.</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses(
                      status
                    )}`}
                  >
                    {status === "open" ? "Aberta" : status === "not_started" ? "Não iniciada" : "Encerrada"}
                  </span>

                  <div className="text-xs text-gray-500">
                    {/* Espaço para meta / outro indicador futuro */}
                    {p.created_at ? `Criada: ${formatDate(p.created_at)}` : null}
                  </div>
                </div>
              </div>

              {/* Opcional: lista reduzida das principais opções (visual) */}
              {opts.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {opts.slice(0, 4).map((opt) => {
                    if (!isRanking) {
                      const pct = totalVotes > 0 ? Math.round(((opt.votes_count || 0) / totalVotes) * 1000) / 10 : 0;
                      return (
                        <div key={opt.id} className="flex items-center justify-between text-sm text-gray-700">
                          <div className="truncate">{opt.option_text}</div>
                          <div className="ml-4 flex items-baseline gap-3">
                            <div className="text-sm font-semibold">{opt.votes_count || 0}</div>
                            <div className="text-xs text-gray-500">{pct}%</div>
                          </div>
                        </div>
                      );
                    } else {
                      const rks = rankingsByOption.get(opt.id) || [];
                      const avg = rks.length ? rks.reduce((s, r) => s + r.ranking, 0) / rks.length : NaN;
                      return (
                        <div key={opt.id} className="flex items-center justify-between text-sm text-gray-700">
                          <div className="truncate">{opt.option_text}</div>
                          <div className="ml-4 text-xs text-gray-500">
                            {rks.length ? `média ${Number(avg).toFixed(2)} (${rks.length})` : "—"}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
