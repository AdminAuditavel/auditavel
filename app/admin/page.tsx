import Link from "next/link";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Poll = {
  id: string;
  title: string;
  status: "draft" | "open" | "paused" | "closed";
  voting_type: "single" | "ranking";
  show_partial_results: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

function statusLabel(status: Poll["status"]) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "open":
      return "Aberta";
    case "paused":
      return "Pausada";
    case "closed":
      return "Encerrada";
    default:
      return status;
  }
}

function statusStyle(status: Poll["status"]) {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "open":
      return "bg-green-100 text-green-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    case "closed":
      return "bg-red-100 text-red-800";
  }
}

function typeLabel(type: Poll["voting_type"]) {
  return type === "ranking" ? "Ranking" : "Voto simples";
}

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default async function AdminPage() {
  const { data: polls, error } = await supabase
    .from("polls")
    .select(
      `
      id,
      title,
      status,
      voting_type,
      show_partial_results,
      start_date,
      end_date,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-6 max-w-5xl mx-auto text-red-600">
        Erro ao carregar pesquisas administrativas.
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-emerald-700">
          Admin — Pesquisas
        </h1>

        <Link
          href="/"
          className="text-sm text-emerald-600 hover:underline"
        >
          Voltar para Auditável
        </Link>
      </header>

      {/* TABELA */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-center">Parciais</th>
              <th className="px-4 py-3 text-left">Início</th>
              <th className="px-4 py-3 text-left">Fim</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>

          <tbody>
            {polls && polls.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Nenhuma pesquisa cadastrada.
                </td>
              </tr>
            )}

            {polls?.map((poll: Poll) => (
              <tr
                key={poll.id}
                className="border-t hover:bg-slate-50 transition"
              >
                <td className="px-4 py-3 font-medium">
                  {poll.title}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusStyle(
                      poll.status
                    )}`}
                  >
                    {statusLabel(poll.status)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {typeLabel(poll.voting_type)}
                </td>

                <td className="px-4 py-3 text-center">
                  {poll.show_partial_results ? "Sim" : "Não"}
                </td>

                <td className="px-4 py-3">
                  {formatDate(poll.start_date)}
                </td>

                <td className="px-4 py-3">
                  {formatDate(poll.end_date)}
                </td>

                <td className="px-4 py-3 text-center space-x-3">
                  <Link
                    href={`/poll/${poll.id}`}
                    className="text-emerald-600 hover:underline"
                  >
                    Votar
                  </Link>

                  <Link
                    href={`/results/${poll.id}`}
                    className="text-emerald-600 hover:underline"
                  >
                    Resultados
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
