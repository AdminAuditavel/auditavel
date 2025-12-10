import { supabase } from "@/lib/supabase";
import VoteClient from "./VoteClient";

export default async function PollPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (!poll) return <p>Pesquisa não encontrada.</p>;

  const { data: options } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", id);

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      <VoteClient pollId={id} options={options || []} />
    </main>
  );
}
