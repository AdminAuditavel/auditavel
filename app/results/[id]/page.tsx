import { supabase } from "@/lib/supabase";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Buscar opções
  const { data: options } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", id);

  // Buscar votos e agrupar
  const { data: votes } = await supabase
    .from("votes")
    .select("option_id, votes_count");

  // Montar contagem
  const count: Record<string, number> = {};
  votes?.forEach(v => {
    count[v.option_id] = (count[v.option_id] || 0) + (v.votes_count || 1);
  });

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-4">Resultados</h1>

      {options?.map(o => (
        <div key={o.id} className="p-3 border rounded">
          {o.option_text}: <b>{count[o.id] || 0} votos</b>
        </div>
      ))}
    </main>
  );
}
