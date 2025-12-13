import { supabaseServer as supabase } from "@/lib/supabase-server";
import { getResults } from "@/lib/getResults";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> | any }) {
  // Resolver params (compatível com Promise ou objeto)
  const resolvedParams = params && typeof params.then === "function" ? await params : params;
  const { id } = resolvedParams ?? {};

  // Log para diagnóstico
  console.log("RESULT PAGE — params (raw):", { id });
  console.log("RESULT PAGE — ID recebido:", id);

  // 1. GUARDA DE SEGURANÇA — impede erro se id vier vazio/bugado
  if (!id || typeof id !== "string" || id.trim() === "") {
    console.error("RESULT PAGE — ID inválido:", id);
    return (
      <main className="p-6 max-w-xl mx-auto">
        Erro: ID da enquete inválido.
      </main>
    );
  }

  const safeId = id.trim();

  // 2. Buscar dados da pesquisa (status + visibilidade + tipo de voto)
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select("voting_type, status, show_partial_results")
    .eq("id", safeId)
    .maybeSingle();

  console.log("RESULT PAGE — pollData:", pollData);
  console.log("RESULT PAGE — pollError:", pollError);

  if (!pollData) {
    console.error("Erro ao buscar poll:", pollError);
    return (
      <main className="p-6 max-w-xl mx-auto">
        Erro ao carregar a enquete.
      </main>
    );
  }

  const votingType = pollData.voting_type;
  const status = pollData.status;
  const showPartial = Boolean(pollData.show_partial_results);

  // 🔒 BLOQUEIO TOTAL PARA DRAFT
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

  // 🔐 REGRA CENTRAL DE VISIBILIDADE DE RESULTADOS
  const canShowResults =
    status === "closed" ||
    ((status === "open" || status === "paused") && showPartial);

  // Se NÃO pode mostrar resultados, encerra aqui
  if (!canShowResults) {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-4 text-center">
        <h1 className="text-2xl font-bold">Resultados</h1>

        <p className="text-sm text-muted-foreground">
          Os resultados desta pesquisa estão ocultos no momento.
        </p>

        {status === "open" && (
          <p className="text-xs text-muted-foreground">
            Os resultados serão exibidos após o encerramento da pesquisa.
          </p>
        )}
      </main>
    );
  }

  // ============================
  // RESULTADOS VISÍVEIS A PARTIR DAQUI
  // ============================

  const statusMessage =
    status === "paused"
      ? "Pesquisa pausada — resultados parciais até o momento."
      : status === "open"
      ? "Resultados parciais."
      : "Resultado final.";

  // 3. RESULTADO — VOTO ÚNICO
  if (votingType === "single") {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", safeId);

    const { data: votes } = await supabase
      .from("votes")
      .select("option_id")
      .eq("poll_id", safeId);

    const count: Record<string, number> = {};
    votes?.forEach((v: any) => {
      if (v.option_id) {
        count[v.option_id] = (count[v.option_id] || 0) + 1;
      }
    });

    return (
      <main className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold mb-1">Resultados</h1>
        <p className="text-xs text-muted-foreground">{statusMessage}</p>

        {options?.map((o: any) => (
          <div key={o.id} className="p-3 border rounded flex justify-between">
            <span>{o.option_text}</span>
            <b>{count[o.id] || 0} votos</b>
          </div>
        ))}
      </main>
    );
  }

  // 4. RESULTADO — RANKING / BORDA
  try {
    const json = await getResults(safeId);
    console.log("RESULT PAGE — resultados calculados internamente:", json);

    return (
      <main className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold mb-1">Resultados</h1>
        <p className="text-xs text-muted-foreground">{statusMessage}</p>

        {!json.result || json.result.length === 0 ? (
          <p>Nenhum voto ainda.</p>
        ) : (
          json.result.map((row: any, index: number) => (
            <div key={row.option_id} className="p-3 border rounded flex justify-between items-center">
              <span>
                <strong>{index + 1}º</strong> — {row.option_text}
              </span>
              <span className="font-bold">{row.score} pts</span>
            </div>
          ))
        )}
      </main>
    );
  } catch (err) {
    console.error("RESULT PAGE — erro ao obter resultados internamente:", err);
    return (
      <main className="p-6 max-w-xl mx-auto">
        Erro ao carregar resultados da pesquisa.
      </main>
    );
  }
}
