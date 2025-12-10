import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import VoteButton from "./VoteButton";

export default async function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (!poll) return notFound();

  const { data: options } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", id);

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      <div className="space-y-3">
        {options?.map(o => (
          <VoteButton key={o.id} pollId={id} optionId={o.id} text={o.option_text} />
        ))}
      </div>
    </main>
  );
}
