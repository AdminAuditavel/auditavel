//app/results/[id]/page.tsx

import Link from "next/link";
import Image from "next/image";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { getResults } from "@/lib/getResults";
import AttributesInviteClient from "./AttributesInviteClient";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }> | any;
}) {
  const resolvedParams =
    params && typeof params.then === "function" ? await params : params;
  const { id } = resolvedParams ?? {};

  if (!id || typeof id !== "string" || id.trim() === "") {
    return (
      <main className="p-6 max-w-xl mx-auto text-center">
        ID da pesquisa inválido.
      </main>
    );
  }

  const safeId = id.trim();

  /* =======================
     POLL
  ======================= */
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select(
      "title, voting_type, status, show_partial_results, allow_multiple"
    )
    .eq("id", safeId)
    .maybeSingle();

  if (!pollData || pollError) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center">
        Erro ao carregar a pesquisa.
      </main>
    );
  }

  const {
    title,
    voting_type,
    status,
    show_partial_results,
    allow_multiple,
  } = pollData;

  const canShowResults =
    status === "closed" ||
    ((status === "open" || status === "paused") && show_partial_results);

  if (!canShowResults) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-xl font-semibold">Resultados</h1>
        <p className="text-sm text-muted-foreground">
          Os resultados serão divulgados ao final da votação.
        </p>
        <Link href={`/poll/${safeId}`} className="text-emerald-600 hover:underline">
          ← Voltar para a pesquisa
        </Link>
      </main>
    );
  }

  const isPartial = status === "open" || status === "paused";
  const isOpen = status === "open";

  const StatusBadge = () => {
    const variant =
      status === "open" ? "emerald" : status === "paused" ? "amber" : "gray";
    const text =
      status === "open" ? "Aberta" : status === "paused" ? "Pausada" : "Encerrada";

    const base =
      variant === "emerald"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : variant === "amber"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : "bg-gray-50 text-gray-600 border-gray-200";

    return (
      <span className={`px-2 py-1 rounded-full border text-xs ${base}`}>
        {text}
      </span>
    );
  };

  const Navigation = () => (
    <div className="flex justify-between items-center mb-4 text-sm">
      <Link href={`/poll/${safeId}`} className="text-emerald-600 hover:underline">
        ← Voltar para votação
      </Link>
      <Link
        href="/"
        className="inline-flex items-center gap-2 hover:underline"
        aria-label="Voltar para a página inicial"
      >
        <Image
          src="/Logo_A.png"
          alt="Auditável"
          width={36}
          height={24}
          className="h-8 w-6 shrink-0"
        />
        <span className="font-semibold text-sm" style={{ color: "#23854F" }}>
          Auditável
        </span>
      </Link>
    </div>
  );

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
      .select("option_id, user_hash")
      .eq("poll_id", safeId);

    const totalSubmissions = votes?.length || 0;
    const totalParticipants = new Set((votes ?? []).map((v) => v.user_hash))
      .size;

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
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-xl mx-auto space-y-5">
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 space-y-5">
            <Navigation />

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold leading-relaxed text-justify text-black">
                {title}
              </h1>
              <StatusBadge />
            </div>

            {sortedOptions.map((o) => {
              const pct = totalSubmissions
                ? Math.round((o.votes / totalSubmissions) * 100)
                : 0;

              return (
                <div key={o.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-black">{o.option_text}</span>
                    <span>
                      {o.votes} votos ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded">
                    <div
                      className="h-2 bg-emerald-500 rounded"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between text-xs text-gray-500">
              {isPartial && <span>Resultados parciais</span>}
              <span>Total de votos: {totalSubmissions}</span>
            </div>

            <AttributesInviteClient pollId={safeId} />
          </div>

          <div className="text-center text-xs flex items-center justify-center gap-2" style={{ color: "#8B8A8A" }}>
            <Image src="/Logo_A.png" alt="Auditável" width={18} height={18} className="inline-block" />
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
      .select("id, user_hash")
      .eq("poll_id", safeId);

    const { data: marks } = await supabase
      .from("vote_options")
      .select("option_id")
      .in(
        "vote_id",
        (votes ?? []).map((v) => v.id)
      );

    const totalSubmissions = votes?.length || 0;
    const totalParticipants = new Set((votes ?? []).map((v) => v.user_hash))
      .size;

    const count: Record<string, number> = {};
    marks?.forEach((m) => {
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
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-xl mx-auto space-y-5">
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 space-y-5">
            <Navigation />

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-black">{title}</h1>
              <StatusBadge />
            </div>

            <p className="text-sm text-gray-600">
              Nesta pesquisa, cada participante pôde selecionar mais de uma opção.
              Os percentuais abaixo representam a proporção de participações em que
              cada opção foi marcada.
            </p>

            <div className="space-y-4">
              {sortedOptions.map((o) => {
                const pct = totalSubmissions
                  ? Math.round((o.marks / totalSubmissions) * 100)
                  : 0;

                return (
                  <div key={o.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-black">{o.option_text}</span>
                      <span className="text-gray-600">
                        {o.marks} marcas ({pct}%)
                      </span>
                    </div>

                    <div className="h-2 bg-gray-200 rounded">
                      <div
                        className="h-2 bg-emerald-500 rounded transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              {isPartial && <span>Resultados parciais</span>}
              <span>
                Participantes: {totalParticipants} · Participações: {totalSubmissions}
              </span>
            </div>

            <AttributesInviteClient pollId={safeId} />
          </div>

          <div className="text-center text-xs flex items-center justify-center gap-2" style={{ color: "#8B8A8A" }}>
            <Image src="/Logo_A.png" alt="Auditável" width={18} height={18} className="inline-block" />
            <span>Auditável — “O Brasil vota. Você confere.”</span>
          </div>
        </div>
      </main>
    );
  }

  /* =======================
     RANKING (inalterado)
  ======================= */
  const json = await getResults(safeId);
  const maxScore = Math.max(...json.result.map((r: any) => r.score), 1);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 space-y-5">
          <Navigation />

          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-black">{title}</h1>
            <StatusBadge />
          </div>

          {json.result.map((row: any, index: number) => {
            const pct = Math.round((row.score / maxScore) * 100);
            return (
              <div key={row.option_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-black">
                    <strong>{index + 1}º</strong> — {row.option_text}
                  </span>
                  <span>{row.score} pts</span>
                </div>
                <div className="h-2 bg-gray-200 rounded">
                  <div
                    className="h-2 bg-emerald-500 rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          <AttributesInviteClient pollId={safeId} />
        </div>

        <div className="text-center text-xs flex items-center justify-center gap-2" style={{ color: "#8B8A8A" }}>
          <Image src="/Logo_A.png" alt="Auditável" width={18} height={18} className="inline-block" />
          <span>Auditável — “O Brasil vota. Você confere.”</span>
        </div>
      </div>
    </main>
  );
}
