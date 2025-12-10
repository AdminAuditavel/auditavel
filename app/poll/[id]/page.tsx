import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

// --- Componente Server (não alteramos a estrutura base) ---
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
          <VoteButton 
            key={o.id} 
            pollId={id} 
            optionId={o.id} 
            text={o.option_text} 
          />
        ))}
      </div>
    </main>
  );
}


// --- Componente Client (acrescentado no final do arquivo) ---
"use client";

import { useState } from "react";

function VoteButton({ pollId, optionId, text }: { pollId: string; optionId: string; text: string }) {
  const [loading, setLoading] = useState(false);

  async function vote() {
    setLoading(true);

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll_id: pollId, option_id: optionId }),
    });

    setLoading(false);

    if (res.ok) {
      alert("Voto registrado com sucesso!");
      // depois vamos redirecionar para /results/[id]
    } else {
      alert("Erro ao registrar voto.");
    }
  }

  return (
    <button
      onClick={vote}
      disabled={loading}
      className="block w-full p-3 border rounded-lg hover:bg-gray-100"
    >
      {loading ? "Registrando..." : text}
    </button>
  );
}
