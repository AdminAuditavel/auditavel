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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);  // Exibe o aviso de confirmação
  const [hasVoted, setHasVoted] = useState<boolean>(false);  // Verifica se já votou
  const [voteInProgress, setVoteInProgress] = useState<boolean>(false);  // Controla se o voto está em andamento

  // Função para verificar se o usuário já votou
  const checkIfVoted = () => {
    const voted = localStorage.getItem(`voted_poll_${pollId}`);
    if (voted) {
      setHasVoted(true); // Atualiza o estado para true se o usuário já votou
    } else {
      setHasVoted(false); // Atualiza para false caso contrário
    }
  };

  // Função que envia o voto
  async function vote() {
    setVoteInProgress(true);
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
    setVoteInProgress(false);

    if (res.ok) {
      localStorage.setItem(`voted_poll_${pollId}`, "true");  // Marca como votado
      alert("Voto registrado com sucesso!");
      setTimeout(() => {
        window.location.href = `/results/${pollId}`;
      }, 800);
    } else {
      alert("Erro ao registrar voto.");
    }
  }

  // Função de clique no botão
  const handleVoteClick = () => {
    checkIfVoted(); // Verifica se o usuário já votou
    if (hasVoted) {
      setShowConfirmDialog(true); // Exibe a confirmação se já votou
    } else {
      vote();  // Se ainda não tiver votado, faz o voto diretamente
    }
  };

  // Função de confirmação de alteração de voto
  const confirmVoteChange = () => {
    vote();
    setShowConfirmDialog(false);  // Fecha a confirmação
  };

  // Função de cancelamento de alteração de voto
  const cancelVoteChange = () => {
    setShowConfirmDialog(false);  // Fecha a confirmação
  };

  return (
    <div>
      <button
        onClick={handleVoteClick}
        disabled={loading || voteInProgress}
        className="block w-full p-3 border rounded-lg hover:bg-gray-100"
      >
        {loading || voteInProgress ? "Registrando..." : text}
      </button>

      {/* Aviso de confirmação */}
      {showConfirmDialog && (
        <div className="confirmation-dialog">
          <p>Você já votou nesta pesquisa. Deseja alterar seu voto?</p>
          <div>
            <button onClick={confirmVoteChange} className="confirm-btn">
              Sim
            </button>
            <button onClick={cancelVoteChange} className="cancel-btn">
              Não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
