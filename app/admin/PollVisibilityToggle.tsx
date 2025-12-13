'use client';

import { useState } from "react";

interface Props {
  pollId: string;
  initialValue: boolean;
}

export default function PollVisibilityToggle({ pollId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const newValue = !value;
    setValue(newValue);
    setLoading(true);

    const res = await fetch("/api/admin/poll-visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poll_id: pollId,
        show_partial_results: newValue,
      }),
    });

    if (!res.ok) {
      alert("Erro ao atualizar visibilidade");
      setValue(value);
    }

    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition
        ${value
          ? "bg-emerald-100 text-emerald-800"
          : "bg-gray-200 text-gray-700"}
        disabled:opacity-60`}
    >
      {value ? "Visível" : "Oculto"}
    </button>
  );
}
