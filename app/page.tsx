import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: polls } = await supabase
    .from("polls")
    .select("id, title, start_date, end_date, created_at, options(votes, text)")
    .order("created_at", { ascending: false });

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

  function function statusFor(p: any) {
    const now = new Date();
    const start = p?.start_date ? new Date(p.start_date) : null;
    const end = p?.end_date ? new Date(p.end_date) : null;

    if (start && now < start) return `Não iniciada`;
    if (end && now > end) return `Encerrada`;
    return "Aberta";
  }
(p: any) {
    if (!p?.start_date && !p?.end_date) return "Sem datas";
    const start = p?.start_date ? new Date(p.start_date) : null;
    const end = p?.end_date ? new Date(p.end_date) : null;
    if (start && now < start) return `Não iniciada (começa em ${formatDate(p.start_date)})`;
    if (end && now > end) return `Encerrada (fechou em ${formatDate(p.end_date)})`;
    return "Aberta";
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Auditável — Pesquisas</h1>

      {!polls?.length && <p className="text-gray-600 text-center">Nenhuma pesquisa ativa.</p>}

      {polls?.map((p: any) => (
        <Link
          key={p.id}
          href={`/poll/${p.id}`}
          className="block p-4 border rounded-lg hover:bg-gray-50"
        >
          <div className="flex flex-col">
            <span className="font-medium text-lg">{p.title}</span>
            <div className="text-sm text-gray-600 mt-2">
              <span className="mr-3">Início: {formatDate(p.start_date)}</span>
              <span className="mr-3">Fim: {formatDate(p.end_date)}</span>
            </div>
            <div className="text-sm mt-2 font-semibold text-gray-700">
              Total de votos: {p.options?.reduce((acc: number, o: any) => acc + (o.votes || 0), 0)}
            </div>
            <div className="text-sm text-green-700 font-medium mt-1">
              {(() => {
                if (!p.options?.length) return null;
                const leader = [...p.options].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
                return leader ? `Liderando: ${leader.text} (${leader.votes} votos)` : null;
              })()}
            </div>
          </div>
        </Link>
      ))}
    </main>
  );
}
