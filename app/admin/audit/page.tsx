// app/admin/audit/page.tsx

import { supabaseServer as supabase } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* =======================
   TIPOS
======================= */
type AuditLog = {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  poll_id: string | null;
};

type PollMap = Record<string, string>;

/* =======================
   HELPERS
======================= */
function getActionBadge(action: string) {
  switch (action) {
    case "status_change":
      return {
        label: "Status alterado",
        className: "bg-blue-100 text-blue-800",
      };
    case "visibility_change":
      return {
        label: "Visibilidade dos resultados",
        className: "bg-purple-100 text-purple-800",
      };
    default:
      return {
        label: action,
        className: "bg-gray-200 text-gray-700",
      };
  }
}

/* =======================
   PAGE
======================= */
export default async function AdminAuditPage(props: {
  searchParams: Promise<{ token?: string; poll_id?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token;
  const pollId = searchParams?.poll_id;

  if (token !== process.env.ADMIN_TOKEN) {
    redirect("/");
  }

  /* =======================
     BUSCAR LOGS
  ======================= */
  let query = supabase
    .from("admin_audit_logs")
    .select(
      "id, action, old_value, new_value, created_at, poll_id"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (pollId) {
    query = query.eq("poll_id", pollId);
  }

  const { data: logs, error } = await query;

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto text-red-600">
        Erro ao carregar auditoria.
      </main>
    );
  }

  /* =======================
     MAPEAR TÍTULOS DAS POLLS
  ======================= */
  const pollIds = Array.from(
    new Set(logs?.map(l => l.poll_id).filter(Boolean))
  ) as string[];

  let pollMap: PollMap = {};

  if (pollIds.length > 0) {
    const { data: polls } = await supabase
      .from("polls")
      .select("id, title")
      .in("id", pollIds);

    polls?.forEach(p => {
      pollMap[p.id] = p.title;
    });
  }

  const pageTitle = pollId
    ? "Auditoria da pesquisa"
    : "Admin — Auditoria";

  /* =======================
     RENDER
  ======================= */
  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-700">
          {pageTitle}
        </h1>

        <div className="flex gap-4 text-sm">
          <Link
            href={`/admin?token=${token}`}
            className="text-emerald-600 hover:underline"
          >
            Admin
          </Link>
          <Link
            href="/"
            className="text-emerald-600 hover:underline"
          >
            Site
          </Link>
        </div>
      </div>

      {/* TABELA */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                Data
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                Pesquisa
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                Ação
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                Alteração
              </th>
            </tr>
          </thead>

          <tbody>
            {logs && logs.length > 0 ? (
              logs.map(log => {
                const badge = getActionBadge(log.action);

                return (
                  <tr
                    key={log.id}
                    className="border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {log.poll_id && pollMap[log.poll_id]
                        ? pollMap[log.poll_id]
                        : "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {log.old_value !== null &&
                      log.new_value !== null ? (
                        <>
                          <span className="text-gray-500">
                            {log.old_value}
                          </span>{" "}
                          →{" "}
                          <span className="font-semibold">
                            {log.new_value}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
