// app/page.tsx

export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const DEFAULT_POLL_ICON = "/polls/Enquete_Copa2026.png";

type Poll = {
  id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  voting_type: "single" | "ranking" | "multiple";
  allow_multiple: boolean;
  status: "draft" | "open" | "paused" | "closed";
  show_partial_results: boolean;
  icon_url?: string | null;
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

function votingTypeLabel(vt: Poll["voting_type"]) {
  if (vt === "ranking") return "Ranking";
  if (vt === "multiple") return "Múltipla";
  return "Voto simples";
}

export default async function Home() {
  /* =======================
     POLLS
  ======================= */
  const { data: pollsData } = await supabase
    .from("polls")
    .select(
      "id, title, description, start_date, end_date, voting_type, allow_multiple, status, show_partial_results, icon_url"
    )
    .order("created_at", { ascending: false });

  const polls: Poll[] = pollsData || [];
  const visiblePolls = polls.filter((p) => p.status !== "draft");

  if (!visiblePolls.length) {
    return <p className="p-6 text-center">Nenhuma pesquisa disponível.</p>;
  }

  const featuredPoll = visiblePolls[0];
  const otherPolls = visiblePolls.slice(1);

  const pollIds = visiblePolls.map((p) => p.id);

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
  options.forEach((o) => {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  });

  const votesByPoll = new Map<string, Vote[]>();
  votes.forEach((v) => {
    if (!votesByPoll.has(v.poll_id)) votesByPoll.set(v.poll_id, []);
    votesByPoll.get(v.poll_id)!.push(v);
  });

  const rankingsByOption = new Map<string, VoteRanking[]>();
  rankings.forEach((r) => {
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  });

  /* =======================
     HELPERS (RESULTADOS)
  ======================= */
  function canShowResults(p: Poll) {
    return (
      p.status === "closed" ||
      ((p.status === "open" || p.status === "paused") && p.show_partial_results)
    );
  }

  function computeTopBars(p: Poll) {
    const opts = optionsByPoll.get(p.id) || [];
    const show = canShowResults(p);
    const isRanking = p.voting_type === "ranking";

    let totalVotes = 0;
    let topSingle: { text: string; percent: number }[] = [];
    let topRanking: { text: string; score: number }[] = [];

    if (!show) return { show, isRanking, totalVotes, topSingle, topRanking };

    if (!isRanking) {
      const pollVotes = votesByPoll.get(p.id) || [];
      totalVotes = p.allow_multiple
        ? pollVotes.length
        : new Set(pollVotes.map((v) => v.user_hash)).size;

      if (totalVotes > 0) {
        const count = new Map<string, number>();
        pollVotes.forEach((v) => {
          if (!v.option_id) return;
          count.set(v.option_id, (count.get(v.option_id) || 0) + 1);
        });

        topSingle = opts
          .map((o) => ({ text: o.option_text, votes: count.get(o.id) || 0 }))
          .filter((o) => o.votes > 0)
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 3)
          .map((o) => ({
            text: o.text,
            percent: Math.round((o.votes / totalVotes) * 100),
          }));
      }
    } else {
      const summaries = opts
        .map((o) => {
          const rs = rankingsByOption.get(o.id) || [];
          if (!rs.length) return null;
          const avg = rs.reduce((s, r) => s + r.ranking, 0) / rs.length;
          return { text: o.option_text, score: avg };
        })
        .filter(Boolean) as { text: string; score: number }[];

      if (summaries.length) {
        const best = Math.min(...summaries.map((s) => s.score));
        topRanking = summaries
          .sort((a, b) => a.score - b.score)
          .slice(0, 3)
          .map((s) => ({
            text: s.text,
            score: Math.round((best / s.score) * 100),
          }));
      }
    }

    return { show, isRanking, totalVotes, topSingle, topRanking };
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-10">
      {/* HERO */}
      <section className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-emerald-700">Auditável</h1>
        <p className="text-lg font-medium text-gray-800">
          Onde decisões públicas podem ser verificadas.
        </p>
      </section>

      <hr className="border-gray-200" />

      {/* DESTAQUE */}
      {featuredPoll && (() => {
        const p = featuredPoll;
        const iconSrc = (p.icon_url && p.icon_url.trim()) || DEFAULT_POLL_ICON;
        const typeLabel = votingTypeLabel(p.voting_type);
        const showResults = canShowResults(p);

        const { isRanking, topSingle, topRanking } = computeTopBars(p);

        return (
          <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-lg transition overflow-hidden">
            {/* overlay link (card inteiro clicável) */}
            <Link
              href={`/poll/${p.id}`}
              aria-label={`Abrir pesquisa: ${p.title}`}
              className="absolute inset-0 z-10"
            />

            {/* IMAGEM GRANDE */}
            <div className="h-64 w-full overflow-hidden">
              <img
                src={iconSrc}
                alt={p.title}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>

            <div className="p-6 relative z-20">
              {/* STATUS */}
              <span
                className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                  p.status
                )}`}
              >
                {statusLabel(p.status)}
              </span>

              {/* TÍTULO (preto) */}
              <h2 className="text-2xl font-bold text-gray-900 pr-28">{p.title}</h2>

              {/* META */}
              <div className="mt-2 text-sm text-gray-600">
                Início: {formatDate(p.start_date)} · Fim: {formatDate(p.end_date)} · Tipo:{" "}
                {typeLabel}
              </div>

              {/* DESCRIÇÃO */}
              <p className="mt-4 text-gray-700 leading-relaxed">
                {p.description
                  ? p.description
                  : "Participe desta decisão e ajude a construir informação pública confiável."}
              </p>

              {/* PRINCIPAIS POSIÇÕES (apenas) */}
              {showResults && (
                <div className="mt-5">
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <div className="text-xs font-semibold text-gray-600 mb-2">
                      Principais posições
                    </div>

                    {!isRanking &&
                      (topSingle.length ? (
                        <div className="space-y-2">
                          {topSingle.map((o, i) => (
                            <div key={i} className="text-xs">
                              <div className="flex justify-between gap-2">
                                <span className="truncate text-gray-800">{o.text}</span>
                                <span className="shrink-0 text-gray-700">{o.percent}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded">
                                <div
                                  className="h-1.5 bg-emerald-500 rounded"
                                  style={{ width: `${o.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Ainda sem votos suficientes para exibir.
                        </div>
                      ))}

                    {isRanking &&
                      (topRanking.length ? (
                        <div className="space-y-2">
                          {topRanking.map((o, i) => (
                            <div key={i} className="text-xs">
                              <div className="flex justify-between gap-2">
                                <span className="truncate text-gray-800">
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
                      ) : (
                        <div className="text-xs text-gray-500">
                          Ainda sem rankings suficientes para exibir.
                        </div>
                      ))}
                  </div>

                  {/* LINK RESULTADOS (clicável acima do overlay) */}
                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/results/${p.id}`}
                      className="relative z-30 inline-flex items-center px-3 py-2 rounded-lg
                                 text-sm font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition"
                    >
                      Ver resultados
                    </Link>
                  </div>
                </div>
              )}

              {!showResults && (
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Clique no card para participar.</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* LISTA COMPACTA */}
      <section className="space-y-4">
        {otherPolls.length > 0 && (
          <h3 className="text-sm font-semibold text-gray-700">Outras pesquisas</h3>
        )}

        <div className="grid grid-cols-1 gap-4">
          {otherPolls.map((p) => {
            const iconSrc = (p.icon_url && p.icon_url.trim()) || DEFAULT_POLL_ICON;
            const typeLabel = votingTypeLabel(p.voting_type);
            const showResults = canShowResults(p);

            return (
              <div
                key={p.id}
                className="relative flex gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition"
              >
                {/* overlay link (card inteiro clicável) */}
                <Link
                  href={`/poll/${p.id}`}
                  aria-label={`Abrir pesquisa: ${p.title}`}
                  className="absolute inset-0 z-10"
                />

                {/* IMAGEM PEQUENA */}
                <div className="relative z-20 w-28 h-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img
                    src={iconSrc}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* TEXTO */}
                <div className="relative z-20 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-base font-semibold text-gray-900 truncate">
                      {p.title}
                    </h4>

                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(
                        p.status
                      )}`}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-gray-600">
                    Tipo: {typeLabel} · Início: {formatDate(p.start_date)} · Fim:{" "}
                    {formatDate(p.end_date)}
                  </div>

                  {p.description && (
                    <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                      {p.description}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">Clique para participar</span>

                    {showResults && (
                      <Link
                        href={`/results/${p.id}`}
                        className="relative z-30 inline-flex items-center px-3 py-1.5 rounded-lg
                                   text-xs font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition"
                      >
                        Resultados
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="pt-6 border-t text-center text-sm text-gray-600">
        Uma plataforma para coletar dados, gerar informação e produzir conhecimento público confiável.
      </footer>
    </main>
  );
}
