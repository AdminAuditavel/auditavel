'use server';
import React from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import RankingVote from '@/components/RankingVote';
import VoteButton from './VoteButton';

interface Poll {
  id: string;
  title: string;
  voting_type: string;
  allow_multiple?: boolean;
}

interface PollOptionRow {
  id: string;
  option_text: string;
  created_at?: string;
}

interface Option {
  id: string;
  text: string;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const pollId = params.id;
  try {
    const { data: poll } = await supabase
      .from('polls')
      .select('title')
      .eq('id', pollId)
      .single();

    return {
      title: poll?.title ?? 'Poll',
      description: `Vote on poll ${pollId}`,
    };
  } catch {
    return {
      title: 'Poll',
      description: `Vote on poll ${pollId}`,
    };
  }
}

export default async function PollPage({ params }: { params: { id: string } }) {
  const pollId = params.id;

  // Buscar poll
  const { data: pollData, error: pollErr } = await supabase
    .from('polls')
    .select('*')
    .eq('id', pollId)
    .single();

  if (pollErr || !pollData) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p>Enquete não encontrada.</p>
      </main>
    );
  }

  // Buscar opções do poll no servidor e serializar para o cliente
  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('id, option_text, created_at')
    .eq('poll_id', pollId)
    .order('created_at', { ascending: true });

  const options: Option[] = (optionsData as PollOptionRow[] | null)
    ? (optionsData as PollOptionRow[]).map((row) => ({
        id: row.id,
        text: row.option_text,
      }))
    : [];

  const poll = pollData as Poll;

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      {/* Se for votação de RANKING -> renderiza o componente cliente */}
      {poll.voting_type === 'ranking' && (
        <RankingVote pollId={pollId} options={options} />
      )}

      {/* Se for votação NORMAL (single) -> mantém VoteButton */}
      {poll.voting_type === 'single' && (
        <div className="space-y-3">
          {options.map(o => (
            <VoteButton
              key={o.id}
              pollId={pollId}
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
