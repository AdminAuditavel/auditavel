// app/admin/audit/AdminResultsPanel.tsx
"use client";

import { useEffect, useState } from "react";

type VotingType = "single" | "multiple" | "ranking";

type PollDTO = {
  id: string;
  title: string;
  voting_type: VotingType;
  status?: string;
  allow_multiple?: boolean;
  max_votes_per_user?: number | null;
  show_partial_results?: boolean;
};

type TotalsDTO = {
  totalParticipants: number;
  totalSubmissions: number;
  totalMarks?: number; // multiple
};

type RowMultiple = {
  option_id: string;
  option_text: string;
  unique_voters: number;
  pct_participants: number;
  marks: number;
  pct_marks: number;
};

type RowRanking = {
  option_id: string;
  option_text: string;
  unique_voters: number;
  pct_participants: number;
  appearances: number;
  avg_rank: number;
  // score pode entrar depois quando você decidir adicionar
  score?: number;
};

type RowSingle = {
  option_id: string;
  option_text: string;
  unique_voters: number;
  pct_participants: number;
  votes?: number; // opcional, caso você ainda retorne
};

type AdminResultsResponse = {
  poll: PollDTO;
  totals: TotalsDTO;
  rows: Array<RowMultiple | RowRanking | RowSingle>;
  note?: string;
  error?: string;
  details?: string;
};

function vtLabel(vt: VotingType) {
  if (vt === "single") return "Uma opção";
  if (vt === "multiple") return "Múltiplas opções";
  return "Ranking";
}

function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export default function AdminResultsPanel({
  token,
  pollId,
}: {
  token: string;
  pollId: string;
}) {
  const [data, setData] = useState<AdminResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr("");

        const res = await fetch(
          `/api/admin/results/${encodeURIComponent(pollId)}?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );

        const json = (await res.json().catch(() => null)) as AdminResultsResponse | null;

        if (!alive) return;

        if (!res.ok) {
          const msg =
            json?.details
              ? `${json?.error || "failed"} — ${json.details}`
              : json?.error || "Falha ao carregar resultados.";
          throw new Error(msg);
        }

        setData(json || null);
      } catch (e: any) {
        setErr(e?.message || "Erro desconhecido.");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [token, pollId]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <div className="text-sm text-gray-600">Carregando resultados detalhados…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <div className="text-sm text-red-600">Erro ao carregar resultados: {err}</div>
      </div>
    );
  }

  if (!data?.poll) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <div className="text-sm text-gray-600">Sem dados de pesquisa.</div>
      </div>
    );
  }

  const poll = data.poll;
  const totals = data.totals;
  const rows = Array.isArray(data.rows) ? data.rows : [];

  const totalParticipants = safeNum(totals.totalParticipants);
  const totalSubmissions = safeNum(totals.totalSubmissions);
  const totalMarks = safeNum(totals.totalMarks);

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-500">Resultados detalhados (Admin)</div>
          <div className="font-semibold text-gray-900">{poll.title}</div>

          <div className="text-xs text-gray-600">
            Tipo: <span className="font-medium">{vtLabel(poll.voting_type)}</span>
            {" · "}
            Participantes: <span className="font-medium">{totalParticipants}</span>
            {" · "}
            Participações: <span className="font-medium">{totalSubmissions}</span>
            {poll.voting_type === "multiple" ? (
              <>
                {" · "}
                Marcas: <span className="font-medium">{totalMarks}</span>
              </>
            ) : null}
          </div>

          {data.note ? <div className="text-xs text-gray-500 mt-1">{data.note}</div> : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Nenhum dado para exibir.</div>
        ) : poll.voting_type === "multiple" ? (
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Opção</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">% (participantes)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">Votos únicos</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">Marcas</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">% (marcas)</th>
              </tr>
            </thead>
            <tbody>
              {(rows as RowMultiple[]).map((r) => (
                <tr key={r.option_id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{r.option_text}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.pct_participants)}%</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.unique_voters)}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.marks)}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.pct_marks)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : poll.voting_type === "ranking" ? (
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Opção</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">% (participantes)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">Votos únicos</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">Aparições</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">Média posição</th>
              </tr>
            </thead>
            <tbody>
              {(rows as RowRanking[]).map((r) => (
                <tr key={r.option_id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{r.option_text}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.pct_participants)}%</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.unique_voters)}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.appearances)}</td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {Number.isFinite(Number(r.avg_rank)) ? Number(r.avg_rank).toFixed(2) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // single (se você usar também)
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Opção</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">% (participantes)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">Votos únicos</th>
              </tr>
            </thead>
            <tbody>
              {(rows as RowSingle[]).map((r) => (
                <tr key={r.option_id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{r.option_text}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.pct_participants)}%</td>
                  <td className="px-4 py-3 text-center text-gray-700">{safeNum(r.unique_voters)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* rodapé (opcional) */}
      <div className="p-4 text-xs text-gray-500 border-t">
        Dica: percentuais são calculados pelo backend. Para consistência, mantenha o frontend apenas exibindo.
      </div>
    </div>
  );
}
