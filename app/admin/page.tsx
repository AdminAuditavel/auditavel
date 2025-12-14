import { supabaseServer as supabase } from "@/lib/supabase-server";
import Link from "next/link";
import PollStatusSelect from "./PollStatusSelect";
import PollVisibilityToggle from "./PollVisibilityToggle";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Poll = {
  id: string;
  title: string;
  status: "draft" | "open" | "paused" | "closed";
  show_partial_results: boolean;
  created_at: string;
};

export default async function AdminPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token;

  if (token !== process.env.ADMIN_TOKEN) {
    redirect("/");
  }

  /* =======================
     AUDITORIA — VISIBILIDADE PÚBLICA
  ======================= */
  function getPublicVisibility(
    status: "draft" | "open" | "paused" | "closed",
    showPartial: boolean
  ) {
    if (status === "closed") {
      return {
        label: "Final",
        className: "bg-emerald-100 text-emerald-800",
      };
    }

    if ((status === "open" || status === "paused") && showPartial) {
      return {
        label: "Parcial",
        className: "bg-amber-100 text-amber-800",
      };
    }

    return {
      label: "Oculto",
      className: "bg-gray-200 text-gray-700",
    };
  }

  /* =======================
     FETCH
  ======================= */
  const { data: polls, error } = await supabase
    .from("polls")
    .select("id, title, status, show_partial_results, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto text-red-600">
        Erro ao carregar pesquisas.
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-700">
          Admin — Pesquisas
        </h1>

        <Link
          href="/"
          className="text-sm text-emerald-600 hover:underline"
        >
          Voltar ao site
        </Link>
      </div>

      {/* TABELA */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                Pesquisa
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                Status
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                Resultados parciais
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                Visibilidade pública
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                Criada em
              </th>
            </tr>
          </thead>

          <tbody>
            {polls && polls.length > 0 ? (
              polls.map((poll: Poll) => {
                const visibility = getPublicVisibility(
                  poll.status,
                  poll.show_partial_results
                );

                return (
                  <tr
                    key={poll.id}
                    className="border-b last:border-b-0 hover:bg-gray-50"
                  >
                    {/* TITLE */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {poll.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {poll.id}
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="px-4 py-3">
                      <PollStatusSelect
                        pollId={poll.id}
                        currentStatus={poll.status}
                      />
                    </td>

                    {/* SHOW PARTIAL RESULTS */}
                    <td className="px-4 py-3 text-center">
                      <PollVisibilityToggle
                        pollId={poll.id}
                        initialValue={poll.show_partial_results}
                      />
                    </td>

                    {/* VISIBILIDADE PÚBLICA (AUDITORIA) */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${visibility.className}`}
                      >
                        {visibility.label}
                      </span>
                    </td>

                    {/* CREATED AT */}
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(poll.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Nenhuma pesquisa encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
