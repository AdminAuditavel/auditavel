import { supabaseServer as supabase } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AuditLog = {
  id: string;
  poll_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  polls?: {
    title: string;
  };
};

export default async function AdminAuditPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token;

  if (token !== process.env.ADMIN_TOKEN) {
    redirect("/");
  }

  const { data: logs, error } = await supabase
    .from("admin_audit_logs")
    .select(`
      id,
      action,
      old_value,
      new_value,
      created_at,
      polls (
        title
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto text-red-600">
        Erro ao carregar auditoria.
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-700">
          Admin — Auditoria
        </h1>

        <div className="flex gap-4 text-sm">
          <Link href={`/admin?token=${token}`} className="text-emerald-600 hover:underline">
            Admin
          </Link>
          <Link href="/" className="text-emerald-600 hover:underline">
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
              logs.map((log: AuditLog) => (
                <tr
                  key={log.id}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </td>

                  <td className="px-4 py-3 font-medium">
                    {log.polls?.title ?? "—"}
                  </td>

                  <td className="px-4 py-3 text-gray-700">
                    {log.action}
                  </td>

                  <td className="px-4 py-3 text-gray-700">
                    {log.old_value !== null && log.new_value !== null ? (
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
              ))
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
