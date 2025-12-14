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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  useEffect(() => {
    let mounted = true;

    const fetchPollData = async () => {
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

      if (mounted) setOptions(optionsData ?? []);
      setLoading(false);
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

      if (mounted) setUserHasVoted(Boolean(data && data.length > 0));
    };

    fetchPollData();
    checkUserVote();

    return () => {
      mounted = false;
    };
  }, [safeId, router]);

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

  const isVotingOpen = poll.status === 'open';

  const Navigation = () => (
    <div className="flex justify-between items-center mb-4 text-sm">
      <Link href="/" className="text-emerald-600 hover:underline">
        Auditável
      </Link>

      {poll.status === 'closed' && (
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
     PAUSED / CLOSED
  ======================= */
  if (poll.status === 'paused' || poll.status === 'closed') {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-5">
        <Navigation />

        <h1 className="text-2xl font-bold text-emerald-600">
          {poll.title}
        </h1>

        <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {poll.status === 'paused'
            ? 'Esta pesquisa está temporariamente pausada. A votação não está disponível no momento.'
            : 'Esta pesquisa foi encerrada. Não é mais possível votar.'}
        </div>
      </main>
    );
  }

  /* =======================
     OPEN — VOTAÇÃO
  ======================= */
  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <Navigation />

      <h1 className="text-2xl font-bold text-emerald-600">
        {poll.title}
      </h1>

      {/* ALERTAS DE VOTO — SOMENTE SE OPEN */}
      {isVotingOpen && userHasVoted && votingType !== 'ranking' && !allowMultiple && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <strong>Atenção:</strong> você já votou nesta pesquisa. Ao escolher uma nova opção,
          seu voto anterior será substituído.
        </div>
      )}

      {isVotingOpen && userHasVoted && votingType !== 'ranking' && allowMultiple && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Informação:</strong> você já votou nesta pesquisa e pode votar novamente.
          Cada novo voto será somado ao total.
        </div>
      )}

      {isVotingOpen && userHasVoted && votingType === 'ranking' && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Informação:</strong> você já enviou uma classificação.
          Pode reorganizar as opções e reenviar se desejar.
        </div>
      )}

      {/* OPTIONS */}
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

          <button
            onClick={async () => {
              let userHash = localStorage.getItem('auditavel_uid');
              if (!userHash) {
                userHash = crypto.randomUUID();
                localStorage.setItem('auditavel_uid', userHash);
              }

              const orderedIds = options.map(o => o.id);

              await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  poll_id: safeId,
                  option_ids: orderedIds,
                  user_hash: userHash,
                }),
              });

              window.location.href = `/results/${safeId}`;
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
          >
            Enviar classificação
          </button>
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
