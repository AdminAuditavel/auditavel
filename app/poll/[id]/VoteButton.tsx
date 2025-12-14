'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrCreateParticipantId } from "@/lib/participant";

interface VoteButtonProps {
  pollId: string;
  optionId: string;
  text: string;
  allowMultiple: boolean;
  userHasVoted: boolean;
}

export default function VoteButton({
  pollId,
  optionId,
  text,
  allowMultiple,
  userHasVoted,
}: VoteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  /* =======================
     GUARDA
  ======================= */
  if (!pollId || typeof pollId !== 'string' || pollId.trim() === '') {
    return (
      <p className="text-red-600 mt-2">
        Erro interno: ID da pesquisa ausente.
      </p>
    );
  }

  const safePollId = pollId.trim();

  /* =======================
     VOTE
  ======================= */
  async function vote() {
    if (loading) return;
    setLoading(true);
    setMessage(null);

    try {
      let uid = localStorage.getItem('auditavel_uid');
      if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem('auditavel_uid', uid);
      }
      
      const participantId = getOrCreateParticipantId();
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poll_id: safePollId,
          option_id: optionId,
          user_hash: uid,
          participant_id: participantId
        }),
      });

      if (!res.ok) {
        let errorText = 'Erro ao registrar voto.';

        try {
          const json = await res.json();

          if (json.error === 'cooldown_active') {
            const secs = json.remaining_seconds ?? 0;
            errorText = `Você deve esperar ${secs} segundo${secs > 1 ? 's' : ''} antes de votar novamente.`;
          } else if (json.message) {
            errorText = json.message;
          } else if (json.error) {
            errorText = json.error;
          }
        } catch {}

        setLoading(false);
        setMessage({ text: errorText, type: 'error' });
        return;
      }

      router.push(`/results/${safePollId}`);
    } catch (err) {
      setLoading(false);
      setMessage({ text: 'Erro ao registrar voto.', type: 'error' });
    }
  }

  function handleVoteClick() {
    if (allowMultiple) {
      vote();
    } else {
      const alreadyVoted = localStorage.getItem(`voted_poll_${safePollId}`);
      if (alreadyVoted) {
        setMessage({
          text: 'Você já votou nesta pesquisa, mas pode alterar seu voto.',
          type: 'error',
        });
      } else {
        vote();
      }
    }
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="space-y-1">
      <button
        onClick={handleVoteClick}
        disabled={loading}
        aria-disabled={loading}
        className="
          w-full
          p-4
          text-left
          border
          border-gray-200
          rounded-xl
          bg-white
          hover:bg-emerald-50
          hover:border-emerald-300
          transition
          disabled:opacity-60
          disabled:cursor-not-allowed
        "
      >
        <span className="text-sm font-medium text-gray-800">
          {loading ? 'Registrando voto…' : text}
        </span>
      </button>

      {message && (
        <p
          className={`text-xs ${
            message.type === 'success'
              ? 'text-emerald-600'
              : 'text-red-600'
          }`}
          role={message.type === 'error' ? 'alert' : undefined}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
