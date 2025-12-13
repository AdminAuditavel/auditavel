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
        .select('option_id')
        .eq('poll_id', safeId)
        .eq('user_hash', userHash)
        .maybeSingle();

      if (mounted) setUserHasVoted(!!data);
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

  /* =======================
     STATUS
  ======================= */
  const statusLabel =
    poll.status === 'open'
      ? 'Aberta'
      : poll.status === 'paused'
      ? 'Pausada'
      : 'Encerrada';

  const statusColor =
    poll.status === 'open'
      ? 'bg-green-100 text-green-800'
      : poll.status === 'paused'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';

  /* =======================
     NAV
  ======================= */
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
     BLOQUEIOS
  ======================= */
  if (poll.status === 'paused') {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-5">
        <Navigation />

        <div>
          <h1 className="text-2xl font-bold text-emerald-600">
            {poll.title}
          </h1>
          <span
            className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          A votação desta pesquisa está temporariamente pausada.
        </p>
      </main>
    );
  }

  if (poll.status === 'closed') {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-5">
        <Navigation />

        <div>
          <h1 className="text-2xl font-bold text-emerald-600">
            {poll.title}
          </h1>
          <span
            className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Esta pesquisa já foi encerrada.
        </p>

        <Link
          href={`/results/${safeId}`}
          className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
        >
          Ver resultados
        </Link>
      </main>
    );
  }

  /* =======================
     OPEN — VOTAÇÃO
  ======================= */
  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <Navigation />

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-emerald-600">
          {poll.title}
        </h1>
        <span
          className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* INFO USUÁRIO */}
      {!allowMultiple && userHasVoted && (
        <p className="text-sm text-yellow-700">
          Você já votou, mas pode alterar seu voto.
        </p>
      )}

      {allowMultiple && userHasVoted && (
        <p className="text-sm text-emerald-700">
          Você já votou e pode votar novamente.
        </p>
      )}

      {/* OPTIONS */}
      {votingType === 'ranking' ? (
        <>
          <p className="text-sm text-gray-600">
            Arraste as opções para definir a ordem desejada.
          </p>

          <DndContext
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
              const userHash = localStorage.getItem('auditavel_uid');
              if (!userHash) {
                alert('Usuário não identificado');
                return;
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

              const data = await res.json();

              if (!res.ok) {
                alert(data.message ?? data.error ?? 'Erro ao votar');
                return;
              }

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
