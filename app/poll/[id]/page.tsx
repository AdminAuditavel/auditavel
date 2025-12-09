import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { vote } from "./actions";

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
    "use server"
    await vote(id, option_id, allow_multiple);
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{poll.title}</h1>

      <form className="space-y-3">
        {options?.map(o => (
          <button
            formAction={() => handleVote(o.id)}
            key={o.id}
            className="block w-full p-3 border rounded-lg hover:bg-gray-100"
          >
            {o.option_text}
          </button>
        ))}
      </form>
    </main>
  );
}
