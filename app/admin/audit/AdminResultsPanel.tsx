// app/admin/audit/AdminResultsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type AdminResultsResponse = {
  poll?: {
    id: string;
    title: string;
    voting_type: "single" | "multiple" | "ranking" | string;
    status?: string;
    allow_multiple?: boolean;
    max_votes_per_user?: number | null;
    show_partial_results?: boolean;
  };
  totals?: {
    totalParticipants?: number;
    totalSubmissions?: number;
    totalMarks?: number; // multiple
  };
  rows?: any[];
  note?: string;
  error?: string;
  details?: string;
};

function pct(n: number, base: number) {
  if (!base || base <= 0) return 0;
  return Math.round((n / base) * 100);
}

function vtLabel(vt?: string) {
  if (vt === "single") return "Uma opção";
  if (vt === "multiple") return "Múltiplas opções";
  if (vt === "ranking") return "Ranking";
  return vt || "-";
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

  const poll = data?.poll;
  const totals = data?.totals || {};
  const rows = Array.isArray(data?.rows) ? data!.rows! : [];

  const totalParticipants = Number(totals.totalParticipants || 0);
  const totalSubmissions = Number(totals.totalSubmissions || 0);
  const totalMarks = Number(totals.totalMarks || 0);

  const votingType = poll?.voting_type || "";

  // Normalizações defensivas (caso o endpoint mude levemente o shape)
  const normalized = useMemo(() => {
    if (!rows.length) return [];

    if (votingType === "single") {
      return rows.map((r: any) => {
        const unique = Number(r.unique_voters ?? r.uniqueVotes ?? r.unique ?? r.voters ?? 0);
        const votes = Number(r.votes ?? r.count ?? 0);
        const base = totalParticipants;
        const pctParticipants = Number(r.pct_participants ?? r.percent_participants ?? pct(unique || votes, base));
        return {
          option_text: String(r.option_text ?? r.text ?? ""),
          unique_voters: unique || votes, // fallback
          votes,
          pct_participants: pctParticipants,
        };
      });
    }

    if (votingType === "multiple") {
      return rows.map((r: any) => {
        const unique = Number(r.unique_voters ?? r.uniqueVotes ?? r.unique ?? r.voters ?? 0);
        const marks = Number(r.marks ?? r.count ?? 0);
        const pctParticipants = Number(
          r.pct_participants ?? r.percent_participants ?? pct(unique, totalParticipants)
        );
        const pctMarks = Number(r.pct_marks ?? r.percent_marks ?? pct(marks, totalMarks));
        return {
          option_text: String(r.option_text ?? r.text ?? ""),
          unique_voters: unique,
          marks,
          pct_participants: pctParticipants,
          pct_marks: pctMarks,
        };
      });
    }

    // ranking
    return rows.map((r: any) => {
      const unique = Number(r.unique_voters ?? r.uniqueVotes ?? r.unique ?? r.voters ?? 0);
      const appearances = Number(r.appearances ?? r.count ?? unique ?? 0);
      const avgRank = Number(r.avg_rank ?? r.avg ?? r.mean_rank ?? 0);
      const score = Number(r.score ?? r.points ?? 0);
      const pctParticipants = Number(
        r.pct_participants ?? r.percent_participants ?? pct(unique, totalParticipants)
      );
      return {
        option_text: String(r.option_text ?? r.text ?? ""),
        unique_voters: unique,
        appearances,
        avg_rank: avgRank,
        score,
        pct_participants: pctParticipants,
      };
    });
  }, [rows, votingType, totalParticipants, totalMarks]);

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

  if (!poll) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <div className="text-sm text-gray-600">Sem dados de pesquisa.</div>
      </div>
    );
  }

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
          {data?.note ? (
            <div className="text-xs text-gray-500 mt-1">{data.note}</div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        {normalized.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Nenhum dado para exibir.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Opção</th>

                <th className="px-4 py-3 text-center font-semibold text-gray-800">
                  % (participantes)
                </th>

                <th className="px-4 py-3 text-center font-semibold text-gray-800">
                  Votos únicos
                </th>

                {poll.voting_type === "multiple" ? (
                  <>
                    <th className="px-4 py-3 text-center font-semibold text-gray-800">
                      Marcas
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-800">
                      % (marcas)
                    </th>
                  </>
                ) : null}

                {poll.voting_type === "ranking" ? (
                  <>
                    <th className="px-4 py-3 text-center font-semibold text-gray-800">
                      Média posição
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-800">
                      Score
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-800">
                      Aparições
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {normalized.map((r: any, idx: number) => (
                <tr key={`${idx}-${r.option_text}`} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{r.option_text}</td>

                  <td className="px-4 py-3 text-center text-gray-700">
                    {Number(r.pct_participants || 0)}%
                  </td>

                  <td className="px-4 py-3 text-center text-gray-700">
                    {Number(r.unique_voters || 0)}
                  </td>

                  {poll.voting_type === "multiple" ? (
                    <>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {Number(r.marks || 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {Number(r.pct_marks || 0)}%
                      </td>
                    </>
                  ) : null}

                  {poll.voting_type === "ranking" ? (
                    <>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {Number.isFinite(Number(r.avg_rank)) && Number(r.avg_rank) > 0
                          ? Number(r.avg_rank).toFixed(2)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {Number.isFinite(Number(r.score)) && Number(r.score) > 0 ? Number(r.score) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {Number(r.appearances || 0)}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
