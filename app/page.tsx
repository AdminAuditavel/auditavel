// app/page.tsx
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
  status: "draft" | "open" | "paused" | "closed";
  show_partial_results: boolean;
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

function statusLabel(status: Poll["status"]) {
  if (status === "open") return "Aberta";
  if (status === "paused") return "Pausada";
  if (status === "closed") return "Encerrada";
  return "Rascunho";
}

function statusColor(status: Poll["status"]) {
  if (status === "open") return "bg-green-100 text-green-800";
  if (status === "paused") return "bg-yellow-100 text-yellow-800";
  if (status === "closed") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-600";
}

export default async function Home() {
  const { data: pollsData } = await supabase
    .from("polls")
    .select(
      "id, title, start_date, end_date, voting_type, allow_multiple, status, show_partial_results"
    )
    .order("created_at", { ascending: false });

  const polls: Poll[] = pollsData || [];
  if (!polls.length) {
    return <p className="p-6 text-center">Nenhuma pesquisa disponível.</p>;
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
    if (!rankingVotesByPoll.has(opt.poll_id))
      rankingVotesByPoll.set(opt.poll_id, new Set());
    rankingVotesByPoll.get(opt.poll_id)!.add(r.vote_id);
  });

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center text-emerald-700">
        Auditável — Pesquisas
      </h1>

      {polls.map(p => {
        if (p.status === "draft") return null;

        const opts = optionsByPoll.get(p.id) || [];
        const isRanking = p.voting_type === "ranking";

        const canShowResults =
          p.status === "closed" ||
          ((p.status === "open" || p.status === "paused") &&
            p.show_partial_results);

        let totalVotes = 0;
        let leaders: { text: string; percent: number }[] = [];

        if (!isRanking) {
          const pollVotes = votesByPoll.get(p.id) || [];
          totalVotes = p.allow_multiple
            ? pollVotes.length
            : new Set(pollVotes.map(v => v.user_hash)).size;

          if (canShowResults && totalVotes > 0) {
            const countByOption = new Map<string, number>();
            pollVotes.forEach(v => {
              if (!v.option_id) return;
              countByOption.set(
                v.option_id,
                (countByOption.get(v.option_id) || 0) + 1
              );
            });

            const maxVotes = Math.max(...countByOption.values());

            leaders = opts
              .filter(o => countByOption.get(o.id) === maxVotes)
              .map(o => ({
                text: o.option_text,
                percent: Math.round((maxVotes / totalVotes) * 100),
              }))
              .sort((a, b) => a.text.localeCompare(b.text));
          }
        }

        if (isRanking) {
          totalVotes = rankingVotesByPoll.get(p.id)?.size || 0;

          if (canShowResults && totalVotes > 0) {
            const summaries = opts
              .map(o => {
                const rs = rankingsByOption.get(o.id) || [];
                if (!rs.length) return null;
                const avg = rs.reduce((s, r) => s + r.ranking, 0) / rs.length;
                return { text: o.option_text, avg };
              })
              .filter(Boolean) as { text: string; avg: number }[];

            if (summaries.length) {
              const bestAvg = Math.min(...summaries.map(s => s.avg));
              leaders = summaries
                .filter(s => s.avg === bestAvg)
                .map(s => ({ text: s.text, percent: 0 }))
                .sort((a, b) => a.text.localeCompare(b.text));
            }
          }
        }

        const leaderLabel = leaders.length > 1 ? "Líderes" : "Líder";
        const isVotingOpen = p.status === "open";

        return (
          <div
            key={p.id}
            className="relative p-5 border border-gray-200 rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md transition"
          >
            <span
              className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                p.status
              )}`}
            >
              {statusLabel(p.status)}
            </span>

            <h2 className="text-lg font-semibold text-emerald-700 pr-24">
              {p.title}
            </h2>

            <div className="text-sm text-gray-600 mt-1">
              Início: {formatDate(p.start_date)} · Fim: {formatDate(p.end_date)} ·
              Tipo: {isRanking ? " Ranking" : " Voto simples"}
            </div>

            {canShowResults && (
              <div className="mt-3 text-sm">
                <b className="text-gray-700">Total de votos:</b>{" "}
                <span className="text-emerald-700 font-semibold">
                  {totalVotes}
                </span>

                {leaders.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
                      {leaderLabel}
                    </span>

                    <div className="flex flex-wrap gap-4">
                      {leaders.map((l, idx) => (
                        <span key={idx} className="font-bold text-emerald-700">
                          {l.text}
                          {!isRanking && ` (${l.percent}%)`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-1">
              <Link
                href={`/poll/${p.id}`}
                className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
              >
                {isVotingOpen ? "Ir para votação →" : "Ver opções →"}
              </Link>

              {canShowResults && (
                <div>
                  <Link
                    href={`/results/${p.id}`}
                    className="text-sm text-emerald-700 hover:underline"
                  >
                    Ver resultados
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}
