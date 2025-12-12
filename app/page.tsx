export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  voting_type: "single" | "ranking";
  allow_multiple: boolean;
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

type Vote = {
  poll_id: string;
  option_id: string | null;
  user_hash: string;
};

type VoteRanking = {
  vote_id: string;
  option_id: string;
  ranking: number;
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function getStatus(p: Poll) {
  const now = new Date();
  const start = p.start_date ? new Date(p.start_date) : null;
  const end = p.end_date ? new Date(p.end_date) : null;

  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
}

function statusLabel(status: string) {
  if (status === "open") return "Aberta";
  if (status === "not_started") return "Não iniciada";
  return "Encerrada";
}

function statusColor(status: string) {
  if (status === "open") return "bg-green-100 text-green-800";
  if (status === "not_started") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default async function Home() {
  const { data: pollsData } = await supabase
    .from("polls")
    .select("id, title, start_date, end_date, voting_type, allow_multiple")
    .order("created_at", { ascending: false });

  const polls: Poll[] = pollsData || [];
  if (!polls.length) {
    return <p className="p-6 text-center">Nenhuma pesquisa ativa.</p>;
  }

  const pollIds = polls.map(p => p.id);

  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("id, poll_id, option_text")
    .in("poll_id", pollIds);

  const options: PollOption[] = optionsData || [];

  const { data: votesData } = await supabase
    .from("votes")
    .select("poll_id, option_id, user_hash")
    .in("poll_id", pollIds);

  const votes: Vote[] = votesData || [];

  const { data: rankingsData } = await supabase
    .from("vote_rankings")
    .select("vote_id, option_id, ranking");

  const rankings: VoteRanking[] = rankingsData || [];

  const optionsByPoll = new Map<string, PollOption[]>();
  options.forEach(o => {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  });

  const votesByPoll = new Map<string, Vote[]>();
  votes.forEach(v => {
    if (!votesByPoll.has(v.poll_id)) votesByPoll.set(v.poll_id, []);
    votesByPoll.get(v.poll_id)!.push(v);
  });

  const rankingsByOption = new Map<string, VoteRanking[]>();
  rankings.forEach(r => {
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  });

  const rankingVotesByPoll = new Map<string, Set<string>>();
  rankings.forEach(r => {
    const opt = options.find(o => o.id === r.option_id);
    if (!opt) return;
    if (!rankingVotesByPoll.has(opt.poll_id)) rankingVotesByPoll.set(opt.poll_id, new Set());
    rankingVotesByPoll.get(opt.poll_id)!.add(r.vote_id);
  });

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Auditável — Pesquisas</h1>

      {polls.map(p => {
        const opts = optionsByPoll.get(p.id) || [];
        const status = getStatus(p);
        const isRanking = p.voting_type === "ranking";

        let totalVotes = 0;

        if (!isRanking) {
          const pollVotes = votesByPoll.get(p.id) || [];
          totalVotes = p.allow_multiple
            ? pollVotes.length
            : new Set(pollVotes.map(v => v.user_hash)).size;
        } else {
          totalVotes = rankingVotesByPoll.get(p.id)?.size || 0;
        }

        return (
          <div
            key={p.id}
            className="relative p-5 border rounded-xl bg-white shadow-sm hover:shadow-md transition"
          >
            {/* STATUS */}
            <span
              className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                status
              )}`}
            >
              {statusLabel(status)}
            </span>

            {/* TITLE */}
            <h2 className="text-lg font-semibold text-blue-700 pr-24">
              {p.title}
            </h2>

            {/* META */}
            <div className="text-sm text-gray-600 mt-2">
              Início: {formatDate(p.start_date)} · Fim: {formatDate(p.end_date)}
            </div>

            {/* TOTAL */}
            <div className="mt-3 text-sm">
              <b>Total de votos:</b> {totalVotes}
            </div>

            {/* CTA */}
            <div className="mt-4">
              <Link
                href={`/poll/${p.id}`}
                className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
              >
                Ir para votação →
              </Link>
            </div>
          </div>
        );
      })}
    </main>
  );
}
