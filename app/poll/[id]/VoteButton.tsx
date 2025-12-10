"use client";

import { useState } from "react";

export default function VoteButton({
  pollId,
  optionId,
  text
}: {
  pollId: string;
  optionId: string;
  text: string;
}) {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  async function vote() {
    setLoading(true);

    let uid = localStorage.getItem("auditavel_uid");
    if (!uid) {
      uid = crypto.randomUUID();
      localStorage.setItem("auditavel_uid", uid);
    }

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poll_id: pollId,
        option_id: optionId,
        user_hash: uid
      }),
    });

    setLoading(false);

    if (res.ok) {
      localStorage.setItem(`voted_poll_${pollId}`, "true");
      alert("Voto registrado com sucesso!");
      setTimeout(() => window.location.href = `/results/${pollId}`, 800);
    } else {
      alert("Erro ao registrar voto.");
    }
  }

  function handleVoteClick() {
    const alreadyVoted = localStorage.getItem(`voted_poll_${pollId}`);

    if (alreadyVoted) {
      setShowConfirmDialog(true);      // agora ativa imediatamente
      return;
    }

    vote();                             // primeira vez → vota direto
  }

  return (
    <div>
      <button
        onClick={handleVoteClick}
        disabled={loading}
        className="block w-full p-3 border rounded-lg hover:bg-gray-100"
      >
        {loading ? "Registrando..." : text}
      </button>

      {showConfirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-white p-4 rounded shadow text-center">
            <p className="mb-3">Você já votou nesta pesquisa. Deseja alterar seu voto?</p>

            <button
              onClick={() => { setShowConfirmDialog(false); vote(); }}
              className="mr-2 p-2 bg-green-600 text-white rounded"
            >
              Sim, alterar voto
            </button>

            <button
              onClick={() => setShowConfirmDialog(false)}
              className="p-2 bg-gray-300 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
