import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
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
  if (status === "open") return "bg-green-100 text-green-800";
  if (status === "not_started") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default async function Home() {
  const { data: polls } = await supabase
    .from("polls")
    .select("id, title, start_date, end_date, created_at")
    .order("created_at", { ascending: false });

  const list: Poll[] = Array.isArray(polls) ? polls : [];

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>

      {!list.length && (
        <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>
      )}

      <div className="space-y-3">
        {list.map((p) => {
          const status = computeStatus(p);

          return (
            <Link
              key={p.id}
              href={`/poll/${p.id}`}
              className="block p-4 border rounded-lg hover:shadow-sm transition-shadow duration-150 bg-white"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{p.title}</h2>

                  <div className="mt-2 text-sm text-gray-600 flex flex-col gap-1">
                    <span>Início: {formatDate(p.start_date)}</span>
                    <span>Fim: {formatDate(p.end_date)}</span>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(
                    status
                  )}`}
                >
                  {status === "open"
                    ? "Aberta"
                    : status === "not_started"
                    ? "Não iniciada"
                    : "Encerrada"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
