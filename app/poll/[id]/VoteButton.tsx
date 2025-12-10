"use client";

import { useState, useEffect } from "react";
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
  const [hasVoted, setHasVoted] = useState(false);
  const [currentVote, setCurrentVote] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já votou
    const checkUserVote = async () => {
      const { data, error } = await supabase
        .from("votes")
        .select("user_hash")
        .eq("poll_id", pollId)
        .eq("user_hash", localStorage.getItem("user_hash"))
        .single();
      if (data) {
        setHasVoted(true);
        setCurrentVote(data.option_id);
      } else {
        setHasVoted(false);
      }
    };

    checkUserVote();
  }, [pollId]);

  const handleVote = async () => {
    if (hasVoted && !allowMultiple) {
      setShowConfirmDialog(true);
      return;
    }

    setLoading(true);

    const userHash = localStorage.getItem("user_hash") || `anon_${Math.random().toString(36).substring(2)}`;
    localStorage.setItem("user_hash", userHash);

    try {
      if (hasVoted && allowMultiple) {
        // Permite alterar o voto
        await supabase
          .from("votes")
          .update({ option_id: optionId })
          .eq("poll_id", pollId)
          .eq("user_hash", userHash);
      } else {
        // Registra novo voto
        await supabase
          .from("votes")
          .insert([{ poll_id: pollId, option_id: optionId, user_hash: userHash }]);
      }

      // Atualiza o estado do voto
      setHasVoted(true);
      setCurrentVote(optionId);
      setLoading(false);
      alert("Voto registrado com sucesso!");
    } catch (error) {
      setLoading(false);
      alert("Erro ao registrar voto.");
    }
  };

  const handleConfirmVoteChange = () => {
    handleVote();
    setShowConfirmDialog(false);
  };

  return (
    <div>
      <button
        onClick={handleVote}
        disabled={loading}
        className="block w-full p-3 border rounded-lg hover:bg-gray-100"
      >
        {text}
      </button>

      {/* Dialog de confirmação */}
      {showConfirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg">
            <h3 className="text-xl">Você já votou!</h3>
            <p>Gostaria de alterar o seu voto?</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleConfirmVoteChange}
                className="mr-2 px-4 py-2 bg-blue-600 text-white rounded"
              >
                Sim
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-gray-300 text-black rounded"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoteButton;
