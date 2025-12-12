import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  voting_type?: string | null; // single | ranking
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

type Vote = {
  poll_id: string;
  option_id: string | null;
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

function statusFromDates(p: Poll) {
  const now = new Date();
  const start = p.start_date ? new Date(p.start_date) : null;
  const end = p.end_date ? new Date(p.end_date) : null;
  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
}

export default async function Home() {
  // 1) polls
  const { data: pollsData } = await supabase
    .from("polls")
    .select("id, title, start_date, end_date, voting_type")
    .order("created_at", { ascending: false });

  const polls: Poll[] = pollsData || [];
  if (!polls.length) {
    return <p className="p-6 text-center">Nenhuma pesquisa ativa.</p>;
  }

  const pollIds = polls.map(p => p.id);

  // 2) options
  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("id, poll_id, option_text")
    .in("poll_id", pollIds);

  const options: PollOption[] = optionsData || [];

  // 3) votes (SINGLE)
  const { data: votesData } = await supabase
    .from("votes")
    .select("poll_id, option_id")
    .in("poll_id", pollIds);

  const votes: Vote[] = votesData || [];

  // 4) vote_rankings (RANKING)
  const { data: rankingsData } = await supabase
    .from("vote_rankings")
    .select("vote_id, option_id, ranking");

  const rankings: VoteRanking[] = rankingsData || [];

  // Maps
  const optionsByPoll = new Map<string, PollOption[]>();
  for (const o of options) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, []);
    optionsByPoll.get(o.poll_id)!.push(o);
  }

  const votesByPoll = new Map<string, Vote[]>();
  for (const v of votes) {
    if (!votesByPoll.has(v.poll_id)) votesByPoll.set(v.poll_id, []);
    votesByPoll.get(v.poll_id)!.push(v);
  }

  const rankingsByOption = new Map<string, VoteRanking[]>();
  for (const r of rankings) {
    if (!rankingsByOption.has(r.option_id)) rankingsByOption.set(r.option_id, []);
    rankingsByOption.get(r.option_id)!.push(r);
  }

  const rankingsByPoll = new Map<string, Set<string>>();
  for (const r of rankings) {
    // usamos vote_id para contar votos únicos
    const opt = options.find(o => o.id === r.option_id);
    if (!opt) continue;
    if (!rankingsByPoll.has(opt.poll_id)) rankingsByPoll.set(opt.poll_id, new Set());
    rankingsByPoll.get(opt.poll_id)!.add(r.vote_id);
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-center">Auditável — Pesquisas</h1>

      {polls.map(p => {
        const opts = optionsByPoll.get(p.id) || [];
        const status = statusFromDates(p);
        const isRanking = p.voting_type === "ranking";

        // ===== SINGLE =====
        let totalVotes = 0;
        let leaderText = "";
        let leaderPct = 0;

        if (!isRanking) {
          const pollVotes = votesByPoll.get(p.id) || [];
          totalVotes = pollVotes.length;

          const countByOption = new Map<string, number>();
          for (const v of pollVotes) {
            if (!v.option_id) continue;
            countByOption.set(v.option_id, (countByOption.get(v.option_id) || 0) + 1);
          }

          if (totalVotes > 0) {
            const [leaderId, leaderCount] =
              [...countByOption.entries()].sort((a, b) => b[1] - a[1])[0];
            const opt = opts.find(o => o.id === leaderId);
            if (opt) {
              leaderText = opt.option_text;
              leaderPct = Math.round((leaderCount / totalVotes) * 1000) / 10;
            }
          }
        }

        // ===== RANKING =====
        let rankingTotalVotes = 0;
        let rankingLeader = "";
        let rankingAvg = 0;

        if (isRanking) {
          rankingTotalVotes = rankingsByPoll.get(p.id)?.size || 0;

          const summaries = opts.map(opt => {
            const rs = rankingsByOption.get(opt.id) || [];
            if (!rs.length) return null;
            const avg = rs.reduce((s, r) => s + r.ranking, 0) / rs.length;
            return { text: opt.option_text, avg };
          }).filter(Boolean) as { text: string; avg: number }[];

          if (summaries.length) {
            const best = summaries.sort((a, b) => a.avg - b.avg)[0];
            rankingLeader = best.text;
            rankingAvg = best.avg;
          }
        }

        return (
          <Link key={p.id} href={`/poll/${p.id}`} className="block p-4 border rounded-lg bg-white hover:shadow">
            <h2 className="text-lg font-semibold">{p.title}</h2>

            <div className="text-sm text-gray-600 mt-1">
              Início: {formatDate(p.start_date)} · Fim: {formatDate(p.end_date)}
            </div>

            {!isRanking && (
              <div className="mt-2 text-sm">
                <b>Total de votos:</b> {totalVotes}
                {leaderText && (
                  <div className="mt-1 text-green-700 font-medium">
                    Líder: {leaderText} ({leaderPct}%)
                  </div>
                )}
              </div>
            )}

            {isRanking && (
              <div className="mt-2 text-sm">
                <b>Total de votos:</b> {rankingTotalVotes}
                {rankingLeader && (
                  <div className="mt-1 text-green-700 font-medium">
                    Líder (ranking médio): {rankingLeader} ({rankingAvg.toFixed(2)})
                  </div>
                )}
              </div>
            )}

            <div className="mt-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                status === "open"
                  ? "bg-green-100 text-green-800"
                  : status === "not_started"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}>
                {status === "open" ? "Aberta" : status === "not_started" ? "Não iniciada" : "Encerrada"}
              </span>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
