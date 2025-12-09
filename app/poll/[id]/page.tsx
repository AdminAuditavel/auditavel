import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export default async function PollPage({ params }: { params: { id: string } }) {
  console.log("📌 ID recebido:", params.id);

  const { data: poll, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", params.id)
    .single();

  console.log("📌 Resultado da query:", poll, "Erro:", error);

  if (!poll) return notFound();

  const { data: options } = await supabase
    .from("poll_options")
    .select("id, label")
    .eq("poll_id", params.id);

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{poll.title}</h1>

      <div className="space-y-3">
        {options?.map(o => (
          <button key={o.id} className="block w-full p-3 border rounded-lg hover:bg-gray-100">
            {o.label}
          </button>
        ))}
      </div>
    </main>
  );
}
