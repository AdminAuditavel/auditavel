import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: polls } = await supabase
    .from("polls")
    .select("id, title")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AUDITÁVEL</h1>

      <h2 className="font-medium text-lg mb-4">Pesquisas Ativas:</h2>

      {!polls || polls.length === 0 && (
        <p className="text-gray-500">Nenhuma pesquisa no momento.</p>
      )}

      <div className="space-y-3">
        {polls?.map((poll) => (
          <a
            key={poll.id}
            href={`/poll/${poll.id}`}
            className="block p-4 border rounded-lg hover:bg-gray-100 transition"
          >
            {poll.title}
          </a>
        ))}
      </div>
    </main>
  );
}
