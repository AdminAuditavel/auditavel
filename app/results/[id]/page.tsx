//app/results/[id]/page.tsx

import Link from "next/link";
import Image from "next/image";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { getResults } from "@/lib/getResults";
import AttributesInviteClient from "./AttributesInviteClient";

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | any;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const resolvedParams =
    params && typeof params.then === "function" ? await params : params;
  const { id } = resolvedParams ?? {};

  if (!id || typeof id !== "string" || id.trim() === "") {
    return (
      <main className="p-6 max-w-xl mx-auto text-center">
        <p className="text-foreground">ID da pesquisa inválido.</p>
      </main>
    );
  }

  const safeId = id.trim();

  // Exibe perfil/atributos apenas quando veio do fluxo de voto/alteração
  const fromVoteRaw = searchParams?.from_vote;
  const fromVote = Array.isArray(fromVoteRaw) ? fromVoteRaw[0] : fromVoteRaw;
  const showParticipantProfile = fromVote === "1";

  /* =======================
     POLL
  ======================= */
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select(
      "title, voting_type, status, show_partial_results, allow_multiple, max_votes_per_user"
    )
    .eq("id", safeId)
    .maybeSingle();

  if (!pollData || pollError) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center">
        <p className="text-foreground">Erro ao carregar a pesquisa.</p>
      </main>
    );
  }

  const {
    title,
    voting_type,
    status,
    show_partial_results,
    allow_multiple,
    max_votes_per_user,
  } = pollData;

  const canShowResults =
    status === "closed" ||
    ((status === "open" || status === "paused") && show_partial_results);

  if (!canShowResults) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Resultados</h1>
        <p className="text-sm text-[color:var(--foreground-muted)]">
          Os resultados serão divulgados ao final da votação.
        </p>
        <Link
          href={`/poll/${safeId}`}
          className="text-[color:var(--primary)] hover:underline"
        >
          ← Voltar para a pesquisa
        </Link>
      </main>
    );
  }

  const isPartial = status === "open" || status === "paused";

  // Regra canônica: allow_multiple=false => max=1; allow_multiple=true => max_votes_per_user (fallback 1)
  const effectiveMaxVotes = allow_multiple ? (max_votes_per_user ?? 1) : 1;

  const Navigation = () => (
    <div className="flex justify-between items-center mb-4 text-sm">
      <Link
        href={`/poll/${safeId}`}
        className="text-[color:var(--primary)] hover:underline"
      >
        ← Voltar para Opções
      </Link>
      <Link
        href="/"
        className="inline-flex items-center gap-2 hover:underline"
        aria-label="Voltar para a página inicial"
      >
        <Image
          src="/Logo_A-removebg-preview.png"
          alt="Auditável"
          width={36}
          height={24}
          className="h-8 w-6 shrink-0"
        />
        <span className="font-semibold text-sm text-[color:var(--primary)]">
          Auditável
        </span>
      </Link>
    </div>
  );

  // Footer compartilhado para exibir "Resultados parciais" / "Resultado Final"
  const ResultsFooter = ({
    isPartial,
    status,
    effectiveMaxVotes,
    totalParticipants,
    totalSubmissions,
  }: {
    isPartial: boolean;
    status: string;
    effectiveMaxVotes: number;
    totalParticipants: number;
    totalSubmissions: number;
  }) => {
    const leftLabel =
      status === "closed"
        ? "Resultado Final"
        : isPartial
        ? "Resultados parciais"
        : "";

    return (
      <div className="flex justify-between text-xs text-[color:var(--foreground-muted)]">
        <div className="text-left">
          {leftLabel ? <span>{leftLabel}</span> : null}
        </div>
        <div className="text-right">
          {effectiveMaxVotes > 1 ? (
            <span>
              Participantes: {totalParticipants} · Participações:{" "}
              {totalSubmissions}
            </span>
          ) : (
            <span>Participantes: {totalParticipants}</span>
          )}
        </div>
      </div>
    );
  };

  /* =======================
     SINGLE
  ======================= */
  if (voting_type === "single") {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", safeId);

    const { data: votes } = await supabase
      .from("votes")
      .select("option_id, participant_id")
      .eq("poll_id", safeId);

    const totalSubmissions = votes?.length || 0;
    const totalParticipants = new Set(
      (votes ?? []).map((v) => v.participant_id)
    ).size;

    const count: Record<string, number> = {};
    votes?.forEach((v) => {
      if (!v.option_id) return;
      count[v.option_id] = (count[v.option_id] || 0) + 1;
    });

    const sortedOptions =
      options
        ?.map((o) => ({
          ...o,
          votes: count[o.id] || 0,
        }))
        .sort((a, b) => b.votes - a.votes) || [];

    return (
      <main className="min-h-screen bg-surface p-6">
        <div className="max-w-xl mx-auto space-y-5">
          <div className="rounded-2xl bg-surface shadow-sm border border-border p-5 space-y-5">
            <Navigation />

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold leading-relaxed text-justify text-foreground">
                {title}
              </h1>
            </div>

            {sortedOptions.map((o) => {
              const pct = totalSubmissions
                ? Math.round((o.votes / totalSubmissions) * 100)
                : 0;

              return (
                <div key={o.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{o.option_text}</span>
                    <span className="text-[color:var(--foreground-muted)]">
                      {o.votes} votos ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-surface2 rounded">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <ResultsFooter
              isPartial={isPartial}
              status={status}
              effectiveMaxVotes={effectiveMaxVotes}
              totalParticipants={totalParticipants}
              totalSubmissions={totalSubmissions}
            />

            {showParticipantProfile && <AttributesInviteClient pollId={safeId} />}
          </div>

          <div className="text-center text-xs flex items-center justify-center gap-2 text-[color:var(--foreground-muted)]">
            <Image
              src="/Logo_A-removebg-preview.png"
              alt="Auditável"
              width={18}
              height={18}
              className="inline-block"
            />
            <span>Auditável — “O Brasil vota. Você confere.”</span>
          </div>
        </div>
      </main>
    );
  }

  /* =======================
     MULTIPLE
  ======================= */
  if (voting_type === "multiple") {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", safeId);

    const { data: votes } = await supabase
      .from("votes")
      .select("id, participant_id")
      .eq("poll_id", safeId);

    const voteIds = (votes ?? []).map((v) => v.id);

    const { data: marks } = voteIds.length
      ? await supabase
          .from("vote_options")
          .select("option_id")
          .in("vote_id", voteIds)
      : { data: [] as any[] };

    const totalSubmissions = votes?.length || 0;
    const totalParticipants = new Set(
      (votes ?? []).map((v) => v.participant_id)
    ).size;

    const count: Record<string, number> = {};
    marks?.forEach((m: any) => {
      count[m.option_id] = (count[m.option_id] || 0) + 1;
    });

    const sortedOptions =
      options
        ?.map((o) => ({
          ...o,
          marks: count[o.id] || 0,
        }))
        .sort((a, b) => b.marks - a.marks) || [];

    return (
      <main className="min-h-screen bg-surface p-6">
        <div className="max-w-xl mx-auto space-y-5">
          <div className="rounded-2xl bg-surface shadow-sm border border-border p-5 space-y-5">
            <Navigation />

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold leading-relaxed text-justify text-foreground">
                {title}
              </h1>
            </div>

            <p className="text-sm text-[color:var(--foreground-muted)]">
              Nesta pesquisa, cada participante pôde selecionar mais de uma
              opção. Os percentuais abaixo representam a proporção de
              participações em que cada opção foi marcada.
            </p>

            <div className="space-y-4">
              {sortedOptions.map((o) => {
                const pct = totalSubmissions
                  ? Math.round((o.marks / totalSubmissions) * 100)
                  : 0;

                return (
                  <div key={o.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{o.option_text}</span>
                      <span className="text-[color:var(--foreground-muted)]">
                        {o.marks} marcas ({pct}%)
                      </span>
                    </div>

                    <div className="h-2 bg-surface2 rounded">
                      <div
                        className="h-2 bg-primary rounded transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <ResultsFooter
              isPartial={isPartial}
              status={status}
              effectiveMaxVotes={effectiveMaxVotes}
              totalParticipants={totalParticipants}
              totalSubmissions={totalSubmissions}
            />

            {showParticipantProfile && <AttributesInviteClient pollId={safeId} />}
          </div>

          <div className="text-center text-xs flex items-center justify-center gap-2 text-[color:var(--foreground-muted)]">
            <Image
              src="/Logo_A-removebg-preview.png"
              alt="Auditável"
              width={18}
              height={18}
              className="inline-block"
            />
            <span>Auditável — “O Brasil vota. Você confere.”</span>
          </div>
        </div>
      </main>
    );
  }

  /* =======================
     RANKING
  ======================= */
  const json = await getResults(safeId);

  const scores = (json?.result ?? []).map((r: any) => Number(r.score) || 0);
  const maxScore = Math.max(...scores, 1);

  // para mostrar participantes/participações também no ranking, buscamos votes
  const { data: rankingVotes } = await supabase
    .from("votes")
    .select("id, participant_id")
    .eq("poll_id", safeId);

  const totalSubmissionsRanking = rankingVotes?.length || 0;
  const totalParticipantsRanking = new Set(
    (rankingVotes ?? []).map((v) => v.participant_id)
  ).size;

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="rounded-2xl bg-surface shadow-sm border border-border p-5 space-y-5">
          <Navigation />

          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold leading-relaxed text-justify text-foreground">
              {title}
            </h1>
          </div>

          {(json?.result ?? []).map((row: any, index: number) => {
            const pct = Math.round(((Number(row.score) || 0) / maxScore) * 100);
            return (
              <div key={row.option_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">
                    <strong>{index + 1}º</strong> — {row.option_text}
                  </span>
                  <span className="text-[color:var(--foreground-muted)]">
                    {row.score} pts
                  </span>
                </div>
                <div className="h-2 bg-surface2 rounded">
                  <div
                    className="h-2 bg-primary rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          <ResultsFooter
            isPartial={isPartial}
            status={status}
            effectiveMaxVotes={effectiveMaxVotes}
            totalParticipants={totalParticipantsRanking}
            totalSubmissions={totalSubmissionsRanking}
          />

          {showParticipantProfile && <AttributesInviteClient pollId={safeId} />}
        </div>

        <div className="text-center text-xs flex items-center justify-center gap-2 text-[color:var(--foreground-muted)]">
          <Image
            src="/Logo_A-removebg-preview.png"
            alt="Auditável"
            width={18}
            height={18}
            className="inline-block"
          />
          <span>Auditável — “O Brasil vota. Você confere.”</span>
        </div>
      </div>
    </main>
  );
}
