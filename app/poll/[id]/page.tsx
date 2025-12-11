'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VoteButton from './VoteButton';
import RankingVote from '@/components/RankingVote';

export default function PollPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [poll, setPoll] = useState<any | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let mounted = true;

    const load = async () => {
      // Carrega poll
      const { data: pollData, error: pollErr } = await supabase
        .from('polls')
        .select('*')
        .eq('id', id)
        .single();

      if (pollErr || !pollData) {
        router.replace('/404');
        return;
      }

      if (!mounted) return;

      setPoll(pollData);

      // Carrega opções da pesquisa
      const { data: optionsData } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', id);

      if (mounted) {
        setOptions(optionsData ?? []);
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (loading) return <main className="p-6 max-w-xl mx-auto">Carregando...</main>;
  if (!poll) return null;

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      {/* Se for votação de RANKING */}
      {poll.voting_type === 'ranking' && (
        <RankingVote pollId={id} options={options} />
      )}

      {/* Se for votação NORMAL (single ou multiple) */}
      {poll.voting_type === 'single' && (
        <div className="space-y-3">
          {options.map(o => (
            <VoteButton
              key={o.id}
              pollId={id}
              optionId={o.id}
              text={o.option_text}
              allowMultiple={poll.allow_multiple}
              userHasVoted={false}
            />
          ))}
        </div>
      )}
    </main>
  );
}
