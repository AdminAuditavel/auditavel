// app/page.tsx

export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PollImage from "@/app/components/PollImage";

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
  id: string;
  poll_id: string;
  option_id: string | null;
  user_hash: string;
};

type VoteRanking = {
  vote_id: string;
  option_id: string;
  ranking: number;
};

type VoteOptionRow = {
  vote_id: string;
  option_id: string;
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

function titleColor(status: Poll["status"]) {
  if (status === "open") return "text-emerald-800";
  if (status === "paused") return "text-yellow-900";
  if (status === "closed") return "text-red-900";
  return "text-gray-900";
}

function votingTypeLabel(vt: Poll["voting_type"]) {
  if (vt === "ranking") return "Ranking";
  if (vt === "multiple") return "Múltipla";
  return "Voto simples";
}

function normalizeIconUrl(raw?: string | null) {
  const s = (raw || "").trim();
  if (!s) return DEFAULT_POLL_ICON;

  // Remove espaços internos acidentais como "/polls /X.png"
  const cleaned = s.replace(/\s+/g, "");

  const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
  const dot = cleaned.lastIndexOf(".");
  const ext = dot >= 0 ? cleaned.substring(dot).toLowerCase() : "";

  if (allowedExtensions.includes(ext)) {
    if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) return cleaned;
    if (cleaned.startsWith("/")) return cleaned;
    if (cleaned.startsWith("public/")) return "/" + cleaned.replace(/^public\//, "");
    if (cleaned.startsWith("polls/")) return "/" + cleaned;

    const idx = cleaned.indexOf("polls/");
    if (idx >= 0) return "/" + cleaned.slice(idx);
  }

  return DEFAULT_POLL_ICON;
}

function primaryCtaLabel(p: Poll) {
  if (p.status === "open") return "Participar";
  if (p.status === "paused") return "Ver opções";
  if (p.status === "closed") return "Ver pesquisa";
  return "Abrir";
}

function showResultsButton(p: Poll) {
  return (
    p.status === "closed" ||
    ((p.status === "open" || p.status === "paused") && p.show_partial_results)
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: { featured?: string };
}) {
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
    return <p className="p-10 text-center">Nenhuma pesquisa disponível.</p>;
  }

  const featuredId = searchParams?.featured?.trim();
  const featuredPoll =
    (featuredId && visiblePolls.find((x) => x.id === featuredId)) || visiblePolls[0];
  
  const otherPolls = visiblePolls.filter((x) => x.id !== featuredPoll.id)

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
    .select("id, poll_id, option_id, user_hash")
    .in("poll_id", pollIds);

  const votes: Vote[] = votesData || [];
  const voteIds = votes.map((v) => v.id).filter(Boolean);

  /* =======================
     RANKINGS
  ======================= */
  let rankings: VoteRanking[] = [];
  if (voteIds.length) {
    const { data: rankingsData } = await supabase
      .from("vote_rankings")
      .select("vote_id, option_id, ranking")
      .in("vote_id", voteIds);

    rankings = rankingsData || [];
  }

  /* =======================
     VOTE_OPTIONS (MULTIPLE)
  ======================= */
  let voteOptions: VoteOptionRow[] = [];
  if (voteIds.length) {
    const { data: voteOptionsData } = await supabase
      .from("vote_options")
      .select("vote_id, option_id")
      .in("vote_id", voteIds);

    voteOptions = voteOptionsData || [];
  }

  /* =======================
     AGRUPAMENTOS
  ======================= */
  const optionsByPoll = new Map<string, PollOption[]>();
  for (const o of options) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  }

  const votesByPoll = new Map<string, Vote[]>();
  for (const v of votes) {
    if (!votesByPoll.has(v.poll_id)) votesByPoll.set(v.poll_id, []);
    votesByPoll.get(v.poll_id)!.push(v);
  }

  const rankingsByOption = new Map<string, VoteRanking[]>();
  for (const r of rankings) {
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  }

  // MULTIPLE: option_id -> Set(user_hash)
  const multiUsersByOption = new Map<string, Set<string>>();
  const userByVoteId = new Map<string, string>();
  for (const v of votes) userByVoteId.set(v.id, v.user_hash);

  for (const vo of voteOptions) {
    const uh = userByVoteId.get(vo.vote_id);
    if (!uh) continue;

    if (!multiUsersByOption.has(vo.option_id)) {
      multiUsersByOption.set(vo.option_id, new Set<string>());
    }
    multiUsersByOption.get(vo.option_id)!.add(uh);
  }

  /* =======================
     HELPERS
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

    let participants = 0;
    let topSingle: { text: string; percent: number }[] = [];
    let topRanking: { text: string; score: number }[] = [];

    if (!show) return { show, isRanking, participants, topSingle, topRanking };

    if (!isRanking) {
      const pollVotes = votesByPoll.get(p.id) || [];
      const users = new Set(pollVotes.map((v) => v.user_hash));
      participants = users.size;

      if (participants > 0) {
        const vt = p.voting_type; // "single" | "multiple"
        const count = new Map<string, number>();

        if (vt === "multiple") {
          for (const o of opts) {
            const set = multiUsersByOption.get(o.id);
            if (set) count.set(o.id, set.size);
          }
        } else {
          for (const v of pollVotes) {
            if (!v.option_id) continue;
            count.set(v.option_id, (count.get(v.option_id) || 0) + 1);
          }
        }

        topSingle = opts
          .map((o) => ({ text: o.option_text, n: count.get(o.id) || 0 }))
          .filter((o) => o.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .map((o) => ({
            text: o.text,
            percent: Math.round((o.n / participants) * 100),
          }));
      }
    } else {
      const pollVotes = votesByPoll.get(p.id) || [];
      const users = new Set(pollVotes.map((v) => v.user_hash));
      participants = users.size;

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

    return { show, isRanking, participants, topSingle, topRanking };
  }

  const p = featuredPoll;
  const featuredIconSrc = p ? normalizeIconUrl(p.icon_url) : DEFAULT_POLL_ICON;
  const featuredTypeLabel = p ? votingTypeLabel(p.voting_type) : "";
  const featuredShowResults = p ? canShowResults(p) : false;
  const featuredBars = p ? computeTopBars(p) : null;

  /* =======================
     RENDER
  ======================= */
  return (
    <main id="top" className="p-8 max-w-6xl mx-auto space-y-12">

      {/* HERO */}
      <section className="text-center space-y-3">
        <h1 className="text-5xl font-bold text-emerald-700">Auditável</h1>
        <p className="text-lg font-medium text-gray-800">
          Onde decisões públicas podem ser verificadas.
        </p>
      </section>

      <hr className="border-gray-200" />

      {/* DESTAQUE */}
      {p ? (
        <div className="relative group rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-lg transition overflow-hidden">
          {/* overlay link */}
          <Link
            href={`/poll/${p.id}`}
            aria-label={`Abrir pesquisa: ${p.title}`}
            className="absolute inset-0 z-20"
          />

          {/* IMAGEM */}
          <div className="h-44 md:h-64 w-full overflow-hidden bg-gray-50">
            <PollImage
              src={featuredIconSrc}
              fallbackSrc={DEFAULT_POLL_ICON}
              alt={p.title}
              priority
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          {/* Conteúdo */}
          <div className="p-8 pb-28 relative z-10 pointer-events-none">
            <div className="flex flex-col gap-3 md:block">
              <div className="flex items-start justify-between gap-3 md:block">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                  {featuredTypeLabel}
                </span>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                    p.status
                  )} md:absolute md:top-6 md:right-6`}
                >
                  {statusLabel(p.status)}
                </span>
              </div>

              <h2
                className={`text-xl md:text-2xl font-bold ${titleColor(
                  p.status
                )} break-words`}
              >
                {p.title}
              </h2>
            </div>

            <div className="mt-2 text-sm text-gray-600">
              Início: {formatDate(p.start_date)} · Fim: {formatDate(p.end_date)}
            </div>

            <p className="mt-5 text-gray-700 leading-relaxed text-base text-justify">
              {p.description
                ? p.description
                : "Participe desta decisão e ajude a construir informação pública confiável."}
            </p>

            {/* PRINCIPAIS POSIÇÕES */}
            {featuredShowResults && featuredBars && (
              <div className="mt-6">
                <div className="rounded-xl border bg-gray-50 p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-xs font-semibold text-gray-600">
                      Principais posições
                    </div>
                  </div>

                  {!featuredBars.isRanking ? (
                    featuredBars.topSingle.length > 0 ? (
                      <div className="space-y-3">
                        {featuredBars.topSingle.map((o, i) => (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between gap-2">
                              <span className="truncate text-gray-800">{o.text}</span>
                              <span className="shrink-0 text-gray-700">{o.percent}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded">
                              <div
                                className="h-2 bg-emerald-500 rounded"
                                style={{ width: `${o.percent}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">
                        {featuredBars.participants > 0
                          ? "Ainda não há votos válidos para exibição."
                          : "Seja o primeiro a participar — seu voto inicia o resultado público."}
                      </div>
                    )
                  ) : featuredBars.topRanking.length > 0 ? (
                    <div className="space-y-3">
                      {featuredBars.topRanking.map((o, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="truncate text-gray-800">
                              <strong>{i + 1}º</strong> {o.text}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded">
                            <div
                              className="h-2 bg-emerald-500 rounded"
                              style={{ width: `${o.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600">
                      Ainda não há rankings suficientes — participe para iniciar o resultado.
                    </div>
                  )}

                  {/* RODAPÉ DO BLOCO */}
                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-500">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />
                      Resultados parciais
                    </span>
                  
                    <span className="text-[11px] text-gray-500">
                      Total de participações:{" "}
                      <span className="text-gray-700 font-semibold">
                        {featuredBars.participants}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="absolute bottom-6 left-6 z-30 pointer-events-auto">
            <Link
              href={`/poll/${p.id}`}
              className="inline-flex items-center px-4 py-2.5 rounded-xl
                         text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              {primaryCtaLabel(p)}
            </Link>
          </div>

          {/* RESULTADOS */}
          {featuredShowResults && (
            <div className="absolute bottom-6 right-6 z-30 pointer-events-auto">
              <Link
                href={`/results/${p.id}`}
                className="inline-flex items-center px-4 py-2.5 rounded-xl
                           text-sm font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition"
              >
                Ver resultados
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {/* LISTA COMPACTA */}
      <section className="space-y-4">
        {otherPolls.length > 0 && (
          <h3 className="text-sm font-semibold text-gray-700">Outras pesquisas</h3>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {otherPolls.map((p) => {
            const iconSrc = normalizeIconUrl(p.icon_url);
            const typeLabel = votingTypeLabel(p.voting_type);
            const showResults = showResultsButton(p);

            return (
              <div
                key={p.id}
                className="relative group flex gap-5 p-6 border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition min-h-[140px]"
              >
                <Link
                  href={`/poll/${p.id}`}
                  aria-label={`Abrir pesquisa: ${p.title}`}
                  className="absolute inset-0 z-20"
                />

                <div className="relative z-10 pointer-events-none flex gap-5 w-full">
                  <div className="w-40 h-28 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    <PollImage
                      src={iconSrc}
                      fallbackSrc={DEFAULT_POLL_ICON}
                      alt={p.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className={`text-lg font-semibold truncate ${titleColor(p.status)}`}>
                        {p.title}
                      </h4>

                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(
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
                  </div>
                </div>

                <div className="absolute bottom-4 left-6 z-30 pointer-events-auto">
                  <Link
                    href={`/poll/${p.id}`}
                    className="inline-flex items-center px-3 py-2 rounded-xl
                               text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                  >
                    {primaryCtaLabel(p)}
                  </Link>
                </div>

                {showResults && (
                  <div className="absolute bottom-4 right-4 z-30 pointer-events-auto">
                    <Link
                      href={`/results/${p.id}`}
                      className="inline-flex items-center px-3 py-2 rounded-xl
                                 text-xs font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition"
                    >
                      Resultados
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="pt-8 border-t text-center text-sm text-gray-600">
        Uma plataforma para coletar dados, gerar informação e produzir conhecimento público confiável.
      </footer>
    </main>
  );
}
