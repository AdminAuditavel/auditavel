"use client";

import { useState } from "react";

export default function VoteClient({ pollId, options }: { pollId: string; options: any[] }) {
  const [loading, setLoading] = useState(false);

  async function vote(option_id: string) {
    setLoading(true);

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll_id: pollId, option_id }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = `/results/${pollId}`;
    } else {
      alert("Erro ao registrar voto.");
    }
  }

  return (
    <div className="space-y-3">
      {options.map(o => (
        <button
          key={o.id}
          disabled={loading}
          onClick={() => vote(o.id)}
          className="block w-full p-3 border rounded-lg hover:bg-gray-100"
        >
          {loading ? "Registrando voto..." : o.option_text}
        </button>
      ))}
    </div>
  );
}
