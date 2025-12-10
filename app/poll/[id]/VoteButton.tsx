"use client";

import { useState } from "react";

export default function VoteButton({
  pollId,
  optionId,
  text,
  allowMultiple,
  userHasVoted,
}: {
  pollId: string;
  optionId: string;
  text: string;
  allowMultiple: boolean;
  userHasVoted: boolean;  // Adicionando o parâmetro para saber se o usuário já votou
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
        user_hash: uid,
      }),
    });

    setLoading(false);

    if (res.ok) {
      // Só registra no storage se for voto único
      if (!allowMultiple) {
        localStorage.setItem(`voted_poll_${pollId}`, "true");
      }

      alert("Voto registrado com sucesso!");
      setTimeout(() => window.location.href = `/results/${pollId}`, 800);
    } else {
      alert("Erro ao registrar voto.");
    }
  }

  function handleVoteClick() {
    // Se for voto múltiplo, vota diretamente sem mostrar a mensagem
    if (allowMultiple) return vote();

    // Se já tiver votado, exibe a mensagem de confirmação
    if (userHasVoted) {
      setShowConfirmDialog(true);
      return;
    }

    // Se não tiver votado, registra o voto normalmente
    vote();
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
            <p className="mb-4">Você já votou nesta pesquisa. Deseja alterar seu voto?</p>

            <button
              onClick={() => { setShowConfirmDialog(false); vote(); }}
              className="mr-2 p-2 bg-green-600 text-white rounded"
            >
              Sim, alterar
            </button>

            <button
              onClick={() => setShowConfirmDialog(false)}
              className="p-2 bg-gray-300 rounded"
            >
              Não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
