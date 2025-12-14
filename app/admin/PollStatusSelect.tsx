'use client';

import { useState } from "react";

type PollStatus = "draft" | "open" | "paused" | "closed";

interface Props {
  pollId: string;
  currentStatus: PollStatus;
}

export default function PollStatusSelect({ pollId, currentStatus }: Props) {
  const [status, setStatus] = useState<PollStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: PollStatus) {
    if (newStatus === status) return;

    // 🔒 CONFIRMAÇÃO AO FECHAR
    if (newStatus === "closed") {
      const confirmed = window.confirm(
        "Tem certeza que deseja ENCERRAR esta pesquisa?\n\n" +
        "• A votação será bloqueada definitivamente.\n" +
        "• Os resultados passarão a ser finais.\n\n" +
        "Essa ação pode ser revertida, mas deve ser feita com cautela."
      );

      if (!confirmed) {
        return;
      }
    }

    // ⚠️ ALERTA AO REABRIR PESQUISA ENCERRADA
    if (status === "closed" && newStatus !== "closed") {
      const confirmed = window.confirm(
        "Você está REABRINDO uma pesquisa já encerrada.\n\n" +
        "• Novos votos poderão ser registrados.\n" +
        "• Os resultados deixarão de ser finais.\n\n" +
        "Deseja continuar?"
      );

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);
    setStatus(newStatus);

    const res = await fetch("/api/admin/poll-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poll_id: pollId,
        status: newStatus,
      }),
    });

    if (!res.ok) {
      alert("Erro ao atualizar status da pesquisa.");
      setStatus(currentStatus);
    }

    setLoading(false);
  }

  return (
    <select
      value={status}
      disabled={loading}
      onChange={(e) => updateStatus(e.target.value as PollStatus)}
      className="rounded-md border px-2 py-1 text-sm bg-white disabled:opacity-60"
    >
      <option value="draft">Rascunho</option>
      <option value="open">Aberta</option>
      <option value="paused">Pausada</option>
      <option value="closed">Encerrada</option>
    </select>
  );
}
