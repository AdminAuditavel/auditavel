export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Poll = {
  id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  voting_type: "single" | "ranking";
  allow_multiple: boolean;
  status: "draft" | "open" | "paused" | "closed";
  show_partial_results: boolean;
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

type Vote = {
  poll_id: string;
  option_id: string | null;
  user_hash: string;
};

type VoteRanking = {
  vote_id: string;
  option_id: string;
  ranking: number;
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function statusLabel(status: Poll["status"]) {
  if (status === "open") return "Aberta";
  if (status === "paused") return "Pausada";
  if (status === "closed") return "Encerrada";
  return "Rascunho";
}

function statusColor(status: Poll["status"]) {
  if (status === "open") return "bg-green-100 text-green-800";
  if (status === "paused") return "bg-yellow-100 text-yellow-800";
  if (status === "closed") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-600";
}

export default async function Home() {
  /* =======================
     POLLS
  ======================= */
  const { data: pollsData } = await supabase
    .from("polls")
    .select(
      "id, title, description, start_date, end_date, voting_type, allow_multiple, status, show_partial_results"
    )
    .order("created_at", { ascending: false });

  const polls: Poll[] = pollsData || [];
  if (!polls.length) {
    return <p className="p-6 text-center">Nenhuma pesquisa disponível.</p>;
  }

  const pollIds = polls.map(p => p.id);

  /* =======================
     OPTIONS
  ======================= */
  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("id, poll_id, option_text")
    .in("poll_id", pollIds);

  const options: PollOption[] = optionsData || [];

  /* =======================
     VOTES
  ======================= */
  const { data: votesData } = await supabase
    .from("votes")
    .select("poll_id, option_id, user_hash")
    .in("poll_id", pollIds);

  const votes: Vote[] = votesData || [];

  /* =======================
     RANKINGS
  ======================= */
  const { data: rankingsData } = await supabase
    .from("vote_rankings")
    .select("vote_id, option_id, ranking");

  const rankings: VoteRanking[] = rankingsData || [];

  /* =======================
     AGRUPAMENTOS
  ======================= */
  const optionsByPoll = new Map<string, PollOption[]>();
  options.forEach(o => {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  });

  const votesByPoll = new Map<string, Vote[]>();
  votes.forEach(v => {
    if (!votesByPoll.has(v.poll_id)) votesByPoll.set(v.poll_id, []);
    votesByPoll.get(v.poll_id)!.push(v);
  });

  const rankingsByOption = new Map<string, VoteRanking[]>();
  rankings.forEach(r => {
    if (!rankingsByOption.has(r.option_id))
      rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  });

  const rankingVotesByPoll = new Map<string, Set<string>>();
  rankings.forEach(r => {
    const opt = options.find(o => o.id === r.option_id);
    if (!opt) return;
    if (!rankingVotesByPoll.has(opt.poll_id))
      rankingVotesByPoll.set(opt.poll_id, new Set());
    rankingVotesByPoll.get(opt.poll_id)!.add(r.vote_id);
  });

  /* =======================
     RENDER
  ======================= */
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-10">
      {/* HERO */}
      <section className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-emerald-700">
          Auditável
        </h1>
        <p className="text-lg font-medium text-gray-800">
          Onde decisões públicas podem ser verificadas.
        </p>
      </section>

      <hr className="border-gray-200" />

      {/* CARDS */}
      <section className="space-y-6">
        {polls.map(p => {
          if (p.status === "draft") return null;

          const opts = optionsByPoll.get(p.id) || [];
          const isRanking = p.voting_type === "ranking";

          const canShowResults =
            p.status === "closed" ||
            ((p.status === "open" || p.status === "paused") &&
              p.show_partial_results);

          const isVotingOpen = p.status === "open";

          let totalVotes = 0;
          let topSingle: { text: string; percent: number }[] = [];
          let topRanking: { text: string; score: number }[] = [];

          /* ===== SINGLE ===== */
          if (!isRanking) {
            const pollVotes = votesByPoll.get(p.id) || [];

            totalVotes = p.allow_multiple
              ? pollVotes.length
              : new Set(pollVotes.map(v => v.user_hash)).size;

            if (canShowResults && totalVotes > 0) {
              const count = new Map<string, number>();
              pollVotes.forEach(v => {
                if (!v.option_id) return;
                count.set(v.option_id, (count.get(v.option_id) || 0) + 1);
              });

              topSingle = opts
                .map(o => ({
                  text: o.option_text,
                  votes: count.get(o.id) || 0,
                }))
                .filter(o => o.votes > 0)
                .sort((a, b) => b.votes - a.votes)
                .slice(0, 3)
                .map(o => ({
                  text: o.text,
                  percent: Math.round((o.votes / totalVotes) * 100),
                }));
            }
          }

          /* ===== RANKING ===== */
          if (isRanking && canShowResults) {
            const summaries = opts
              .map(o => {
                const rs = rankingsByOption.get(o.id) || [];
                if (!rs.length) return null;
                const avg = rs.reduce((s, r) => s + r.ranking, 0) / rs.length;
                return { text: o.option_text, score: avg };
              })
              .filter(Boolean) as { text: string; score: number }[];

            if (summaries.length) {
              const best = Math.min(...summaries.map(s => s.score));
              topRanking = summaries
                .sort((a, b) => a.score - b.score)
                .slice(0, 3)
                .map(s => ({
                  text: s.text,
                  score: Math.round((best / s.score) * 100),
                }));
            }
          }

          return (
            <div
              key={p.id}
              className="relative p-5 border border-gray-200 rounded-xl bg-white shadow-sm"
            >
              {/* STATUS */}
              <span
                className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                  p.status
                )}`}
              >
                {statusLabel(p.status)}
              </span>

              {/* TITLE */}
              <h2 className="text-lg font-semibold text-emerald-700 pr-24">
                {p.title}
              </h2>

              {/* META */}
              <div className="text-sm text-gray-600 mt-1">
                Início: {formatDate(p.start_date)} · Fim:{" "}
                {formatDate(p.end_date)} · Tipo:{" "}
                {isRanking ? "Ranking" : "Voto simples"}
              </div>

              {/* CONTENT + GRAPH */}
              {canShowResults && (
                <div className="mt-4 flex gap-4 items-start">
                  {/* TEXTO — DESCRIPTION */}
                  <div className="flex-1 text-sm text-gray-700">
                    {p.description ? (
                      <p>{p.description}</p>
                    ) : (
                      <p className="text-gray-600">
                        Participe desta decisão e acompanhe como outras pessoas
                        estão se posicionando.
                      </p>
                    )}
                  </div>

                  {/* MINI GRÁFICO */}
                  <div className="w-40 space-y-2">
                    {!isRanking &&
                      topSingle.map((o, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex justify-between">
                            <span className="truncate">{o.text}</span>
                            <span>{o.percent}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded">
                            <div
                              className="h-1.5 bg-emerald-500 rounded"
                              style={{ width: `${o.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}

                    {isRanking &&
                      topRanking.map((o, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex justify-between">
                            <span className="truncate">
                              <strong>{i + 1}º</strong> {o.text}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded">
                            <div
                              className="h-1.5 bg-emerald-500 rounded"
                              style={{ width: `${o.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-4 space-y-1">
                <Link
                  href={`/poll/${p.id}`}
                  className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                >
                  {isVotingOpen ? "Ir para votação →" : "Ver opções →"}
                </Link>

                {canShowResults && (
                  <div>
                    <Link
                      href={`/results/${p.id}`}
                      className="text-sm text-emerald-700 hover:underline"
                    >
                      Ver resultados
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* RODAPÉ */}
      <footer className="pt-6 border-t text-center text-sm text-gray-600">
        Uma plataforma para coletar dados, gerar informação e produzir
        conhecimento público confiável.
      </footer>
    </main>
  );
}
