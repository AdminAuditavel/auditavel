'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

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

      const voteData = {
        poll_id: pollId,
        option_id: optionId,
        user_hash: uid,
      };

      // Se permitir múltiplos votos, insere uma nova linha de voto
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData),
      });

      setLoading(false);

      if (res.ok) {
        if (!allowMultiple) {
          // Se não permitir múltiplos votos, marca que já votou
          localStorage.setItem(`voted_poll_${pollId}`, 'true');
        }

        setMessage({ text: 'Voto registrado com sucesso!', type: 'success' });

        redirectTimer.current = setTimeout(() => {
          router.push(`/results/${pollId}`);
        }, 700);
      } else {
        let errorText = 'Erro ao registrar voto.';
        try {
          const json = await res.json();
          if (json?.error) errorText = json.error;
        } catch {
          /* ignore */
        }
        setMessage({ text: errorText, type: 'error' });
      }
    } catch (err) {
      console.error('Erro ao enviar voto:', err);
      setLoading(false);
      setMessage({ text: 'Erro ao registrar voto.', type: 'error' });
    }
  }

  function handleVoteClick() {
    // Se permitir múltiplos votos, vota diretamente
    if (allowMultiple) {
      vote();
      return;
    }

    // Se for voto único, verifica se já votou
    const alreadyVoted = localStorage.getItem(`voted_poll_${pollId}`);
    if (alreadyVoted) {
      setMessage({
        text: 'Você já votou nesta pesquisa. Deseja alterar seu voto?',
        type: 'error',
      });
      return;
    }

    vote(); // Registra o voto na primeira vez
  }

  return (
    <div>
      <button
        onClick={handleVoteClick}
        disabled={loading}
        className="block w-full p-3 border rounded-lg hover:bg-gray-100 disabled:opacity-60"
        aria-disabled={loading}
      >
        {loading ? 'Registrando...' : text}
      </button>

      {message && (
        <p
          className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
          role={message.type === 'error' ? 'alert' : undefined}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
