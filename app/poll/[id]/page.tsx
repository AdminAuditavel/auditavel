// app/poll/[id]/page.tsx

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOrCreateParticipantId } from '@/lib/participant';

import RankingOption from './RankingOption';

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from '@dnd-kit/core';

import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

function ensureUserHash(): string {
  let userHash = localStorage.getItem('auditavel_uid');
  if (!userHash) {
    userHash = crypto.randomUUID();
    localStorage.setItem('auditavel_uid', userHash);
  }
  return userHash;
}

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

  const [poll, setPoll] = useState<any | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [votingType, setVotingType] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // Identidade/controle
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [userHash, setUserHash] = useState<string | null>(null);

  // Participação / limite / cooldown
  const [hasParticipation, setHasParticipation] = useState(false);
  const [votesUsed, setVotesUsed] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // UI states
  const [rankingMessage, setRankingMessage] = useState<string | null>(null);
  const [multipleMessage, setMultipleMessage] = useState<string | null>(null);
  const [singleMessage, setSingleMessage] = useState<string | null>(null);

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectedSingleOption, setSelectedSingleOption] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Helpers derivados do poll
  const isOpen = poll?.status === 'open';

  const allowMultiple: boolean = Boolean(poll?.allow_multiple);

  const effectiveMaxVotesPerUser: number = useMemo(() => {
    // Definição canônica conforme seu critério:
    // allow_multiple=false => max_votes_per_user=1
    if (!poll) return 1;
    if (!allowMultiple) return 1;

    const raw = poll.max_votes_per_user;
    const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
    return Math.max(1, n);
  }, [poll, allowMultiple]);

  const voteCooldownSeconds: number = useMemo(() => {
    if (!poll) return 0;
    const raw = poll.vote_cooldown_seconds;
    const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    return Math.max(0, n);
  }, [poll]);

  const maxOptionsPerVote: number = useMemo(() => {
    if (!poll) return Infinity;
    return poll.max_options_per_vote !== null && poll.max_options_per_vote !== undefined
      ? Number(poll.max_options_per_vote)
      : Infinity;
  }, [poll]);

  const cooldownActive = cooldownRemaining > 0;

  const voteLimitReached = useMemo(() => {
    // Apenas para allow_multiple=true, pois allow_multiple=false é "editar voto" (último vale)
    if (!allowMultiple) return false;
    return votesUsed >= effectiveMaxVotesPerUser;
  }, [allowMultiple, votesUsed, effectiveMaxVotesPerUser]);

  const disableReason = useMemo(() => {
    if (!isOpen) return 'Esta enquete não está aberta para votação.';
    if (voteLimitReached)
      return `Limite de votos atingido (${effectiveMaxVotesPerUser}).`;
    if (cooldownActive)
      return `Aguarde ${cooldownRemaining}s para votar novamente.`;
    return null;
  }, [
    isOpen,
    voteLimitReached,
    effectiveMaxVotesPerUser,
    cooldownActive,
    cooldownRemaining,
  ]);

  const participationNotice = useMemo(() => {
    if (!hasParticipation) return null;

    if (!allowMultiple) {
      return 'Você já participou desta enquete. Você pode alterar seu voto. O último voto será contabilizado.';
    }
    return 'Você já votou nesta enquete. Você pode votar novamente (respeitando o limite e o tempo de espera).';
  }, [hasParticipation, allowMultiple]);

  // Carregamento principal
  useEffect(() => {
    let mounted = true;

    // Inicializar identidades locais
    const pid = getOrCreateParticipantId();
    const uh = ensureUserHash();
    if (mounted) {
      setParticipantId(pid);
      setUserHash(uh);
    }

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
      setVotingType(pollData.voting_type);

      const { data: optionsData } = await supabase
        .from('poll_options')
        .select('id, option_text')
        .eq('poll_id', safeId);

      if (mounted) {
        const opts = optionsData ?? [];
        setOptions(opts);
        setLoading(false);

        // Inicializar seleção do single (opcional)
        if (pollData.voting_type === 'single' && opts.length > 0) {
          setSelectedSingleOption(opts[0].id);
        }
      }
    };

    const refreshParticipation = async () => {
      // Regras por (poll_id, participant_id)
      const pidLocal = pid;

      // 1) Quantos votos já existem (para allow_multiple=true)
      // 2) Buscar "última atividade" para cooldown
      //    - para allow_multiple=false: provavelmente existe 1 voto que será atualizado => usar max(created_at, updated_at)
      //    - para allow_multiple=true: pega o voto mais recente por created_at (ou updated_at se preferir)
      //
      // Para simplificar e ficar consistente: pegar o voto mais recente e também o count.

      const { data: lastVote } = await supabase
        .from('votes')
        .select('id, created_at, updated_at')
        .eq('poll_id', safeId)
        .eq('participant_id', pidLocal)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: voteCount } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('poll_id', safeId)
        .eq('participant_id', pidLocal);

      if (!mounted) return;

      const used = typeof voteCount === 'number' ? voteCount : 0;
      setVotesUsed(used);
      setHasParticipation(used > 0);

      // Cooldown
      if (!lastVote || voteCooldownSeconds <= 0) {
        setCooldownRemaining(0);
        return;
      }

      const createdAt = lastVote.created_at ? new Date(lastVote.created_at).getTime() : 0;
      const updatedAt = lastVote.updated_at ? new Date(lastVote.updated_at).getTime() : 0;

      // Para voto único editável, updated_at precisa refletir alterações; se não existir, fallback em created_at.
      const lastActivityMs = Math.max(createdAt, updatedAt, createdAt);

      if (!lastActivityMs) {
        setCooldownRemaining(0);
        return;
      }

      const nowMs = Date.now();
      const elapsedSeconds = Math.floor((nowMs - lastActivityMs) / 1000);
      const remaining = Math.max(0, voteCooldownSeconds - elapsedSeconds);
      setCooldownRemaining(remaining);
    };

    fetchPollData().then(() => {
      refreshParticipation();
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeId, router, voteCooldownSeconds]);

  // Timer de countdown do cooldown (UX)
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const t = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [cooldownRemaining]);

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

  async function sendVote(payload: any, setMsg: (s: string | null) => void, defaultErr: string) {
    setMsg(null);

    const pid = participantId ?? getOrCreateParticipantId();
    const uh = userHash ?? ensureUserHash();

    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poll_id: safeId,
        participant_id: pid,
        user_hash: uh,
        ...payload,
      }),
    });

    if (!res.ok) {
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore
      }

      // Se sua API retornar remaining_seconds, já exibimos amigável
      if (data?.error === 'cooldown_active' && typeof data?.remaining_seconds === 'number') {
        setCooldownRemaining(Math.max(0, Math.floor(data.remaining_seconds)));
        setMsg(`Aguarde ${Math.floor(data.remaining_seconds)}s para votar novamente.`);
        return;
      }

      setMsg(data?.error ?? defaultErr);
      return;
    }

    router.push(`/results/${safeId}`);
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <div className="flex justify-between text-sm">
        <Link href="/" className="text-emerald-600 hover:underline">
          Auditável
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-emerald-600">{poll.title}</h1>

      {/* Avisos globais (participação / cooldown / limite / status) */}
      {participationNotice && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {participationNotice}
        </div>
      )}

      {disableReason && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          {disableReason}
        </div>
      )}

      {/* ================= RANKING ================= */}
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

              setOptions((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
              });
            }}
          >
            <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {options.map((opt, index) => (
                  <RankingOption key={opt.id} id={opt.id} text={opt.option_text} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {rankingMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {rankingMessage}
            </div>
          )}

          <button
            disabled={Boolean(disableReason) || options.length === 0}
            onClick={async () => {
              // ranking: envia lista ordenada completa
              await sendVote(
                { option_ids: options.map((o) => o.id) },
                setRankingMessage,
                'Erro ao enviar ranking.'
              );
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            Enviar classificação
          </button>
        </>
      )}

      {/* ================= MULTIPLE ================= */}
      {votingType === 'multiple' && (
        <>
          <p className="text-sm text-gray-600">
            {maxOptionsPerVote === Infinity
              ? 'Você pode selecionar uma ou mais opções.'
              : `Selecione até ${maxOptionsPerVote} opções.`}
          </p>

          <div className="space-y-2">
            {options.map((o) => {
              const selected = selectedOptions.includes(o.id);
              const limitReached =
                !selected && selectedOptions.length >= maxOptionsPerVote;

              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={limitReached || Boolean(disableReason)}
                  onClick={() => {
                    setMultipleMessage(null);

                    if (selected) {
                      setSelectedOptions((prev) => prev.filter((id) => id !== o.id));
                      return;
                    }

                    if (selectedOptions.length >= maxOptionsPerVote) {
                      setMultipleMessage(`Você pode selecionar no máximo ${maxOptionsPerVote} opções.`);
                      return;
                    }

                    setSelectedOptions((prev) => [...prev, o.id]);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition
                    ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-300 bg-white hover:border-emerald-400'
                    }
                    ${(limitReached || Boolean(disableReason)) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {o.option_text}
                </button>
              );
            })}
          </div>

          {multipleMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {multipleMessage}
            </div>
          )}

          <button
            disabled={
              Boolean(disableReason) || selectedOptions.length === 0
            }
            onClick={async () => {
              if (selectedOptions.length === 0) {
                setMultipleMessage('Selecione ao menos uma opção.');
                return;
              }

              await sendVote(
                { option_ids: selectedOptions },
                setMultipleMessage,
                'Erro ao registrar voto.'
              );
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            Enviar voto
          </button>
        </>
      )}

      {/* ================= SINGLE ================= */}
      {votingType === 'single' && (
        <>
          <p className="text-sm text-gray-600">
            Selecione uma opção.
          </p>

          <div className="space-y-2">
            {options.map((o) => {
              const selected = selectedSingleOption === o.id;

              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={Boolean(disableReason)}
                  onClick={() => {
                    setSingleMessage(null);
                    setSelectedSingleOption(o.id);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition
                    ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-300 bg-white hover:border-emerald-400'
                    }
                    ${Boolean(disableReason) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {o.option_text}
                </button>
              );
            })}
          </div>

          {singleMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {singleMessage}
            </div>
          )}

          <button
            disabled={Boolean(disableReason) || !selectedSingleOption}
            onClick={async () => {
              if (!selectedSingleOption) {
                setSingleMessage('Selecione uma opção.');
                return;
              }

              await sendVote(
                { option_id: selectedSingleOption },
                setSingleMessage,
                'Erro ao registrar voto.'
              );
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            Enviar voto
          </button>
        </>
      )}
    </main>
  );
}
