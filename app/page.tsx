export const dynamic = "force-dynamic";

import Image from "next/image";
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
  max_votes_per_user?: number | null;
  is_featured?: boolean | null;
  category?: string | null;
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
  if (vt === "multiple") return "Múltiplas Opções";
  return "Uma Opção";
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
  searchParams?: any;
}) {
  // Resolve searchParams early so header form can reflect `q` and we can filter results.
  const resolvedSearchParams =
    searchParams && typeof searchParams.then === "function"
      ? await searchParams
      : searchParams;

  const rawQ = resolvedSearchParams?.q;
  const q =
    typeof rawQ === "string"
      ? rawQ.trim()
      : Array.isArray(rawQ) && typeof rawQ[0] === "string"
      ? rawQ[0].trim()
      : undefined;

  // category param (used by menu)
  const rawCategory = resolvedSearchParams?.category;
  const activeCategory =
    typeof rawCategory === "string"
      ? rawCategory
      : Array.isArray(rawCategory) && typeof rawCategory[0] === "string"
      ? rawCategory[0]
      : "todas";

  /* =======================
     POLLS (com fallback se coluna category não existir)
  ======================= */
  const selectWithCategory =
    "id, title, description, start_date, end_date, voting_type, allow_multiple, status, show_partial_results, icon_url, max_votes_per_user, is_featured, category";

  const selectWithoutCategory =
    "id, title, description, start_date, end_date, voting_type, allow_multiple, status, show_partial_results, icon_url, max_votes_per_user, is_featured";

  let pollsData: Poll[] | null = null;

  // primeira tentativa: buscar incluindo category
  const attempt = await supabase
    .from("polls")
    .select(selectWithCategory)
    .order("created_at", { ascending: false });

  if (attempt.error) {
    // se falhar (ex.: coluna não existe), refaz sem category
    const retry = await supabase
      .from("polls")
      .select(selectWithoutCategory)
      .order("created_at", { ascending: false });

    pollsData = retry.data || null;
  } else {
    pollsData = attempt.data || null;
  }

  const polls: Poll[] = pollsData || [];
  let visiblePolls = polls.filter((p) => p.status !== "draft");

  // Filter by search query `q` if provided (procura em título e descrição)
  if (q && q.length > 0) {
    const ql = q.toLowerCase();
    visiblePolls = visiblePolls.filter((p) => {
      const t = p.title?.toLowerCase() || "";
      const d = p.description?.toLowerCase() || "";
      return t.includes(ql) || d.includes(ql);
    });
  }

  // Filter by category (se aplicável)
  if (activeCategory && activeCategory !== "todas") {
    if (activeCategory === "tendencias") {
      const featured = visiblePolls.filter((p) => p.is_featured === true);
      if (featured.length > 0) {
        visiblePolls = featured;
      }
      // se não houver featured, mantemos a lista atual (fallback)
    } else {
      // somente filtra por category se a propriedade estiver presente nos dados
      const hasCategoryField = polls.some((p) => typeof p.category !== "undefined");
      if (hasCategoryField) {
        const catKey = activeCategory.toLowerCase();
        visiblePolls = visiblePolls.filter(
          (p) => (p.category || "").toLowerCase() === catKey
        );
      }
      // se não houver campo category, não filtramos (mantemos todas)
    }
  }

  // Se lista vazia, renderiza header + menu + mensagem
  if (!visiblePolls.length) {
    return (
      <>
        {/* TOP BAR */}
        <header className="p-4 md:p-6 max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center">
            <Image
              src="/Logo_Auditavel.png"
              alt="Auditável"
              width={156}
              height={156}
              className="rounded-full object-cover"
            />
          </div>

          <form method="get" action="/" className="flex-1 max-w-xl">
            <label htmlFor="q" className="sr-only">Buscar pesquisas</label>
            <div className="flex items-center bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>

              <input
                id="q"
                name="q"
                defaultValue={q || ""}
                className="ml-3 w-full text-sm outline-none"
                placeholder="Buscar pesquisa, tema ou cidade..."
                aria-label="Buscar pesquisas"
              />
            </div>
          </form>
        </header>

        {/* CATEGORIES MENU */}
        <nav aria-label="Categorias" className="max-w-6xl mx-auto px-4 md:px-6">
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {[
              { key: "tendencias", label: "Tendências" },
              { key: "todas", label: "Todas" },
              { key: "politicas", label: "Políticas" },
              { key: "esportes", label: "Esportes" },
              { key: "cultura", label: "Cultura" },
              { key: "clima", label: "Clima" },
              { key: "economia", label: "Economia" },
            ].map((c) => {
              const isActive = activeCategory === c.key;
              const href = `/?category=${encodeURIComponent(c.key)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
              return (
                <li key={c.key} className="flex-shrink-0">
                  <Link
                    href={href}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="top" className="p-4 md:p-8 max-w-6xl mx-auto space-y-12">
          <p className="p-10 text-center">Nenhuma pesquisa disponível.</p>
        </main>
      </>
    );
  }

  // --- restante (featured / agrupamentos / render) ---
  // select featured poll from filtered visiblePolls
  const featuredFromUrl =
    (() => {
      const rawFeatured = resolvedSearchParams?.featured;
      const featuredId =
        typeof rawFeatured === "string"
          ? rawFeatured.trim()
          : Array.isArray(rawFeatured) && typeof rawFeatured[0] === "string"
          ? rawFeatured[0].trim()
          : undefined;
      return featuredId ? visiblePolls.find((x) => x.id === featuredId) : undefined;
    })() || undefined;

  const featuredFromAuto =
    visiblePolls.find((x) => x.is_featured === true) || undefined;

  const featuredPoll = featuredFromUrl || featuredFromAuto || visiblePolls[0];
  const otherPolls = visiblePolls.filter((x) => x.id !== featuredPoll.id);

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
  function computeTopBars(p: Poll) {
    const opts = optionsByPoll.get(p.id) || [];

    const show =
      p.status === "closed" ||
      ((p.status === "open" || p.status === "paused") && p.show_partial_results);

    const isRanking = p.voting_type === "ranking";

    let participants = 0;
    let topSingle: { text: string; percent: number }[] = [];
    let topRanking: { text: string; score: number }[] = [];

    if (!show) return { show, isRanking, participants, topSingle, topRanking };

    const pollVotes = votesByPoll.get(p.id) || [];
    const users = new Set(pollVotes.map((v) => v.user_hash));
    participants = users.size;

    if (!isRanking) {
      if (participants > 0) {
        const vt = p.voting_type; // "single" | "multiple"
        const count = new Map<string, number>();

        if (vt === "multiple") {
          // múltiplas opções: conta usuários únicos por opção (evita inflar)
          for (const o of opts) {
            const set = multiUsersByOption.get(o.id);
            if (set) count.set(o.id, set.size);
          }
        } else {
          // opção única: conta votos brutos (múltiplas participações podem repetir)
          for (const v of pollVotes) {
            if (!v.option_id) continue;
            count.set(v.option_id, (count.get(v.option_id) || 0) + 1);
          }
        }

        const maxVotes =
          typeof p.max_votes_per_user === "number" ? p.max_votes_per_user : null;

        const percentBase =
          vt === "single"
            ? maxVotes === 1
              ? participants
              : pollVotes.length
            : participants;

        topSingle = opts
          .map((o) => ({ text: o.option_text, n: count.get(o.id) || 0 }))
          .filter((o) => o.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .map((o) => ({
            text: o.text,
            percent: percentBase > 0 ? Math.round((o.n / percentBase) * 100) : 0,
          }));
      }
    } else {
      // ranking: mantém lógica atual
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

  const featuredShowResults =
    !!p &&
    (p.status === "closed" ||
      ((p.status === "open" || p.status === "paused") && p.show_partial_results));

  const featuredBars = p ? computeTopBars(p) : null;

  /* =======================
     RENDER
  ======================= */
  return (
    <>
      {/* TOP BAR */}
      <header className="p-4 md:p-6 max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center">
          <Image
            src="/Logo_Auditavel.png"
            alt="Auditável"
            width={36}
            height={36}
            className="rounded-full object-cover"
          />
        </div>

        <form method="get" action="/" className="flex-1 max-w-xl">
          <label htmlFor="q" className="sr-only">Buscar pesquisas</label>
          <div className="flex items-center bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm">
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            <input
              id="q"
              name="q"
              defaultValue={q || ""}
              className="ml-3 w-full text-sm outline-none"
              placeholder="Buscar pesquisa, tema ou cidade..."
              aria-label="Buscar pesquisas"
            />
          </div>
        </form>
      </header>

      {/* CATEGORIES MENU */}
      <nav aria-label="Categorias" className="max-w-6xl mx-auto px-4 md:px-6">
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "tendencias", label: "Tendências" },
            { key: "todas", label: "Todas" },
            { key: "politicas", label: "Políticas" },
            { key: "esportes", label: "Esportes" },
            { key: "cultura", label: "Cultura" },
            { key: "clima", label: "Clima" },
            { key: "economia", label: "Economia" },
          ].map((c) => {
            const isActive = activeCategory === c.key;
            const href = `/?category=${encodeURIComponent(c.key)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            return (
              <li key={c.key} className="flex-shrink-0">
                <Link
                  href={href}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id="top" className="p-4 md:p-8 max-w-6xl mx-auto space-y-12">
        {/* HERO */}
        <section className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-emerald-700">Auditável</h1>
          <p className="text-base md:text-lg font-medium text-gray-800">
            Onde decisões públicas podem ser verificadas.
          </p>
        </section>

        <hr className="border-gray-200" />

        {/* DESTAQUE */}
        {p ? (
          <div className="relative group rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-lg transition overflow-hidden">
            {/* overlay link - só em telas md+ para não bloquear controles mobile */}
            <Link
              href={`/poll/${p.id}`}
              aria-label={`Abrir pesquisa: ${p.title}`}
              className="absolute inset-0 z-20 hidden md:block"
            />

            {/* CONTEÚDO */}
            <div className="p-4 md:p-6 pb-4 md:pb-16 relative z-10">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* IMAGEM (full width em mobile, tamanho fixo em sm+/md+) */}
                <div className="w-full sm:w-40 h-44 sm:h-32 md:w-56 md:h-44 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  <PollImage
                    src={featuredIconSrc}
                    fallbackSrc={DEFAULT_POLL_ICON}
                    alt={p.title}
                    priority
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* META + TÍTULO */}
                <div className="flex-1 min-w-0">
                  {/* DATA + STATUS — agora sempre na mesma linha; o texto de data trunca se necessário */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-red-700 min-w-0 truncate">
                      Início: {formatDate(p.start_date)} · Fim: {formatDate(p.end_date)}
                    </span>

                    <span
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                        p.status
                      )}`}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </div>

                  {/* PERGUNTA (preto) */}
                  <h2 className="mt-3 text-lg md:text-2xl font-bold text-gray-900 leading-snug break-words">
                    {p.title}
                  </h2>

                  {/* LINHA: Pesquisa tipo + badges */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="text-gray-500">Pesquisa tipo:</span>

                    {/* BADGE do tipo */}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                      {featuredTypeLabel}
                    </span>

                    {/* BADGE participação */}
                    {(() => {
                      const maxVotes =
                        typeof p.max_votes_per_user === "number" ? p.max_votes_per_user : null;

                      const isSingleParticipation = maxVotes === 1;

                      const badgeClass = isSingleParticipation
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : "bg-sky-100 text-sky-800 border border-sky-200";

                      const badgeText = isSingleParticipation
                        ? "Participação Única"
                        : "Múltiplas Participações";

                      return (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
                        >
                          {badgeText}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ABAIXO: 60/40 */}
              <div className="mt-5 flex flex-col md:flex-row gap-6">
                {/* TEXTO — 60% */}
                <div className="md:w-3/5">
                  <p className="text-gray-700 leading-relaxed text-base text-left">
                    {p.description
                      ? p.description
                      : "Participe desta decisão e ajude a construir informação pública confiável."}
                  </p>
                </div>

                {/* POSIÇÕES — 40% */}
                {featuredShowResults && featuredBars && (
                  <div className="md:w-2/5">
                    {featuredBars.topSingle.length > 0 || featuredBars.topRanking.length > 0 ? (
                      <div className="space-y-2">
                        {(featuredBars.isRanking
                          ? featuredBars.topRanking
                          : featuredBars.topSingle
                        ).map((o, i) => {
                          const medal =
                            i === 0
                              ? "bg-yellow-400 text-yellow-900"
                              : i === 1
                              ? "bg-gray-300 text-gray-800"
                              : "bg-amber-700 text-amber-100";

                          return (
                            <div
                              key={i}
                              className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2"
                            >
                              <span
                                className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${medal}`}
                              >
                                {i + 1}º
                              </span>

                              <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 leading-snug break-words">
                                {o.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        Ainda não há dados suficientes para exibição.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BOTÕES para mobile — agora os dois na mesma linha: Participar à esquerda e Ver resultados à direita */}
              <div className="mt-4 md:hidden flex items-center justify-between gap-2">
                <Link
                  href={`/poll/${p.id}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition w-[48%] justify-center"
                >
                  {primaryCtaLabel(p)}
                </Link>

                {featuredShowResults && (
                  <Link
                    href={`/results/${p.id}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition w-[48%] justify-center"
                  >
                    Ver resultados
                  </Link>
                )}
              </div>
            </div>

            {/* BOTÕES (menores) — layout absoluto apenas para md+ */}
            <div className="absolute left-5 z-30 pointer-events-auto hidden md:flex md:bottom-6 bottom-5">
              <div className="flex items-center gap-2">
                <Link
                  href={`/poll/${p.id}`}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  {primaryCtaLabel(p)}
                </Link>

                {featuredShowResults && (
                  <Link
                    href={`/results/${p.id}`}
                    className="inline-flex items-center px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition"
                  >
                    Ver resultados
                  </Link>
                )}
              </div>
            </div>
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

              return (
                <div
                  key={p.id}
                  className="relative group border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {/* Clique promove para o card principal */}
                  <Link
                    href={`/?featured=${encodeURIComponent(p.id)}#top`}
                    aria-label={`Destacar pesquisa: ${p.title}`}
                    className="absolute inset-0 z-20"
                  />

                  {/* Conteúdo */}
                  <div className="relative z-10 pointer-events-none flex gap-4 p-4">
                    {/* IMAGEM */}
                    <div className="w-20 h-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <PollImage
                        src={iconSrc}
                        fallbackSrc={DEFAULT_POLL_ICON}
                        alt={p.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* TÍTULO + STATUS */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h4
                          className={`text-sm md:text-base font-semibold leading-snug ${titleColor(
                            p.status
                          )}`}
                        >
                          {p.title}
                        </h4>

                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColor(
                            p.status
                          )}`}
                        >
                          {statusLabel(p.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 🥇 PRIMEIRO COLOCADO (canto inferior direito) */}
                  {(() => {
                    const bars = computeTopBars(p);
                    if (!bars.show) return null;

                    const winner = !bars.isRanking
                      ? bars.topSingle[0]?.text
                      : bars.topRanking[0]?.text;

                    if (!winner) return null;

                   return (
                    <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 text-xs font-normal text-gray-900">
                      <span className="text-yellow-500 leading-none">🥇</span>
                      <span className="max-w-[120px] truncate">{winner}</span>
                    </div>
                  );
                  })()}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="pt-8 border-t text-center text-sm text-gray-600">
          Uma plataforma para coletar dados, gerar informação e produzir conhecimento público confiável.
        </footer>
      </main>
    </>
  );
}
