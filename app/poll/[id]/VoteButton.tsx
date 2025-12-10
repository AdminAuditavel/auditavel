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

  async function vote() {
    setLoading(true);

    // Identificador persistente por navegador (MVP de unicidade)
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
      }, 800); // tempo para o usuário ver a mensagem
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
