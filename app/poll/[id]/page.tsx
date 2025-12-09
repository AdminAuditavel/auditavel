import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { vote } from "../../../actions";  // Corrigido para o caminho correto

export default async function PollPage({ params }: { params: { id: string } }) {
  const { data: poll } = await supabase
    .from("polls")
    .select("id, title, description, allow_multiple")
    .eq("id", params.id)
    .single();

  if (!poll) return notFound();
  const { id, title, description, allow_multiple } = poll;

  const { data: options } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", params.id);

  async function handleVote(option_id: string) {
    const result = await vote(id, option_id, allow_multiple);  // Chamando a função vote
    if (result.error) {
      alert(result.error);  // Exibe um erro caso o voto não seja aceito
    } else {
      alert("Voto registrado com sucesso!");
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      {description && <p className="mb-4 text-gray-600">{description}</p>}

      <form className="space-y-3">
        {options?.map(o => (
          <button
            key={o.id}
            onClick={() => handleVote(o.id)} 
            className="block w-full p-3 border rounded-lg hover:bg-gray-100"
          >
            {o.option_text}
          </button>
        ))}
      </form>
    </main>
  );
}
