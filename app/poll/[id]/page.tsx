// app/poll/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOrCreateParticipantId } from "@/lib/participant";

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

  const [rankingMessage, setRankingMessage] = useState<string | null>(null);
  const [multipleMessage, setMultipleMessage] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    let mounted = true;

    const fetchPollData = async () => {
      const { data: pollData } = await supabase
        .from('polls')
        .select('*')
        .eq('id', safeId)
        .maybeSingle();

      if (!mounted || !pollData || pollData.status === 'draft') {
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

      if (mounted) {
        setOptions(optionsData ?? []);
        setLoading(false);
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

  const isOpen = poll.status === 'open';

  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <div className="flex justify-between text-sm">
        <Link href="/" className="text-emerald-600 hover:underline">
          Auditável
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-emerald-600">{poll.title}</h1>

      {/* ===== RANKING ===== */}
      {votingType === 'ranking' && (
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

              setOptions(items => {
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

          {isOpen && (
            <button
              onClick={async () => {
                const userHash =
                  localStorage.getItem('auditavel_uid') ??
                  crypto.randomUUID();

                localStorage.setItem('auditavel_uid', userHash);
                const participantId = getOrCreateParticipantId();

                const res = await fetch('/api/vote', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    poll_id: safeId,
                    option_ids: options.map(o => o.id),
                    user_hash: userHash,
                    participant_id: participantId,
                  }),
                });

                if (!res.ok) {
                  const data = await res.json();
                  setRankingMessage(data.error ?? 'Erro ao votar');
                  return;
                }

                router.push(`/results/${safeId}`);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
            >
              Enviar classificação
            </button>
          )}
        </>
      )}

      {/* ===== MULTIPLE ===== */}
      {votingType === 'multiple' && (
        <>
          <p className="text-sm text-gray-600">
            Você pode selecionar uma ou mais opções.
          </p>

          <div className="space-y-2">
            {options.map(o => (
              <label
                key={o.id}
                className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(o.id)}
                  onChange={() => {
                    setSelectedOptions(prev =>
                      prev.includes(o.id)
                        ? prev.filter(id => id !== o.id)
                        : [...prev, o.id]
                    );
                  }}
                />
                <span>{o.option_text}</span>
              </label>
            ))}
          </div>

          {multipleMessage && (
            <div className="text-sm text-red-600">{multipleMessage}</div>
          )}

          {isOpen && (
            <button
              disabled={selectedOptions.length === 0}
              onClick={async () => {
                setMultipleMessage(null);

                const userHash =
                  localStorage.getItem('auditavel_uid') ??
                  crypto.randomUUID();

                localStorage.setItem('auditavel_uid', userHash);
                const participantId = getOrCreateParticipantId();

                const res = await fetch('/api/vote', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    poll_id: safeId,
                    option_ids: selectedOptions,
                    user_hash: userHash,
                    participant_id: participantId,
                  }),
                });

                if (!res.ok) {
                  const data = await res.json();
                  setMultipleMessage(data.error ?? 'Erro ao votar');
                  return;
                }

                router.push(`/results/${safeId}`);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
            >
              Enviar voto
            </button>
          )}
        </>
      )}

      {/* ===== SINGLE ===== */}
      {votingType === 'single' && (
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
