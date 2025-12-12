export const dynamic = "force-dynamic";   // impede que vire estático
export const revalidate = 0;              // garante renderização dinâmica SEM cache

import { supabaseServer as supabase } from "@/lib/supabase-server";

export default async function ResultsPage({ params }: { params: { id: string } }) {
  // Log mínimo e seguro para diagnóstico
  console.log("RESULT PAGE — params (raw):", JSON.stringify(params));

  const { id } = params;

  console.log("RESULT PAGE — ID recebido:", id);

  // ============================================================
  // 1. GUARDA DE SEGURANÇA — impede erro se id vier vazio/bugado
  // ============================================================
  if (!id || typeof id !== "string" || id.trim() === "") {
    console.error("RESULT PAGE — ID inválido:", id);
    return (
      <main className="p-6 max-w-xl mx-auto">
        Erro: ID da enquete inválido.
      </main>
    );
  }

  const safeId = id.trim();

  // ============================================================
  // 2. Buscar dados da enquete
  // ============================================================
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select("voting_type")
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

  // ============================================================
  // 3. RESULTADO — VOTO ÚNICO
  // ============================================================
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
    votes?.forEach(v => {
      if (v.option_id) {
        count[v.option_id] = (count[v.option_id] || 0) + 1;
      }
    });

    return (
      <main className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold mb-4">Resultados (Voto Único)</h1>

        {options?.map(o => (
          <div
            key={o.id}
            className="p-3 border rounded flex justify-between"
          >
            <span>{o.option_text}</span>
            <b>{count[o.id] || 0} votos</b>
          </div>
        ))}
      </main>
    );
  }

  // ============================================================
  // 4. RESULTADO — RANKING / BORDA
  // ============================================================
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  console.log("RESULT PAGE — chamando API:", `${baseUrl}/api/results/${safeId}`);

  const res = await fetch(`${baseUrl}/api/results/${safeId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const apiError = await res.text();
    console.error("Erro ao buscar resultado (API):", apiError);

    return (
      <main className="p-6 max-w-xl mx-auto">
        Erro ao carregar resultados da pesquisa.
      </main>
    );
  }

  const json = await res.json();

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-4">Resultado — Ranking (Sistema Borda)</h1>

      {!json.result || json.result.length === 0 ? (
        <p>Nenhum voto ainda.</p>
      ) : (
        json.result.map((row: any, index: number) => (
          <div
            key={row.option_id}
            className="p-3 border rounded flex justify-between items-center"
          >
            <span>
              <strong>{index + 1}º</strong> — {row.option_text}
            </span>
            <span className="font-bold">{row.score} pts</span>
          </div>
        ))
      )}
    </main>
  );
}
