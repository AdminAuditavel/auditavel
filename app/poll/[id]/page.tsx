'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VoteButton from './VoteButton';
import RankingOption from './RankingOption';

export default function PollPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [userHasVoted, setUserHasVoted] = useState(false);
  const [poll, setPoll] = useState<any | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [votingType, setVotingType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const fetchPollData = async () => {
      try {
        const { data: pollData, error } = await supabase
          .from('polls')
          .select('*')
          .eq('id', id)
          .single();

        if (!mounted) return;

        if (error || !pollData) {
          router.replace('/404');
          return;
        }

        setPoll(pollData);
        setAllowMultiple(Boolean(pollData.allow_multiple));
        setVotingType(pollData.voting_type);

        const { data: optionsData } = await supabase
          .from('poll_options')
          .select('id, option_text')
          .eq('poll_id', id);

        if (!mounted) return;
        setOptions(optionsData ?? []);
      } catch (err) {
        console.error('Erro ao buscar a poll:', err);
        if (mounted) router.replace('/404');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const checkUserVote = async () => {
      try {
        const userHash = localStorage.getItem('auditavel_uid');
        if (!userHash) {
          setUserHasVoted(false);
          return;
        }

        const { data: voteData } = await supabase
          .from('votes')
          .select('option_id')
          .eq('poll_id', id)
          .eq('user_hash', userHash)
          .single();

        if (!mounted) return;
        setUserHasVoted(!!voteData);
      } catch (err) {
        console.error('Erro ao verificar voto do usuário:', err);
        if (mounted) setUserHasVoted(false);
      }
    };

    fetchPollData();
    checkUserVote();

    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (loading) {
    return <main className="p-6 max-w-xl mx-auto">Carregando...</main>;
  }

  if (!poll) return null;

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      {allowMultiple === false && userHasVoted && (
        <p className="text-red-500 mb-4">
          Você já votou nesta pesquisa mas pode alterar seu voto?
        </p>
      )}

      {allowMultiple === true && userHasVoted && (
        <p className="text-green-500 mb-4">
          Você já votou nesta pesquisa, mas pode votar novamente! Um novo voto será somado ao total.
        </p>
      )}

      {/* =======================================================
          MODO RANKING (voting_type = "ranking")
      ======================================================= */}
      {votingType === "ranking" ? (
        <>
          <p className="mb-3 text-sm text-gray-600">
            Reorganize as opções na ordem desejada e clique em Enviar classificação.
          </p>

          <div className="space-y-2 mb-4">
            {options.map((opt, index) => (
              <RankingOption
                key={opt.id}
                text={opt.option_text}
                index={index}
                moveUp={() => {
                  if (index === 0) return;
                  const reordered = [...options];
                  [reordered[index - 1], reordered[index]] =
                    [reordered[index], reordered[index - 1]];
                  setOptions(reordered);
                }}
                moveDown={() => {
                  if (index === options.length - 1) return;
                  const reordered = [...options];
                  [reordered[index], reordered[index + 1]] =
                    [reordered[index + 1], reordered[index]];
                  setOptions(reordered);
                }}
              />
            ))}
          </div>

          <button
            onClick={async () => {
              const userHash = localStorage.getItem('auditavel_uid');
              if (!userHash) {
                alert("Usuário não identificado");
                return;
              }

              const orderedIds = options.map(o => o.id);

              const res = await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  poll_id: id,
                  option_ids: orderedIds,
                  user_hash: userHash,
                }),
              });

              const data = await res.json();

              if (!res.ok) {
                alert('Erro ao enviar classificação: ' + (data.message ?? data.error ?? 'Erro desconhecido'));
                return;
              }

              // redirecionamento automático
              window.location.href = `/results/${id}`;
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Enviar classificação
          </button>
        </>
      ) : (
        /* =======================================================
            MODO VOTO ÚNICO (voting_type = "single")
        ======================================================= */
        <div className="space-y-3">
          {options.map((o) => (
            <VoteButton
              key={o.id}
              pollId={id as string}
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
