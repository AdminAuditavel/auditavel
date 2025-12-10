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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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

      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poll_id: pollId,
          option_id: optionId,
          user_hash: uid,
        }),
      });

      setLoading(false);

      if (res.ok) {
        if (!allowMultiple) {
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
    // voto múltiplo: vota direto
    if (allowMultiple) {
      vote();
      return;
    }

    // se já votou, abrir confirmação local (interno ao VoteButton)
    if (userHasVoted) {
      setShowConfirmDialog(true);
      return;
    }

    // caso contrário, vota direto
    vote();
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

      {showConfirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" role="dialog" aria-modal="true">
          <div className="bg-white p-4 rounded shadow max-w-sm w-full mx-4">
            <p className="mb-4">Você já votou nesta pesquisa. Deseja alterar seu voto?</p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  vote();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Sim, alterar
              </button>

              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                }}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
