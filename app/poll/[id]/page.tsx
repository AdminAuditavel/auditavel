'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VoteButton from './VoteButton';
import RankingVote from '../../../components/RankingVote';

interface Poll {
  id: string;
  title: string;
  voting_type: string;
  allow_multiple?: boolean;
}

interface PollOptionRow {
  id: string;
  option_text: string;
  // outros campos do row, se existirem
}

interface Option {
  id: string;
  text: string;
}

export default function PollPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
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

      setPoll(pollData as Poll);

      // Carrega opções da pesquisa
      const { data: optionsData } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', id)
        .order('created_at', { ascending: true });

      if (mounted) {
        // Mapeia os rows para o formato que RankingVote espera: { id, text }
        const mapped: Option[] = (optionsData as PollOptionRow[] | null)
          ? (optionsData as PollOptionRow[]).map((row) => ({
              id: row.id,
              text: row.option_text,
            }))
          : [];
        setOptions(mapped);
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
        <RankingVote pollId={id!} options={options} />
      )}

      {/* Se for votação NORMAL (single ou multiple) */}
      {poll.voting_type === 'single' && (
        <div className="space-y-3">
          {options.map(o => (
            // para votação single, usamos o.option_text original no VoteButton;
            // aqui a variável o tem a forma { id, text }, então passamos text.
            <VoteButton
              key={o.id}
              pollId={id!}
              optionId={o.id}
              text={o.text}
              allowMultiple={poll.allow_multiple}
              userHasVoted={false}
            />
          ))}
        </div>
      )}
    </main>
  );
}
