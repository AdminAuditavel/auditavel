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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);  // Novo estado para confirmação

  async function vote() {
    setLoading(true);

    // Identificador persistente no navegador
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
      alert("Voto registrado com sucesso!");
      setTimeout(() => {
        window.location.href = `/results/${pollId}`;
      }, 800);
    } else {
      alert("Erro ao registrar voto.");
    }
  }

  const handleVoteClick = () => {
    let hasVoted = localStorage.getItem("auditavel_voted"); // Verifica se já votou
    if (hasVoted) {
      setShowConfirmDialog(true); // Mostra a confirmação se já votou
    } else {
      vote(); // Se ainda não tiver votado, vota diretamente
      localStorage.setItem("auditavel_voted", "true");
    }
  };

  const confirmVoteChange = () => {
    vote();
    setShowConfirmDialog(false);
  };

  const cancelVoteChange = () => {
    setShowConfirmDialog(false);
  };

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
        <div className="confirmation-dialog">
          <p>Você já votou nesta pesquisa. Deseja alterar seu voto?</p>
          <button onClick={confirmVoteChange}>Sim</button>
          <button onClick={cancelVoteChange}>Não</button>
        </div>
      )}
    </div>
  );
}
