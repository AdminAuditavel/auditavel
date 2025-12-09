import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export default async function PollPage({ params }: { params: { id: string } }) {
  // Usando await para esperar a resolução do parâmetro
  const { id } = params;

  // Buscando os dados da pesquisa
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (pollError || !poll) return notFound();  // Retorna 404 se não encontrar a pesquisa

  // Buscando as opções de votação
  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", id);

  if (optionsError || !options) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Erro ao carregar as opções.</h1>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>
      <div className="space-y-3">
        {options?.map(o => (
          <button
            key={o.id}
            className="block w-full p-3 border rounded-lg hover:bg-gray-100"
          >
            {o.option_text}
          </button>
        ))}
      </div>
    </main>
  );
}
