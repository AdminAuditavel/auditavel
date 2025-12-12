import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  options?: { votes?: number; text?: string }[] | null;
};

function formatDate(d?: string | null) {
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

function computeStatus(p: Poll) {
  const now = new Date();
  const start = p.start_date ? new Date(p.start_date) : null;
  const end = p.end_date ? new Date(p.end_date) : null;
  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
}

function statusBadge(status: string) {
  // returns Tailwind classes (background + text)
  if (status === "open") return "bg-green-100 text-green-800";
  if (status === "not_started") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default async function Home() {
  const { data: polls } = await supabase
    .from("polls")
    // incluiu campos essenciais; manter created_at evita problema de ordenação
    .select(
      "id, title, start_date, end_date, created_at, options(votes, text)"
    )
    .order("created_at", { ascending: false });

  // fallback defensivo: garantir array
  const list: Poll[] = Array.isArray(polls) ? (polls as Poll[]) : [];

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>

      {!list.length && <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>}

      <div className="space-y-3">
        {list.map((p) => {
          const status = computeStatus(p);
          const totalVotes = (p.options || []).reduce((acc, o) => acc + (o?.votes || 0), 0);
          const leader =
            (p.options || [])
              .slice()
              .sort((a, b) => (b?.votes || 0) - (a?.votes || 0))[0] || null;

          return (
            <Link
              key={p.id}
              href={`/poll/${p.id}`}
              className="block p-4 border rounded-lg hover:shadow-sm transition-shadow duration-150 bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{p.title}</h2>

                  <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-3">
                    <span>Início: {formatDate(p.start_date)}</span>
                    <span>Fim: {formatDate(p.end_date)}</span>
                    <span>Criado: {formatDate(p.created_at)}</span>
                  </div>

                  <div className="mt-3 text-sm text-gray-700">
                    <span className="font-medium">Total de votos:</span>{" "}
                    <span>{totalVotes}</span>
                    {leader && (
                      <span className="ml-4">
                        <span className="font-medium">Líder:</span> {leader.text} ({leader.votes || 0})
                      </span>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(
                      status
                    )}`}
                  >
                    {status === "open" ? "Aberta" : status === "not_started" ? "Não iniciada" : "Encerrada"}
                  </span>
                  <span className="mt-3 text-xs text-gray-500">{/* espaço para futuro badge/meta */}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
