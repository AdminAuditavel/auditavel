'use client';

import React, { useEffect, useState } from 'react';

interface Option {
  id: string;
  text: string;
}

interface RankingVoteProps {
  options: Option[];
  pollId: string;
}

export default function RankingVote({ options, pollId }: RankingVoteProps) {
  const [order, setOrder] = useState<string[]>(() => options.map((o) => o.id));

  useEffect(() => {
    // Sincroniza se as options mudarem externamente
    setOrder(options.map((o) => o.id));
  }, [options]);

  // Gera um user_hash simples e persistente no browser
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('user_hash')) {
        const uid =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? (crypto as any).randomUUID()
            : `uid_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('user_hash', uid);
      }
    } catch {
      // ignore
    }
  }, []);

  const getUserHash = () => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('user_hash') ?? '' : '';
    } catch {
      return '';
    }
  };

  const move = (from: number, to: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) move(index, index - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < order.length - 1) move(index, index + 1);
    }
  };

  const submitVote = async () => {
    const user_hash = getUserHash();
    if (!user_hash) {
      alert('Não foi possível identificar o usuário. Tente novamente.');
      return;
    }

    const payload = {
      poll_id: pollId,
      option_ids: order,
      user_hash,
    };

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        alert('Voto registrado com sucesso!');
      } else if (data?.error) {
        alert(`Erro: ${data.error} ${data?.message ? '- ' + data.message : ''}`);
      } else {
        alert('Erro ao registrar voto.');
      }
    } catch (err) {
      console.error('Erro ao enviar voto:', err);
      alert('Erro ao registrar voto.');
    }
  };

  const optionsById = new Map(options.map((o) => [o.id, o]));

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Classifique as opções</h3>

      <div role="list" aria-label="Ranking de opções" style={{ marginBottom: 16 }}>
        {order.map((id, idx) => {
          const option = optionsById.get(id);
          if (!option) return null;
          return (
            <div
              key={id}
              role="listitem"
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              aria-roledescription="draggable via buttons or arrows"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                marginBottom: 8,
                background: '#fff',
              }}
              data-option-id={id}
            >
              <span style={{ width: 28, textAlign: 'center', fontWeight: 600 }}>{idx + 1}</span>

              <div style={{ flex: 1 }}>{option.text}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => idx > 0 && move(idx, idx - 1)}
                  disabled={idx === 0}
                  aria-label={`Mover ${option.text} para cima`}
                  style={{
                    padding: '6px 8px',
                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                  }}
                >
                  ▲
                </button>
                <button
                  onClick={() => idx < order.length - 1 && move(idx, idx + 1)}
                  disabled={idx === order.length - 1}
                  aria-label={`Mover ${option.text} para baixo`}
                  style={{
                    padding: '6px 8px',
                    cursor: idx === order.length - 1 ? 'not-allowed' : 'pointer',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                  }}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <button
          onClick={submitVote}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          aria-label="Submeter classificação"
        >
          Submeter Classificação
        </button>
      </div>

      <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>
        Dica: use as setas do teclado quando um item estiver focado para mover rapidamente.
      </p>
    </section>
  );
}
