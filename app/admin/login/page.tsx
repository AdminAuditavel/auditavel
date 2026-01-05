// app/admin/login/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SearchParams = { next?: string; error?: string };

function safeNext(raw: unknown, fallback = "/admin") {
  if (typeof raw !== "string") return fallback;

  const next = raw.trim();
  if (!next) return fallback;

  // só permite path interno
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;

  // evita caracteres que podem quebrar redirect
  if (next.includes("\n") || next.includes("\r")) return fallback;

  return next;
}

function sanitizeEmail(raw: unknown) {
  return String(raw ?? "")
    .trim()
    // remove espaços e quebras em qualquer posição (inclui tabs/linhas)
    .replace(/\s+/g, "")
    // remove caracteres invisíveis comuns (zero-width)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // remove aspas acidentais no começo/fim
    .replace(/^"+|"+$/g, "")
    .toLowerCase();
}

function isValidEmail(email: string) {
  // validação simples para UI; o Supabase valida mais estrito internamente
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSiteUrl() {
  // prioridade: NEXT_PUBLIC_SITE_URL / SITE_URL
  const a = process.env.NEXT_PUBLIC_SITE_URL;
  const b = process.env.SITE_URL;
  if (a && a.trim()) return a.trim();
  if (b && b.trim()) return b.trim();

  // fallback: VERCEL_URL (sem protocolo)
  const v = process.env.VERCEL_URL;
  if (!v) return "";
  return v.startsWith("http") ? v : `https://${v}`;
}

export default async function AdminLoginPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;

  const next = safeNext(searchParams?.next, "/admin");

  // Se já estiver logado, manda direto para /admin (ou next)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(next);

  async function sendMagicLink(formData: FormData) {
    "use server";

    const email = sanitizeEmail(formData.get("email"));

    if (!email) {
      redirect(`/admin/login?error=missing_email&next=${encodeURIComponent(next)}`);
    }

    if (!isValidEmail(email)) {
      // Mostra o email sanitizado para facilitar debug (sem expor dados além do necessário)
      redirect(
        `/admin/login?error=${encodeURIComponent(
          `invalid_email:${email}`
        )}&next=${encodeURIComponent(next)}`
      );
    }

    const siteUrl = getSiteUrl();
    if (!siteUrl) {
      redirect(`/admin/login?error=missing_site_url&next=${encodeURIComponent(next)}`);
    }

    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    
    if (error) {
      const anyErr = error as any;
    
      // Log completo no servidor (Vercel logs)
      console.log("OTP_ERROR_FULL", {
        name: anyErr?.name,
        message: anyErr?.message,
        status: anyErr?.status,
        code: anyErr?.code,
        cause: anyErr?.cause,
      });
    
      // Mostra mais sinal no UI (sem depender só da message)
      const packed = JSON.stringify({
        m: anyErr?.message,
        s: anyErr?.status,
        c: anyErr?.code,
      });
    
      redirect(
        `/admin/login?error=${encodeURIComponent(packed)}&next=${encodeURIComponent(next)}`
      );
    }

  const error = typeof searchParams?.error === "string" ? searchParams.error : "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Acesso Admin</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enviaremos um link de acesso para seu e-mail.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border p-3 text-sm">
            {error === "sent" ? "Link enviado. Verifique seu e-mail." : `Erro: ${error}`}
          </div>
        ) : null}

        <form action={sendMagicLink} className="mt-6 space-y-3">
          <label className="block text-sm font-medium">
            E-mail
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="admin@auditavel.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Enviar link
          </button>
        </form>
      </div>
    </main>
  );
}
