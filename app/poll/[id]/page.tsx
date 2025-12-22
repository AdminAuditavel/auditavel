// app/poll/[id]/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOrCreateParticipantId } from '@/lib/participant';
import Image from "next/image";

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

// Parse seguro: se vier sem timezone, force UTC adicionando "Z"
function parseDbTs(ts?: string | null) {
  if (!ts) return 0;

  // já tem timezone se terminar com Z/z ou com offset tipo +00:00 / -03:00
  const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(ts);
  const safe = hasTz ? ts : `${ts}Z`;

  const ms = Date.parse(safe);
  return Number.isFinite(ms) ? ms : 0;
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
    // Regra canônica:
    // allow_multiple=false => 1 (último voto vale, editável)
    // allow_multiple=true  => max_votes_per_user (fallback 1)
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
    // Limite só importa quando allow_multiple=true (pois cria votos novos)
    if (!allowMultiple) return false;
    return votesUsed >= effectiveMaxVotesPerUser;
  }, [allowMultiple, votesUsed, effectiveMaxVotesPerUser]);

  const disableReason = useMemo(() => {
    if (!isOpen) return 'Esta enquete não está aberta para votação.';
    if (voteLimitReached) return `Limite de participações atingido (${effectiveMaxVotesPerUser}).`;
    if (cooldownActive) return `Aguarde ${cooldownRemaining}s para participar novamente.`;
    return null;
  }, [isOpen, voteLimitReached, effectiveMaxVotesPerUser, cooldownActive, cooldownRemaining]);

  const participationNotice = useMemo(() => {
    if (!hasParticipation) return null;

    if (!allowMultiple) {
      return 'Você já participou desta enquete. Você pode alterar seu voto. O último voto será contabilizado.';
    }
    return 'Você já votou nesta enquete. Você pode votar novamente (respeitando o limite e o tempo de espera).';
  }, [hasParticipation, allowMultiple]);

  // 1) useMemo do mapa (usa options)
  const optionTextById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.id, o.option_text);
    return m;
  }, [options]);

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

    // Inicializar identidades locais
    const pid = getOrCreateParticipantId();
    const uh = ensureUserHash();
    if (mounted) {
      setParticipantId(pid);
      setUserHash(uh);
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
      const pidLocal = pid;

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

      // maior atividade (created ou updated)
      let lastActivityMs = Math.max(createdAtMs, updatedAtMs, 0);

      if (!lastActivityMs) {
        setCooldownRemaining(0);
        return;
      }

      // Clamp: se o timestamp vier no futuro (ex.: problema de timezone), não deixa estourar
      const nowMs = Date.now();
      if (lastActivityMs > nowMs) lastActivityMs = nowMs;

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

  async function sendVote(
    payload: Record<string, any>,
    setMsg: (s: string | null) => void,
    defaultErr: string
  ) {
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

      if (data?.error === 'cooldown_active' && typeof data?.remaining_seconds === 'number') {
        setCooldownRemaining(Math.max(0, Math.floor(data.remaining_seconds)));
        setMsg(`Aguarde ${Math.floor(data.remaining_seconds)}s para participar novamente.`);
        return;
      }

      if (data?.error === 'vote_limit_reached') {
        setMsg('Limite de participações atingido para esta enquete.');
        return;
      }

      if (data?.error === 'max_options_exceeded') {
        setMsg('Você selecionou mais opções do que o permitido.');
        return;
      }

      setMsg(data?.error ?? defaultErr);
      return;
    }

    router.push(`/results/${safeId}`);
  }

  // Chip (componente de UI)
  function Chip({ children }: { children: React.ReactNode }) {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
        {children}
      </span>
    );
  }
  
  // Notice (já existente)
  function Notice({
    variant,
    children,
  }: {
    variant: "info" | "warn" | "error";
    children: React.ReactNode;
  }) {
    const styles =
      variant === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : variant === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-gray-200 bg-gray-50 text-gray-800";
  
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
        {children}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
    <div className="p-6 max-w-xl mx-auto space-y-5">
      {/* Card principal */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 space-y-5 pb-24 md:pb-5">
        {/* TOPO */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            aria-label="Voltar para a página inicial"
          >
            <Image
              src="/Logotipo.png"
              alt="Auditável"
              width={96}
              height={28}
              priority
              className="h-6 md:h-7 w-auto shrink-0"
            />
          </Link>

          {/* Badges (simples, limpo e informativo) */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2 py-1 rounded-full border ${
                isOpen
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {isOpen ? "Aberta" : "Indisponível"}
            </span>

            {allowMultiple && (
              <span className="px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                Participações: {votesUsed}/{effectiveMaxVotesPerUser}
              </span>
            )}

            {cooldownRemaining > 0 && (
              <span className="px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                Cooldown: {cooldownRemaining}s
              </span>
            )}
          </div>
        </div>

        {/* TÍTULO */}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold leading-relaxed text-justify text-black">
            {poll.title}
          </h1>

          {/* Instrução curta por tipo de votação (mantém a tela limpa) */}
          {votingType === "ranking" && (
            <p className="text-sm text-gray-600">
              Arraste para ordenar. Depois, envie a classificação.
            </p>
          )}
          {votingType === "multiple" && (
            <p className="text-sm text-gray-600">
              {maxOptionsPerVote === Infinity
                ? "Selecione uma ou mais opções."
                : `Selecione até ${maxOptionsPerVote} opções.`}
            </p>
          )}
          {votingType === "single" && (
            <p className="text-sm text-gray-600">Selecione uma opção.</p>
          )}
        </div>

        {/* Avisos globais (mantidos, mas com acabamento melhor) */}
        {participationNotice && <Notice variant="warn">{participationNotice}</Notice>}

        {disableReason && <Notice variant="info">{disableReason}</Notice>}

        {/* ================= RANKING ================= */}
        {votingType === "ranking" && (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
        
                setOptions((prevOptions) => {
                  const oldIndex = prevOptions.findIndex((opt) => opt.id === active.id);
                  const newIndex = prevOptions.findIndex((opt) => opt.id === over.id);
                  return arrayMove(prevOptions, oldIndex, newIndex);
                });
              }}
            >
              <SortableContext
                items={options.map((opt) => opt.id)}
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
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {rankingMessage}
              </div>
            )}
        
            {/* CTA — DESKTOP */}
            <button
              type="button"
              disabled={Boolean(disableReason) || options.length === 0}
              onClick={async () => {
                await sendVote(
                  { option_ids: options.map((opt) => opt.id) },
                  setRankingMessage,
                  "Erro ao enviar ranking."
                );
              }}
              className="hidden md:block w-full px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                         active:scale-[0.99] disabled:opacity-50"
            >
              Enviar classificação
            </button>
        
            {/* CTA — MOBILE STICKY */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur">
              <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                  {disableReason
                    ? disableReason
                    : `Classificação pronta: ${options.length} opções`}
                </div>
        
                <button
                  type="button"
                  disabled={Boolean(disableReason) || options.length === 0}
                  onClick={async () => {
                    await sendVote(
                      { option_ids: options.map((opt) => opt.id) },
                      setRankingMessage,
                      "Erro ao enviar ranking."
                    );
                  }}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                             active:scale-[0.99] disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= MULTIPLE ================= */}
        {votingType === "multiple" && (
          <>
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
                        setMultipleMessage(
                          `Você pode selecionar no máximo ${maxOptionsPerVote} opções.`
                        );
                        return;
                      }
        
                      setSelectedOptions((prev) => [...prev, o.id]);
                    }}
                    className={`w-full px-4 py-3 rounded-xl border transition text-left
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                      active:scale-[0.99] flex items-start gap-3
                      ${
                        selected
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-gray-200 bg-white hover:border-emerald-300"
                      }
                      ${
                        limitReached || Boolean(disableReason)
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    aria-pressed={selected}
                  >
                    {/* Indicador */}
                    <span
                      className={`mt-1 h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                        selected
                          ? "border-emerald-600 bg-emerald-600"
                          : "border-gray-300 bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
        
                    {/* Texto */}
                    <span className="flex-1 text-justify leading-relaxed text-gray-900">
                      {o.option_text}
                    </span>
                  </button>
                );
              })}
            </div>
        
            {multipleMessage && <Notice variant="error">{multipleMessage}</Notice>}
        
            {/* Prévia da participação (chips) */}
            {selectedOptions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-600">Selecionadas:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedOptions.slice(0, 6).map((id) => (
                    <Chip key={id}>{optionTextById.get(id) ?? id}</Chip>
                  ))}
                  {selectedOptions.length > 6 && (
                    <Chip>+{selectedOptions.length - 6}</Chip>
                  )}
                </div>
              </div>
            )}
        
            {/* CTA — DESKTOP */}
            <button
              type="button"
              disabled={Boolean(disableReason) || selectedOptions.length === 0}
              onClick={() => {
                if (selectedOptions.length === 0) {
                  setMultipleMessage("Selecione ao menos uma opção.");
                  return;
                }
        
                void sendVote(
                  { option_ids: selectedOptions },
                  setMultipleMessage,
                  "Erro ao registrar participação."
                );
              }}
              className="hidden md:block w-full px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                         active:scale-[0.99] disabled:opacity-50"
            >
              Enviar participação
            </button>
        
            {/* CTA — MOBILE STICKY */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur">
              <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                  {disableReason
                    ? disableReason
                    : maxOptionsPerVote === Infinity
                      ? `Selecionadas: ${selectedOptions.length}`
                      : `Selecionadas: ${selectedOptions.length}/${maxOptionsPerVote}`}
                </div>
        
                <button
                  type="button"
                  disabled={Boolean(disableReason) || selectedOptions.length === 0}
                  onClick={() => {
                    if (selectedOptions.length === 0) {
                      setMultipleMessage("Selecione ao menos uma opção.");
                      return;
                    }
        
                    void sendVote(
                      { option_ids: selectedOptions },
                      setMultipleMessage,
                      "Erro ao registrar participação."
                    );
                  }}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                             active:scale-[0.99] disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= SINGLE ================= */}
        {votingType === "single" && (
          <>
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
                    className={`w-full px-4 py-3 rounded-xl border transition text-left
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                      active:scale-[0.99] flex items-start gap-3
                      ${
                        selected
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-gray-200 bg-white hover:border-emerald-300"
                      }
                      ${Boolean(disableReason) ? "opacity-50 cursor-not-allowed" : ""}`}
                    aria-pressed={selected}
                  >
                    {/* Indicador */}
                    <span
                      className={`mt-1 h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                        selected
                          ? "border-emerald-600 bg-emerald-600"
                          : "border-gray-300 bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
        
                    {/* Texto */}
                    <span className="flex-1 text-justify leading-relaxed text-gray-900">
                      {o.option_text}
                    </span>
                  </button>
                );
              })}
            </div>
        
            {singleMessage && <Notice variant="error">{singleMessage}</Notice>}
        
            {/* Prévia da participação (chip) */}
            {selectedSingleOption && (
              <div className="space-y-2">
                <div className="text-xs text-gray-600">Selecionada:</div>
                <div className="flex flex-wrap gap-2">
                  <Chip>{optionTextById.get(selectedSingleOption) ?? selectedSingleOption}</Chip>
                </div>
              </div>
            )}
        
            {/* CTA — DESKTOP */}
            <button
              type="button"
              disabled={Boolean(disableReason) || !selectedSingleOption}
              onClick={() => {
                if (!selectedSingleOption) {
                  setSingleMessage("Selecione uma opção.");
                  return;
                }
        
                void sendVote(
                  { option_id: selectedSingleOption },
                  setSingleMessage,
                  "Erro ao registrar participação."
                );
              }}
              className="hidden md:block w-full px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                         active:scale-[0.99] disabled:opacity-50"
            >
              Enviar participação
            </button>
        
            {/* CTA — MOBILE STICKY */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur">
              <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                  {disableReason
                    ? disableReason
                    : selectedSingleOption
                      ? "1 opção selecionada"
                      : "Selecione uma opção"}
                </div>
        
                <button
                  type="button"
                  disabled={Boolean(disableReason) || !selectedSingleOption}
                  onClick={() => {
                    if (!selectedSingleOption) {
                      setSingleMessage("Selecione uma opção.");
                      return;
                    }
        
                    void sendVote(
                      { option_id: selectedSingleOption },
                      setSingleMessage,
                      "Erro ao registrar participação."
                    );
                  }}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30
                             active:scale-[0.99] disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
        
      <div className="text-center text-xs" style={{ color: "#8B8A8A" }}>
        Auditável — “O Brasil vota. Você confere.”
      </div>
    </div>
  </main>
);
}
