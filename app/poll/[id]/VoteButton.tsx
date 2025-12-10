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

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll_id: pollId, option_id: optionId }),
    });

    setLoading(false);

    if (res.ok) {
      alert("Voto registrado com sucesso!");
      setTimeout(() => {
        window.location.href = `/results/${pollId}`;
      }, 800); // 0.8s para o usuário visualizar a mensagem
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
