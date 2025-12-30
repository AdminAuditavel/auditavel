// app/admin/results/page.tsx
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { getResults } from "@/lib/getResults";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage(props: {
  searchParams: Promise<{ token?: string; poll_id?: string }>;
}) {
  const sp = await props.searchParams;
  const token = sp?.token;
  const pollId = (sp?.poll_id ?? "").trim();

  if (token !== process.env.ADMIN_TOKEN) redirect("/");
  if (!pollId) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-red-600">poll_id ausente.</p>
        <Link href={`/admin?token=${encodeURIComponent(token ?? "")}`} className="text-emerald-700 hover:underline">
          ← Voltar
        </Link>
      </main>
    );
  }

  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("id, title, voting_type, allow_multiple, max_votes_per_user, status, show_partial_results")
    .eq("id", pollId)
    .maybeSingle();

  if (!poll || pollError) {
    return (
      <main className="p-6 max-w-4xl mx-auto text-red-600">
        Erro ao carregar poll.
      </main>
    );
  }

  const adminBackHref = `/admin?token=${encodeURIComponent(token ?? "")}`;

  // Helpers
  const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0);

  // Carrega opções
  const { data: options } = await supabase
    .from("poll_options")
    .select("id, option_text")
    .eq("poll_id", pollId);

  // Carrega votos (precisamos participant_id para "participantes")
  const { data: votes } = await supabase
    .from("votes")
    .select("id, option_id, participant_id")
    .eq("poll_id", pollId);

  const totalSubmissions = votes?.length || 0;
  const totalParticipants = new Set((votes ?? []).map((v) => v.participant_id)).size;

  // ==== SINGLE ====
  if (poll.voting_type === "single") {
    const count: Record<string, number> = {};
    (votes ?? []).forEach((v: any) => {
      if (!v.option_id) return;
      count[v.option_id] = (count[v.option_id] || 0) + 1;
    });

    // denominador:
    // - se max_votes_per_user=1 => participantes
    // - senão => participações
    const effectiveMaxVotes = poll.allow_multiple ? (poll.max_votes_per_user ?? 1) : 1;
    const base = effectiveMaxVotes === 1 ? totalParticipants : totalSubmissions;

    const rows =
      (options ?? [])
        .map((o: any) => ({
          id: o.id,
          text: o.option_text,
          n: count[o.id] || 0,
          p: pct(count[o.id] || 0, base),
        }))
        .sort((a, b) => b.n - a.n);

    return (
      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-emerald-700">Admin — Resultados</h1>
            <p className="text-sm text-gray-600">{poll.title}</p>
            <p className="text-xs text-gray-500">ID: {pollId}</p>
          </div>

          <Link href={adminBackHref} className="text-emerald-700 hover:underline">
            ← Voltar
          </Link>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-700">
            <strong>Participantes:</strong> {totalParticipants}{" "}
            <span className="text-gray-400">·</span>{" "}
            <strong>Participações:</strong> {totalSubmissions}{" "}
            <span className="text-gray-400">·</span>{" "}
            <strong>Base do %:</strong> {effectiveMaxVotes === 1 ? "Participantes" : "Participações"}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Opção</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{r.text}</td>
                  <td className="px-4 py-3 text-right">{r.n}</td>
                  <td className="px-4 py-3 text-right">{r.p}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    );
  }

  // ==== MULTIPLE ====
  if (poll.voting_type === "multiple") {
    const voteIds = (votes ?? []).map((v: any) => v.id);
    const { data: marks } = voteIds.length
      ? await supabase.from("vote_options").select("vote_id, option_id").in("vote_id", voteIds)
      : { data: [] as any[] };

    // Conta “marcas por participante” (único por participante por opção)
    // (como seu home já faz com Set(user_hash), aqui fazemos por participant_id)
    const participantByVoteId = new Map<string, string>();
    (votes ?? []).forEach((v: any) => participantByVoteId.set(v.id, v.participant_id));

    const setByOption = new Map<string, Set<string>>();
    (marks ?? []).forEach((m: any) => {
      const pid = participantByVoteId.get(m.vote_id);
      if (!pid) return;
      if (!setByOption.has(m.option_id)) setByOption.set(m.option_id, new Set());
      setByOption.get(m.option_id)!.add(pid);
    });

    // Denominador: participantes (do jeito que você pediu)
    const base = totalParticipants;

    const rows =
      (options ?? [])
        .map((o: any) => {
          const n = setByOption.get(o.id)?.size || 0;
          return { id: o.id, text: o.option_text, n, p: pct(n, base) };
        })
        .sort((a, b) => b.n - a.n);

    return (
      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-emerald-700">Admin — Resultados</h1>
            <p className="text-sm text-gray-600">{poll.title}</p>
            <p className="text-xs text-gray-500">ID: {pollId}</p>
          </div>

          <Link href={adminBackHref} className="text-emerald-700 hover:underline">
            ← Voltar
          </Link>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-700">
            <strong>Participantes:</strong> {totalParticipants}{" "}
            <span className="text-gray-400">·</span>{" "}
            <strong>Participações:</strong> {totalSubmissions}{" "}
            <span className="text-gray-400">·</span>{" "}
            <strong>Base do %:</strong> Participantes
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Em “múltiplas opções”, o “Total” abaixo representa quantos participantes marcaram cada opção (únicos).
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Opção</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{r.text}</td>
                  <td className="px-4 py-3 text-right">{r.n}</td>
                  <td className="px-4 py-3 text-right">{r.p}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    );
  }

  // ==== RANKING ====
  // Para ranking, usamos sua função getResults() e ainda mostramos participantes/participações acima.
  const json = await getResults(pollId);

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-emerald-700">Admin — Resultados</h1>
          <p className="text-sm text-gray-600">{poll.title}</p>
          <p className="text-xs text-gray-500">ID: {pollId}</p>
        </div>

        <Link href={adminBackHref} className="text-emerald-700 hover:underline">
          ← Voltar
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-700">
          <strong>Participantes:</strong> {totalParticipants}{" "}
          <span className="text-gray-400">·</span>{" "}
          <strong>Participações:</strong> {totalSubmissions}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Posição</th>
              <th className="px-4 py-3 text-left font-semibold">Opção</th>
              <th className="px-4 py-3 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {(json?.result ?? []).map((r: any, idx: number) => (
              <tr key={r.option_id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{idx + 1}º</td>
                <td className="px-4 py-3">{r.option_text}</td>
                <td className="px-4 py-3 text-right">{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
