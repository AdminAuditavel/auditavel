// app/admin/page.tsx

import { supabaseServer } from "@/lib/supabase-server"; // Usando o supabaseServer configurado para SSR
import Link from "next/link";
import PollStatusSelect from "./PollStatusSelect";
import PollVisibilityToggle from "./PollVisibilityToggle";
import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/admin-auth"; // Função para validar admin

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
  // Removendo o uso de tokens na URL. Agora, validamos a sessão do usuário com cookies.
  const searchParams = await props.searchParams;
  
  // Validando se o usuário tem permissões de admin usando a função isAdminRequest
  const admin = await isAdminRequest();
  if (!admin.ok) {
    // Se o usuário não for admin, redireciona para o login
    return redirect("/admin/login");
  }

  // Instanciando o cliente supabase
  const supabase = await supabaseServer(); // Aguarda a factory async para obter o client real
  
  // Função para determinar a visibilidade pública da pesquisa
  function getPublicVisibility(
    status: "draft" | "open" | "paused" | "closed",
    showPartial: boolean
  ) {
    if (status === "closed") {
      return { label: "Final", className: "bg-emerald-100 text-emerald-800" };
    }
    if ((status === "open" || status === "paused") && showPartial) {
      return { label: "Parcial", className: "bg-amber-100 text-amber-800" };
    }
    return { label: "Oculto", className: "bg-gray-200 text-gray-700" };
  }

  // Buscando as pesquisas no banco de dados
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

        <div className="flex items-center gap-4">
          {/* Criar pesquisa */}
          <Link
            href="/admin/poll-registration"
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Nova pesquisa
          </Link>

          <Link href="/" className="text-sm text-emerald-600 hover:underline">
            Voltar ao site
          </Link>

          {/* Formulário de logout */}
          <form action="/admin/logout" method="post">
            <button type="submit" className="text-sm text-red-600 hover:underline">
              Sair
            </button>
          </form>
        </div>
      </div>

      {/* TABELA */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Pesquisa</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">
                Resultados parciais
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                Visibilidade pública
              </th>
              <th className="px-4 py-3 text-left font-semibold">Editar</th>
              <th className="px-4 py-3 text-left font-semibold">Resultados</th>
              <th className="px-4 py-3 text-left font-semibold">Auditoria</th>
              <th className="px-4 py-3 text-left font-semibold">Criada em</th>
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
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {poll.title}
                      </div>
                      <div className="text-xs text-gray-500">ID: {poll.id}</div>
                    </td>

                    <td className="px-4 py-3">
                      <PollStatusSelect
                        pollId={poll.id}
                        currentStatus={poll.status}
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <PollVisibilityToggle
                        pollId={poll.id}
                        initialValue={poll.show_partial_results}
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${visibility.className}`}
                      >
                        {visibility.label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/poll-registration?poll_id=${encodeURIComponent(poll.id)}`}
                        className="text-sm text-emerald-600 hover:underline"
                      >
                        Formulário
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/results?poll_id=${encodeURIComponent(poll.id)}`}
                        className="text-sm text-emerald-600 hover:underline"
                      >
                        Resultados
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/audit?poll_id=${encodeURIComponent(poll.id)}`}
                        className="text-sm text-emerald-600 hover:underline"
                      >
                        Auditoria
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {new Date(poll.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
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
