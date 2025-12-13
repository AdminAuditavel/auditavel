export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* =======================
   TIPOS
======================= */
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

/* =======================
   HELPERS
======================= */
function formatDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function statusLabel(status: Poll["status"]) {
  switch (status) {
    case "open":
      return "Aberta";
    case "paused":
      return "Pausada";
    case "closed":
      return "Encerrada";
    case "draft":
      return "Rascunho";
  }
}

function statusColor(status: Poll["status"]) {
  switch (status) {
    case "open":
      return "bg-green-100 text-green-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    case "closed":
      return "bg-red-100 text-red-800";
    case "draft":
      return "bg-gray-200 text-gray-700";
  }
}

/* =======================
   PAGE
======================= */
export default async function Home() {
  /* 1️⃣ POLLS */
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

  /* ❌ NÃO EXIBIR DRAFT NA HOME */
  const visiblePolls = polls.filter(p => p.status !== "draft");

  const pollIds = visiblePolls.map(p => p.id);

  /* 2️⃣ OPTIONS */
  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("id, poll_id, option_text")
    .in("poll_id", pollIds);

  const options: PollOption[] = optionsData || [];

  /* 3️⃣ VOTES */
  const { data: votesData } = await supabase
    .from("votes")
    .select("poll_id, option_id, user_hash")
    .in("poll_id", pollIds);

  const votes: Vote[] = votesData || [];

  /* 4️⃣ RANKINGS */
  const { data: rankingsData } = await supabase
    .from("vote_rankings")
    .select("vote_id, option_id, ranking");

  const rankings: VoteRanking[] = rankingsData || [];

  /* =======================
     AGRUPAMENTOS
  ======================= */
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
    if (!rankingsByOption.has(r.option_id))
      rankingsByOption.set(r.option_id, []);
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

  /* =======================
     RENDER
  ======================= */
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Auditável — Pesquisas</h1>

      {visiblePolls.map(p => {
        const opts = optionsByPoll.get(p.id) || [];
        const isRanking = p.voting_type === "ranking";

        /* 🔐 REGRA CENTRAL (MESMA DO RESULTS) */
        const canShowSummary =
          p.status === "closed" ||
          ((p.status === "open" || p.status === "paused") &&
            p.show_partial_results);

        /* ===== SINGLE ===== */
        let totalVotes = 0;
        let leaderText = "";
        let leaderCount = 0;

        if (!isRanking && canShowSummary) {
          const pollVotes = votesByPoll.get(p.id) || [];

          totalVotes = p.allow_multiple
            ? pollVotes.length
            : new Set(pollVotes.map(v => v.user_hash)).size;

          const countByOption = new Map<string, number>();
          pollVotes.forEach(v => {
            if (!v.option_id) return;
            countByOption.set(
              v.option_id,
              (countByOption.get(v.option_id) || 0) + 1
            );
          });

          if (countByOption.size > 0) {
            const [leaderId, count] = [...countByOption.entries()].sort(
              (a, b) => b[1] - a[1]
            )[0];
            const opt = opts.find(o => o.id === leaderId);
            if (opt) {
              leaderText = opt.option_text;
              leaderCount = count;
            }
          }
        }

        /* ===== RANKING ===== */
        let rankingTotal = 0;
        let rankingLeader = "";
        let rankingAvg = 0;

        if (isRanking && canShowSummary) {
          rankingTotal = rankingVotesByPoll.get(p.id)?.size || 0;

          const summaries = opts
            .map(o => {
              const rs = rankingsByOption.get(o.id) || [];
              if (!rs.length) return null;
              const avg = rs.reduce((s, r) => s + r.ranking, 0) / rs.length;
              return { text: o.option_text, avg };
            })
            .filter(Boolean) as { text: string; avg: number }[];

          if (summaries.length) {
            const best = summaries.sort((a, b) => a.avg - b.avg)[0];
            rankingLeader = best.text;
            rankingAvg = best.avg;
          }
        }

        return (
          <div
            key={p.id}
            className="relative p-5 border rounded-xl bg-white shadow-sm"
          >
            {/* STATUS */}
            <span
              className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                p.status
              )}`}
            >
              {statusLabel(p.status)}
            </span>

            {/* TITLE */}
            <h2 className="text-lg font-semibold text-blue-700 pr-24">
              {p.title}
            </h2>

            {/* META */}
            <div className="text-sm text-gray-600 mt-1">
              Início: {formatDate(p.start_date)} · Fim:{" "}
              {formatDate(p.end_date)} · Tipo:{" "}
              {isRanking ? "Ranking" : "Voto simples"}
            </div>

            {/* CONTENT */}
            {canShowSummary ? (
              <>
                {!isRanking && (
                  <div className="mt-3 text-sm">
                    <b>Total de votos:</b> {totalVotes}
                    {leaderText && (
                      <div className="mt-1 text-green-700 font-medium">
                        Líder: {leaderText} ({leaderCount} votos)
                      </div>
                    )}
                  </div>
                )}

                {isRanking && (
                  <div className="mt-3 text-sm">
                    <b>Total de votos:</b> {rankingTotal}
                    {rankingLeader && (
                      <div className="mt-1 text-green-700 font-medium">
                        Líder (ranking médio): {rankingLeader} (
                        {rankingAvg.toFixed(2)})
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                Resultados ocultos no momento.
              </div>
            )}

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
