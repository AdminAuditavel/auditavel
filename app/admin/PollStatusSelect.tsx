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
      alert("Erro ao atualizar status");
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
