import { createClient } from "@supabase/supabase-js";

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Criar client do lado do servidor (Next.js server component)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Buscar dados da poll
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select("voting_type")
    .eq("id", id)
    .single();

  if (pollError || !pollData) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        Erro ao carregar a enquete.
      </main>
    );
  }

  const votingType = pollData.voting_type;

  // =========================================
  // MODO 1 — VOTO ÚNICO
  // =========================================
  if (votingType === "single") {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, option_text")
      .eq("poll_id", id);

    const { data: votes } = await supabase
      .from("votes")
      .select("option_id")
      .eq("poll_id", id);

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
          <div key={o.id} className="p-3 border rounded flex justify-between">
            <span>{o.option_text}</span>
            <b>{count[o.id] || 0} votos</b>
          </div>
        ))}
      </main>
    );
  }

  // =========================================
  // MODO 2 — RANKING (BORDA)
  // =========================================

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/api/results/${id}`, {
    cache: "no-store"
  });

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
