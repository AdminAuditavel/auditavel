"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

function VoteButton({
  pollId,
  optionId,
  text,
  allowMultiple,
}: {
  pollId: string;
  optionId: string;
  text: string;
  allowMultiple: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleVote = async () => {
    setLoading(true);

    const userHash = localStorage.getItem("user_hash") || `anon_${Math.random().toString(36).substring(2)}`;
    localStorage.setItem("user_hash", userHash);

    try {
      if (allowMultiple) {
        // Permite múltiplos votos
        await supabase
          .from("votes")
          .upsert([{ poll_id: pollId, option_id: optionId, user_hash: userHash }]); // Upsert para somar votos
      } else {
        // Permite um único voto
        await supabase
          .from("votes")
          .upsert([{ poll_id: pollId, option_id: optionId, user_hash: userHash }]);
      }

      setLoading(false);
      alert("Voto registrado com sucesso!");
    } catch (error) {
      setLoading(false);
      alert("Erro ao registrar voto.");
    }
  };

  return (
    <button
      onClick={handleVote}
      disabled={loading}
      className="block w-full p-3 border rounded-lg hover:bg-gray-100"
    >
      {text}
    </button>
  );
}

export default VoteButton;
