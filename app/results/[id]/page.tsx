import Link from "next/link";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { getResults } from "@/lib/getResults";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> | any }) {
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
    .select("title, voting_type, status, show_partial_results")
    .eq("id", safeId)
    .maybeSingle();

  if (!pollData || pollError) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center">
        Erro ao carregar a pesquisa.
      </main>
    );
  }

  const { title, voting_type, status, show_partial_results } = pollData;

  /* 🔒 DRAFT */
  if (status === "draft") {
    return (
      <main className="p-6 max-w-xl mx-auto text-center space-y-3">
        <h1 className="text-xl font-bold">Pesquisa indisponível</h1>
        <p className="text-sm text-muted-foreground">
          Esta pesquisa ainda não foi publicada.
        </p>
      </main>
    );
  }

  /* 🔐 VISIBILIDADE */
  const canShowResults =
    status === "closed" ||
    ((status === "open" || status === "paused") && show_partial_results);

  if (!canShowResults) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center space-y-3">
        <h1 className="text-xl font-semibold">Resultados</h1>
        <p className="text-sm text-muted-foreground">
          Os resultados desta pesquisa estão ocultos no momento.
        </p>
      </main>
    );
  }

  const statusMessage =
    status === "paused"
      ? "Pesquisa pausada — resultados parciais"
      : status === "open"
      ? "Resultados parciais"
      : "Resultado final";

  /* =======================
     BOTÕES DE NAVEGAÇÃO
  ======================= */
  const Navigation = () => (
    <div className="flex justify-between items-center mb-4 text-sm">
      <Link
        href={`/poll/${safeId}`}
        className="text-emerald-600 hover:underline"
      >
        ← Voltar para votação
      </Link>

      <Link href="/" className="text-emerald-600 hover:underline">
        Auditavél
      </Link>
    </div>
  );

  /* =======================
     VOTO ÚNICO
  ======================= */
  if (voting_type === "single") {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", safeId);

    const { data: votes } = await supabase
      .from("votes")
      .select("option_id")
      .eq("poll_id", safeId);

    const totalVotes = votes?.length || 0;
    const count: Record<string, number> = {};

    votes?.forEach(v => {
      if (!v.option_id) return;
      count[v.option_id] = (count[v.option_id] || 0) + 1;
    });

    // 🔢 Ordenar do mais votado para o menos votado
    const sortedOptions =
      options
        ?.map(o => ({
          ...o,
          votes: count[o.id] || 0,
        }))
        .sort((a, b) => b.votes - a.votes) || [];

    return (
      <main className="p-6 max-w-xl mx-auto space-y-5">
        <Navigation />

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-emerald-600">{title}</h1>
          <p className="text-xs text-muted-foreground">{statusMessage}</p>
        </div>

        {/* RESULTS */}
        <div className="space-y-4">
          {sortedOptions.map(o => {
            const pct = totalVotes
              ? Math.round((o.votes / totalVotes) * 100)
              : 0;

            return (
              <div key={o.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{o.option_text}</span>
                  <span className="text-gray-600">
                    {o.votes} votos ({pct}%)
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

        {/* TOTAL */}
        <div className="text-right text-xs text-gray-500">
          Total de votos: {totalVotes}
        </div>
      </main>
    );
  }

  /* =======================
     RANKING (BORDA)
  ======================= */
  const json = await getResults(safeId);
  const maxScore = Math.max(...json.result.map((r: any) => r.score), 1);

  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <Navigation />

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-emerald-600">{title}</h1>
        <p className="text-xs text-muted-foreground">{statusMessage}</p>
      </div>

      {/* RESULTS */}
      <div className="space-y-4">
        {json.result.map((row: any, index: number) => {
          const pct = Math.round((row.score / maxScore) * 100);

          return (
            <div key={row.option_id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  <strong>{index + 1}º</strong> — {row.option_text}
                </span>
                <span className="text-gray-600">{row.score} pts</span>
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

      {/* TOTAL */}
      <div className="text-right text-xs text-gray-500">
        Total de votos: {json.result.length}
      </div>
    </main>
  );
}
