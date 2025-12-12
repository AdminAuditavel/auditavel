import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Tipos para as consultas
type PollRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
  voting_type: string;
};

type OptionRow = {
  poll_id: string;
  option_text: string;
  votes_count: number;
};

type RankingRow = {
  poll_id: string;
  option_id: string;
  ranking: number;
};

export default async function Home() {
  // 1) Buscar polls principais (mantendo created_at para ordenação)
  const { data: pollsData, error: pollsError } = await supabase
    .from<PollRow>("polls")
    .select("id, title, start_date, end_date, created_at, voting_type")
    .order("created_at", { ascending: false });

  // 2) Buscar opções e votos
  const { data: optionsData, error: optionsError } = await supabase
    .from<OptionRow>("poll_options")
    .select("poll_id, option_text, votes_count");

  // 3) Buscar vote_rankings para polls do tipo ranking
  const { data: rankingsData, error: rankingsError } = await supabase
    .from<RankingRow>("vote_rankings")
    .select("poll_id, option_id, ranking");

  const now = new Date();

  function formatDate(d: string | null | undefined) {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  }

  function statusFor(p: PollRow) {
    const start = p?.start_date ? new Date(p.start_date) : null;
    const end = p?.end_date ? new Date(p.end_date) : null;
    if (start && now < start) return `Não iniciada (começa em ${formatDate(p.start_date)})`;
    if (end && now > end) return `Encerrada (fechou em ${formatDate(p.end_date)})`;
    return "Aberta";
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>

      {!pollsData?.length && <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>}

      {pollsData?.map((p) => {
        const options = optionsData?.filter((o) => o.poll_id === p.id);
        const totalVotes = options?.reduce((acc, o) => acc + o.votes_count, 0) || 0;
        const isRanking = p.voting_type === "ranking";

        const leader = options?.sort((a, b) => b.votes_count - a.votes_count)[0];
        const leaderPercentage = leader ? (leader.votes_count / totalVotes) * 100 : 0;

        const rankingData = rankingsData?.filter((r) => r.poll_id === p.id);

        return (
          <Link
            key={p.id}
            href={`/poll/${p.id}`}
            className="block p-4 border rounded-lg hover:bg-gray-50"
            style={{ backgroundColor: isRanking ? "#f0f4f8" : "#f9fafb" }}
          >
            <div className="flex flex-col">
              <span className="font-medium text-lg">{p.title}</span>
              <div className="text-sm text-gray-600 mt-2">
                <span className="mr-3">Início: {formatDate(p.start_date)}</span>
                <span className="mr-3">Fim: {formatDate(p.end_date)}</span>
              </div>
              <div className="text-sm mt-2 font-semibold text-gray-700">
                Total de votos: {totalVotes}
              </div>
              {isRanking ? (
                <div className="text-sm text-green-700 font-medium mt-1">
                  {leader && `Liderando: ${leader.option_text} (${leader.votes_count} votos, ${leaderPercentage.toFixed(2)}%)`}
                </div>
              ) : (
                <div className="text-sm text-gray-700 font-medium mt-1">
                  {leader ? `Vencedor: ${leader.option_text} (${leader.votes_count} votos)` : "Sem votos ainda"}
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2">
                Status: {statusFor(p)}
              </div>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
