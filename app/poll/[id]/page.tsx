import { supabase } from "@/lib/supabase";

export default async function PollPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const { data: poll, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h2 className="text-lg font-bold">DEBUG TEMPORÁRIO</h2>

      <p><b>ID recebido:</b> {id}</p>

      <p><b>Resultado poll:</b> {poll ? "Encontrou" : "NÃO encontrou"}</p>

      {error && (
        <pre className="text-red-500">
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      <hr />

      {poll && (
        <>
          <h1 className="text-2xl font-bold">{poll.title}</h1>
          <p>{poll.description}</p>
        </>
      )}
    </main>
  );
}
