import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  voting_type?: string | null;
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
  votes_count: number | null;
};

type VoteRanking = {
  id: string;
  vote_id: string;
  option_id: string;
  ranking: number;
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function computeStatus(p: Poll) {
  const now = new Date();
  const start = p.start_date ? new Date(p.start_date) : null;
  const end = p.end_date ? new Date(p.end_date) : null;

  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
}

function statusBadgeClasses(status: string) {
  if (status === "open") return "bg-green-100 text-green-800";
  if (status === "not_started") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function cardColor(status: string) {
  if (status === "open") return "bg-green-50";
  if (status === "not_started") return "bg-yellow-50";
  return "bg-red-50";
}

export default async function Home() {
  // 1) Buscar todas as pesquisas
  const { data: pollsData } = await supabase
    .from("polls")
    .select("id, title, start_date, end_date, created_at, voting_type")
    .order("created_at", { ascending: false });

  const polls: Poll[] = Array.isArray(pollsData) ? pollsData : [];

  if (!polls.length) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>
        <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>
      </main>
    );
  }

  // 2) Buscar opções de todas as pesquisas
  const pollIds = polls.map((p) => p.id);

  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("id, poll_id, option_text, votes_count")
    .in("poll_id", pollIds);

  const options: PollOption[] = Array.isArray(optionsData) ? optionsData : [];

  // 3) Buscar rankings (para pesquisas de ranking)
  const { data: rankingsData } = await supabase
    .from("vote_rankings")
    .select("id, vote_id, option_id, ranking");

  const rankings: VoteRanking[] = Array.isArray(rankingsData) ? rankingsData : [];

  // Agrupar opções por pesquisa
  const optionsByPoll = new Map<string, PollOption[]>();
  for (const o of options) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  }

  // Agrupar rankings por option_id
  const rankingsByOption = new Map<string, VoteRanking[]>();
  for (const r of rankings) {
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-2 text-center">Auditável — Pesquisas</h1>

      <div className="space-y-4">
        {polls.map((p) => {
          const status = computeStatus(p);
          const opts = optionsByPoll.get(p.id) || [];
          const isRanking = (p.voting_type || "").toLowerCase() === "ranking";

          // ==== PESQUISAS SIMPLES ====
          const totalVotes = opts.reduce((acc, o) => acc + (o.votes_count || 0), 0);

          let leaderSimple: PollOption | null = null;
          let leaderPct = 0;

          if (totalVotes > 0) {
            leaderSimple = opts
              .slice()
              .sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0))[0];
            leaderPct = leaderSimple
              ? Math.round(((leaderSimple.votes_count || 0) / totalVotes) * 1000) / 10
              : 0;
          }

          // ==== PESQUISAS RANKING ====
          let leaderRanking: {
            option: PollOption;
            avg: number;
            count: number;
          } | null = null;

          if (isRanking) {
            const summaries = opts.map((opt) => {
              const rks = rankingsByOption.get(opt.id) || [];
              if (!rks.length) return { option: opt, avg: Infinity, count: 0 };

              const avg = rks.reduce((s, r) => s + r.ranking, 0) / rks.length;
              return { option: opt, avg, count: rks.length };
            });

            leaderRanking = summaries.sort((a, b) => a.avg - b.avg)[0] || null;
          }

          return (
            <Link
              key={p.id}
              href={`/poll/${p.id}`}
              className={`block p-4 border rounded-lg hover:shadow transition-shadow duration-150 ${cardColor(
                status
              )}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{p.title}</h2>

                  <div className="mt-2 text-sm text-gray-700 flex flex-wrap gap-3">
                    <span>Início: {formatDate(p.start_date)}</span>
                    <span>Fim: {formatDate(p.end_date)}</span>
                    <span>Tipo: {isRanking ? "Ranking" : "Voto simples"}</span>
                  </div>

                  {/* Painel de informações principais */}
                  <div className="mt-3 text-sm text-gray-700">

                    {/* ======= SIMPLE POLL ======= */}
                    {!isRanking && (
                      <>
                        <div>
                          <span className="font-medium">Total de votos:</span> {totalVotes}
                        </div>

                        {leaderSimple && totalVotes > 0 && (
                          <div className="mt-2">
                            <span className="font-medium">Líder:</span>{" "}
                            <span className="font-semibold">{leaderSimple.option_text}</span>{" "}
                            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-sm font-bold bg-blue-50 text-blue-800">
                              {leaderPct}%
                            </span>
                            <span className="ml-2 text-gray-600">
                              ({leaderSimple.votes_count} votos)
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* ======= RANKING POLL ======= */}
                    {isRanking && leaderRanking && leaderRanking.count > 0 && (
                      <div className="mt-2">
                        <span className="font-medium">Líder (média ranking):</span>{" "}
                        <span className="font-semibold">
                          {leaderRanking.option.option_text}
                        </span>{" "}
                        <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-sm font-bold bg-blue-50 text-blue-800">
                          {leaderRanking.avg.toFixed(2)}
                        </span>
                        <span className="ml-2 text-gray-600">
                          ({leaderRanking.count} votos)
                        </span>
                      </div>
                    )}

                    {isRanking && (!leaderRanking || leaderRanking.count === 0) && (
                      <div className="text-gray-600">Nenhum ranking disponível ainda.</div>
                    )}
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses(
                    status
                  )}`}
                >
                  {status === "open"
                    ? "Aberta"
                    : status === "not_started"
                    ? "Não iniciada"
                    : "Encerrada"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
