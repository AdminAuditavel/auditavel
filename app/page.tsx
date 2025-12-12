import Link from "next/link";
import { supabase } from "@/lib/supabase";

// -------------------------
// Tipos internos apenas para uso local
// -------------------------
type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  voting_type?: string | null; // "single" ou "ranking"
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

type Vote = {
  poll_id: string;
  option_id: string | null;
};

type VoteRanking = {
  option_id: string;
  ranking: number;
};

// -------------------------

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

function cardColor(status: string) {
  if (status === "open") return "bg-green-50";
  if (status === "not_started") return "bg-yellow-50";
  return "bg-red-50";
}

// -------------------------

export default async function Home() {
  // 1) Buscar pesquisas
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

  const pollIds = polls.map((p) => p.id);

  // 2) Buscar opções
  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("id, poll_id, option_text")
    .in("poll_id", pollIds);

  const options: PollOption[] = Array.isArray(optionsData) ? optionsData : [];

  // 3) Buscar votos simples
  const { data: votesData } = await supabase
    .from("votes")
    .select("poll_id, option_id")
    .in("poll_id", pollIds);

  const votes: Vote[] = Array.isArray(votesData) ? votesData : [];

  // 4) Buscar rankings
  const { data: rankingsData } = await supabase
    .from("vote_rankings")
    .select("option_id, ranking");

  const rankings: VoteRanking[] = Array.isArray(rankingsData) ? rankingsData : [];

  // Agrupar opções por pesquisa
  const optionsByPoll = new Map<string, PollOption[]>();
  for (const o of options) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  }

  // Agrupar votos por option_id
  const voteCountByOption = new Map<string, number>();
  for (const v of votes) {
    if (!v.option_id) continue;
    voteCountByOption.set(v.option_id, (voteCountByOption.get(v.option_id) || 0) + 1);
  }

  // Agrupar rankings por option_id
  const rankingsByOption = new Map<string, VoteRanking[]>();
  for (const r of rankings) {
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  }

  // -------------------------
  // Renderizar interface
  // -------------------------

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Auditável — Pesquisas</h1>

      <div className="space-y-4">
        {polls.map((p) => {
          const status = computeStatus(p);
          const opts = optionsByPoll.get(p.id) || [];
          const isRanking = (p.voting_type || "").toLowerCase() === "ranking";

          // ----- VOTOS SIMPLES -----
          const totalVotes = opts.reduce(
            (acc, opt) => acc + (voteCountByOption.get(opt.id) || 0),
            0
          );

          let leaderSimple: PollOption | null = null;
          let leaderPct = 0;

          if (!isRanking && totalVotes > 0) {
            leaderSimple = opts
              .slice()
              .sort(
                (a, b) =>
                  (voteCountByOption.get(b.id) || 0) -
                  (voteCountByOption.get(a.id) || 0)
              )[0];

            if (leaderSimple) {
              leaderPct =
                Math.round(
                  ((voteCountByOption.get(leaderSimple.id) || 0) / totalVotes) *
                    1000
                ) / 10;
            }
          }

          // ----- RANKING -----
          let leaderRanking: {
            option: PollOption;
            avg: number;
            count: number;
          } | null = null;

          if (isRanking) {
            const summaries = opts.map((opt) => {
              const rks = rankingsByOption.get(opt.id) || [];
              if (!rks.length)
                return { option: opt, avg: Infinity, count: 0 };
              const avg =
                rks.reduce((s, r) => s + r.ranking, 0) / rks.length;
              return { option: opt, avg, count: rks.length };
            });

            leaderRanking =
              summaries.slice().sort((a, b) => a.avg - b.avg)[0] || null;
          }

          return (
            <Link
              key={p.id}
              href={`/poll/${p.id}`}
              className={`block p-4 border rounded-lg hover:shadow transition-shadow ${cardColor(
                status
              )}`}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {p.title}
              </h2>

              <div className="text-sm text-gray-700 flex flex-wrap gap-4 mb-2">
                <span>Início: {formatDate(p.start_date)}</span>
                <span>Fim: {formatDate(p.end_date)}</span>
                <span>Tipo: {isRanking ? "Ranking" : "Voto Único"}</span>
              </div>

              {/* ----------- SIMPLE POLL ----------- */}
              {!isRanking && (
                <>
                  <div className="text-sm text-gray-700">
                    <b>Total de votos:</b> {totalVotes}
                  </div>

                  {leaderSimple && (
                    <div className="mt-1 text-sm font-medium text-green-700">
                      Líder: {leaderSimple.option_text}{" "}
                      <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold">
                        {leaderPct}%
                      </span>{" "}
                      ({voteCountByOption.get(leaderSimple.id)} votos)
                    </div>
                  )}

                  {totalVotes === 0 && (
                    <div className="text-gray-600 mt-1 text-sm">
                      Sem votos ainda.
                    </div>
                  )}
                </>
              )}

              {/* ----------- RANKING POLL ----------- */}
              {isRanking && leaderRanking && leaderRanking.count > 0 && (
                <div className="mt-1 text-sm font-medium text-green-700">
                  Líder (ranking médio): {leaderRanking.option.option_text}{" "}
                  <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold">
                    {leaderRanking.avg.toFixed(2)}
                  </span>{" "}
                  ({leaderRanking.count} votos)
                </div>
              )}

              {isRanking && leaderRanking?.count === 0 && (
                <div className="text-gray-600 mt-1 text-sm">
                  Nenhum ranking registrado ainda.
                </div>
              )}

              {/* Status */}
              <div className="mt-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${status === "open"
                    ? "bg-green-100 text-green-800"
                    : status === "not_started"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                    }`}
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
