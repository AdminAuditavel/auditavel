// app/poll/[id]/page.tsx

'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  KeyboardSensor,
} from '@dnd-kit/core';

import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

function ensureUserHash(): string {
  let userHash = null;
  try {
    userHash = localStorage.getItem('auditavel_uid');
  } catch {
    // localStorage pode falhar em alguns ambientes; vamos continuar com fallback
  }
  if (!userHash) {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        userHash = crypto.randomUUID();
      } else {
        userHash = 'uid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
      try {
        localStorage.setItem('auditavel_uid', userHash);
      } catch {
        // ignore
      }
    } catch {
      // fallback simples
      userHash = 'uid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }
  return userHash;
}

// Parse seguro: se vier sem timezone, force UTC adicionando "Z"
function parseDbTs(ts?: string | null) {
  if (!ts) return 0;

  const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(ts);
  const safe = hasTz ? ts : `${ts}Z`;

  const ms = Date.parse(safe);
  return Number.isFinite(ms) ? ms : 0;
}

export default function PollPage() {
  // hooks do router/params podem ficar aqui
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const safeIdCandidate = typeof id === 'string' ? id.trim() : '';

  // ----------------------------
  // DECLARAÇÃO DE TODOS OS HOOKS
  // ----------------------------
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

  // Submitting lock
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Helpers derivados do poll
  const isOpen = poll?.status === 'open';
  const allowMultiple: boolean = Boolean(poll?.allow_multiple);

  const effectiveMaxVotesPerUser: number = useMemo(() => {
    if (!poll) return 1;
    if (!allowMultiple) return 1;
    const raw = poll.max_votes_per_user;
    const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
    return Math.max(1, Math.floor(n));
  }, [poll, allowMultiple]);

  const voteCooldownSeconds: number = useMemo(() => {
    if (!poll) return 0;
    const raw = poll.vote_cooldown_seconds;
    const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    return Math.max(0, Math.floor(n));
  }, [poll]);

  const maxOptionsPerVote: number = useMemo(() => {
    if (!poll) return Infinity;
    return poll.max_options_per_vote !== null && poll.max_options_per_vote !== undefined
      ? Number(poll.max_options_per_vote)
      : Infinity;
  }, [poll]);

  const cooldownActive = cooldownRemaining > 0;

  const voteLimitReached = useMemo(() => {
    if (!allowMultiple) return false;
    return votesUsed >= effectiveMaxVotesPerUser;
  }, [allowMultiple, votesUsed, effectiveMaxVotesPerUser]);

  const disableReason = useMemo(() => {
    if (!isOpen) return 'Esta enquete não está aberta para votação.';
    if (voteLimitReached) return `Limite de votos atingido (${effectiveMaxVotesPerUser}).`;
    if (cooldownActive) return `Aguarde ${cooldownRemaining}s para votar novamente.`;
    if (isSubmitting) return 'Enviando voto...';
    return null;
  }, [isOpen, voteLimitReached, effectiveMaxVotesPerUser, cooldownActive, cooldownRemaining, isSubmitting]);

  const participationNotice = useMemo(() => {
    if (!hasParticipation) return null;

    if (!allowMultiple) {
      return 'Você já participou desta enquete. Você pode alterar seu voto. O último voto será contabilizado.';
    }
    return 'Você já votou nesta enquete. Você pode votar novamente (respeitando o limite e o tempo de espera).';
  }, [hasParticipation, allowMultiple]);

  // ----------------------------
  // AGORA safeId e checagem de ID (APÓS hooks)
  // ----------------------------
  if (!safeIdCandidate || typeof id !== 'string' || safeIdCandidate === '') {
    return (
      <main className="p-6 max-w-xl mx-auto text-center text-red-600">
        Erro interno: ID da pesquisa inválido.
      </main>
    );
  }
  const safeId = safeIdCandidate;

  // Carregamento principal
  useEffect(() => {
    let mounted = true;

    // reset UI states ao trocar poll
    setRankingMessage(null);
    setMultipleMessage(null);
    setSingleMessage(null);
    setSelectedOptions([]);
    setSelectedSingleOption(null);
    setHasParticipation(false);
    setVotesUsed(0);
    setCooldownRemaining(0);

    // Inicializar identidades locais (protegido)
    let pid = null;
    let uh = null;
    try {
      pid = getOrCreateParticipantId();
    } catch (e) {
      console.error('getOrCreateParticipantId falhou:', e);
    }
    try {
      uh = ensureUserHash();
    } catch (e) {
      console.error('ensureUserHash falhou:', e);
    }
    if (mounted) {
      if (pid) setParticipantId(pid);
      if (uh) setUserHash(uh);
    }

    const fetchPollData = async () => {
      const { data: pollData } = await supabase.from('polls').select('*').eq('id', safeId).maybeSingle();

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
        setOptions(optionsData ?? []);
        setLoading(false);
      }
    };

    const refreshParticipation = async () => {
      const pidLocal = pid ?? getOrCreateParticipantId();

      // voto mais recente (para cooldown)
      const { data: lastVote } = await supabase
        .from('votes')
        .select('id, created_at, updated_at')
        .eq('poll_id', safeId)
        .eq('participant_id', pidLocal)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // total de votos (para limite quando allow_multiple=true)
      const { count } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('poll_id', safeId)
        .eq('participant_id', pidLocal);

      if (!mounted) return;

      const used = typeof count === 'number' ? count : 0;
      setVotesUsed(used);
      setHasParticipation(used > 0);

      // cooldown
      if (!lastVote || voteCooldownSeconds <= 0) {
        setCooldownRemaining(0);
        return;
      }

      const createdAtMs = parseDbTs(lastVote.created_at);
      const updatedAtMs = parseDbTs(lastVote.updated_at);

      let lastActivityMs = Math.max(createdAtMs, updatedAtMs, 0);

      if (!lastActivityMs) {
        setCooldownRemaining(0);
        return;
      }

      const nowMs = Date.now();
      if (lastActivityMs > nowMs) lastActivityMs = nowMs;

      const elapsedSeconds = Math.floor((nowMs - lastActivityMs) / 1000);
      const remaining = Math.max(0, voteCooldownSeconds - elapsedSeconds);
      setCooldownRemaining(remaining);
    };

    fetchPollData().then(() => {
      refreshParticipation();
    }).catch((err) => {
      console.error('Erro ao buscar poll:', err);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeId, router, voteCooldownSeconds]);

  // countdown local do cooldown
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

  const sendVote = useCallback(
    async (
      payload: Record<string, any>,
      setMsg: (s: string | null) => void,
      defaultErr: string
    ) => {
      if (isSubmitting) return;
      setMsg(null);
      setIsSubmitting(true);

      try {
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
            // ignore parse error
          }

          if (data?.error === 'cooldown_active' && typeof data?.remaining_seconds === 'number') {
            setCooldownRemaining(Math.max(0, Math.floor(data.remaining_seconds)));
            setMsg(`Aguarde ${Math.floor(data.remaining_seconds)}s para votar novamente.`);
            return;
          }

          if (data?.error === 'vote_limit_reached') {
            setMsg('Limite de votos atingido para esta enquete.');
            return;
          }

          if (data?.error === 'max_options_exceeded') {
            setMsg('Você selecionou mais opções do que o permitido.');
            return;
          }

          setMsg(data?.error ?? defaultErr);
          return;
        }

        // sucesso: redireciona para resultados
        router.push(`/results/${safeId}`);
      } catch (err) {
        setMsg((err as Error)?.message ?? 'Erro de rede ao enviar voto.');
      } finally {
        setIsSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participantId, userHash, safeId, router, isSubmitting]
  );

  return (
    <main className="p-6 max-w-xl mx-auto space-y-5">
      <div className="flex justify-between text-sm">
        <Link href="/" className="text-emerald-600 hover:underline">
          Auditável
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-emerald-600">{poll.title}</h1>

      {/* Avisos globais */}
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

      {/* região para mensagens dinâmicas para leitores de tela */}
      <div aria-live="polite" className="sr-only" />

      {/* contador de votos (quando aplicável) */}
      {allowMultiple && (
        <div className="text-sm text-gray-600">
          Votos usados: {votesUsed} / {effectiveMaxVotesPerUser}
        </div>
      )}

      {/* ================= RANKING ================= */}
      {votingType === 'ranking' && (
        <>
          <p className="text-sm text-gray-600">Arraste as opções para definir a ordem desejada.</p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;

              setOptions((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return items;
                return arrayMove(items, oldIndex, newIndex);
              });
            }}
          >
            <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2" role="list" aria-label="Opções ordenáveis">
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
            disabled={Boolean(disableReason) || options.length === 0 || isSubmitting}
            onClick={async () => {
              await sendVote({ option_ids: options.map((o) => o.id) }, setRankingMessage, 'Erro ao enviar ranking.');
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center gap-2"
            aria-disabled={Boolean(disableReason) || options.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
                </svg>
                Enviando...
              </>
            ) : (
              'Enviar classificação'
            )}
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

          <div className="text-sm text-gray-600">
            Selecionadas: {selectedOptions.length}
            {Number.isFinite(maxOptionsPerVote) ? ` / ${maxOptionsPerVote}` : ''}
          </div>

          <div className="space-y-2">
            {options.map((o) => {
              const selected = selectedOptions.includes(o.id);
              const limitReached = !selected && selectedOptions.length >= maxOptionsPerVote;

              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={limitReached || Boolean(disableReason) || isSubmitting}
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
                  aria-pressed={selected}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition
                    ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-300 bg-white hover:border-emerald-400'
                    }
                    ${(limitReached || Boolean(disableReason) || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}
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
            disabled={Boolean(disableReason) || selectedOptions.length === 0 || isSubmitting}
            onClick={async () => {
              if (selectedOptions.length === 0) {
                setMultipleMessage('Selecione ao menos uma opção.');
                return;
              }

              await sendVote({ option_ids: selectedOptions }, setMultipleMessage, 'Erro ao registrar voto.');
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center gap-2"
            aria-disabled={Boolean(disableReason) || selectedOptions.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
                </svg>
                Enviando...
              </>
            ) : (
              'Enviar voto'
            )}
          </button>
        </>
      )}

      {/* ================= SINGLE ================= */}
      {votingType === 'single' && (
        <>
          <p className="text-sm text-gray-600">Selecione uma opção.</p>

          <div className="space-y-2">
            {options.map((o) => {
              const selected = selectedSingleOption === o.id;

              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={Boolean(disableReason) || isSubmitting}
                  onClick={() => {
                    setSingleMessage(null);
                    setSelectedSingleOption(o.id);
                  }}
                  aria-pressed={selected}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition
                    ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-300 bg-white hover:border-emerald-400'
                    }
                    ${Boolean(disableReason) || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
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
            disabled={Boolean(disableReason) || !selectedSingleOption || isSubmitting}
            onClick={async () => {
              if (!selectedSingleOption) {
                setSingleMessage('Selecione uma opção.');
                return;
              }

              await sendVote({ option_id: selectedSingleOption }, setSingleMessage, 'Erro ao registrar voto.');
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center gap-2"
            aria-disabled={Boolean(disableReason) || !selectedSingleOption || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
                </svg>
                Enviando...
              </>
            ) : (
              'Enviar voto'
            )}
          </button>
        </>
      )}
    </main>
  );
}
