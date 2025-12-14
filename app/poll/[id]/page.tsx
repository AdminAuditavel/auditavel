// app/poll/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

import VoteButton from './VoteButton';
import RankingOption from './RankingOption';

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

export default function PollPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  /* =======================
     GUARDA
  ======================= */
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return (
      <main className="p-6 max-w-xl mx-auto text-center text-red-600">
        Erro interno: ID da pesquisa inválido.
      </main>
    );
  }

  const safeId = id.trim();

  const [userHasVoted, setUserHasVoted] = useState(false);
  const [poll, setPoll] = useState<any | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [votingType, setVotingType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ranking errors / cooldown
  const [rankingMessage, setRankingMessage] = useState<string | null>(null);

  /* =======================
     SENSORS
  ======================= */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  /* =======================
     FETCH
  ======================= */
  useEffect(() => {
    let mounted = true;

    const fetchPollData = async () => {
      try {
        const { data: pollData, error } = await supabase
          .from('polls')
          .select('*')
          .eq('id', safeId)
          .maybeSingle();

        if (!mounted) return;

        if (error || !pollData || pollData.status === 'draft') {
          router.replace('/404');
          return;
        }

        setPoll(pollData);
        setAllowMultiple(Boolean(pollData.allow_multiple));
        setVotingType(pollData.voting_type);

        const { data: optionsData } = await supabase
          .from('poll_options')
          .select('id, option_text')
          .eq('poll_id', safeId);

        if (!mounted) return;
        setOptions(optionsData ?? []);
      } catch {
        if (mounted) router.replace('/404');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const checkUserVote = async () => {
      const userHash = localStorage.getItem('auditavel_uid');
      if (!userHash) return;

      const { data } = await supabase
        .from('votes')
        .select('id')
        .eq('poll_id', safeId)
        .eq('user_hash', userHash)
        .limit(1);

      if (mounted) {
        setUserHasVoted(Boolean(data && data.length > 0));
      }
    };

    fetchPollData();
    checkUserVote();

    return () => {
      mounted = false;
    };
  }, [safeId, router]);

  /* =======================
     LOADING / ERRO
  ======================= */
  if (loading) {
    return <main className="p-6 max-w-xl mx-auto">Carregando…</main>;
  }

  if (!poll) {
    return (
      <main className="p-6 max-w-xl mx-auto text-center text-red-600">
        Erro ao carregar a pesquisa.
      </main>
    );
  }

  const isOpen = poll.status === 'open';
  const isPaused = poll.status === 'paused';
  const isClosed = poll.status === 'closed';

  /* =======================
     NAV
  ======================= */
  const Navigation = () => (
    <div className="flex justify-between items-center mb-4 text-sm">
      <Link href="/" className="text-emerald-600 hover:underline">
        Auditável
      </Link>

      {isClosed && (
        <Link
          href={`/results/${safeId}`}
          className="text-emerald-600 hover:underline"
        >
          Ver resultados →
        </Link>
      )}
    </div>
  );

  /* =======================
     RENDER
  ======================= */
  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <Navigation />

      <h1 className="text-2xl font-bold text-emerald-600">{poll.title}</h1>

      {/* ===== STATUS ===== */}
      {isPaused && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <strong>Pesquisa pausada.</strong> As opções estão visíveis, mas novas
          votações estão temporariamente desabilitadas.
        </div>
      )}

      {isClosed && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>Pesquisa encerrada.</strong> Não é mais possível votar.
        </div>
      )}

      {/* ===== ALERTAS (SOMENTE OPEN) ===== */}
      {isOpen && userHasVoted && votingType !== 'ranking' && !allowMultiple && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <strong>Atenção:</strong> você já votou nesta pesquisa. Ao escolher uma
          nova opção, seu voto anterior será substituído.
        </div>
      )}

      {isOpen && userHasVoted && votingType !== 'ranking' && allowMultiple && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Informação:</strong> você já votou nesta pesquisa e pode votar
          novamente. Cada novo voto será somado ao total.
        </div>
      )}

      {isOpen && userHasVoted && votingType === 'ranking' && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Informação:</strong> você já enviou uma classificação. Você pode
          reorganizar as opções e reenviar se desejar.
        </div>
      )}

      {/* ===== RANKING ===== */}
      {votingType === 'ranking' ? (
        <>
          <p className="text-sm text-gray-600">
            Arraste as opções para definir a ordem desejada.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;

              setOptions((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
              });
            }}
          >
            <SortableContext
              items={options.map(o => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {options.map((opt, index) => (
                  <RankingOption
                    key={opt.id}
                    id={opt.id}
                    text={opt.option_text}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {rankingMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {rankingMessage}
            </div>
          )}

          {isOpen && (
            <button
              onClick={async () => {
                setRankingMessage(null);

                let userHash = localStorage.getItem('auditavel_uid');
                if (!userHash) {
                  userHash = crypto.randomUUID();
                  localStorage.setItem('auditavel_uid', userHash);
                }

                const orderedIds = options.map(o => o.id);

                const res = await fetch('/api/vote', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    poll_id: safeId,
                    option_ids: orderedIds,
                    user_hash: userHash,
                  }),
                });

                if (!res.ok) {
                  const data = await res.json();
                  setRankingMessage(
                    data.message ??
                      data.error ??
                      'Não foi possível registrar sua classificação no momento.'
                  );
                  return;
                }

                window.location.href = `/results/${safeId}`;
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
            >
              Enviar classificação
            </button>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {options.map(o => (
            <VoteButton
              key={o.id}
              pollId={safeId}
              optionId={o.id}
              text={o.option_text}
              allowMultiple={allowMultiple}
              userHasVoted={userHasVoted}
              disabled={!isOpen}
            />
          ))}
        </div>
      )}
    </main>
  );
}
