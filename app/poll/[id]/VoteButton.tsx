'use client';

import React, { useState } from 'react';
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

      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData),
      });

      // ------------------------------------------------------
      // TRATAMENTO DE ERRO / COOLDOWN
      // ------------------------------------------------------
      if (!res.ok) {
        let errorText = "Erro ao registrar voto.";

        try {
          const json = await res.json();

          if (json.error === "cooldown_active") {
            const secs = json.remaining_seconds ?? 0;
            errorText = `Você deve esperar ${secs} segundo${secs > 1 ? "s" : ""} antes de votar novamente.`;
          }
          else if (json.message) {
            errorText = json.message;
          }
          else if (json.error) {
            errorText = json.error;
          }

        } catch {
          // mantém erro genérico
        }

        setLoading(false);
        setMessage({ text: errorText, type: "error" });
        return;
      }

      // ------------------------------------------------------
      // SUCESSO: Redirecionar imediatamente para resultados
      // ------------------------------------------------------
      router.push(`/results/${pollId}`);
      return;

    } catch (err) {
      console.error('Erro ao registrar voto:', err);
      setLoading(false);
      setMessage({ text: 'Erro ao registrar voto.', type: 'error' });
    }
  }

  function handleVoteClick() {
    if (allowMultiple) {
      vote();
    } el
