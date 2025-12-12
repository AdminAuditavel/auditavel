import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: polls } = await supabase
    .from("polls")
    .select("id, title")
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>

      {!polls?.length && <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>}

      {polls?.map(p => (
        <Link
          key={p.id}
          href={`/poll/${p.id}`}
          className="block p-4 border rounded-lg hover:bg-gray-50"
        >
          {p.title}
        </Link>
      ))}
    </main>
  );
}
