// app/admin/login/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

type SearchParams = { next?: string; error?: string };

function safeNext(raw: unknown, fallback = "/admin") {
  if (typeof raw !== "string") return fallback;
  const next = raw.trim();
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\n") || next.includes("\r")) return fallback;
  return next;
}

export default async function AdminLoginPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const next = safeNext(searchParams?.next, "/admin");

  const { data: { user } } = await supabase.auth.getUser();
// if (user) redirect(next); // desativado para evitar loop enquanto /admin exige token

  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      redirect(
        `/admin/login?error=${encodeURIComponent("missing_email_or_password")}&next=${encodeURIComponent(next)}`
      );
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(
        `/admin/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
      );
    }

    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken) {
      redirect(`/admin/login?error=${encodeURIComponent("missing_admin_token")}&next=${encodeURIComponent(next)}`);
    }
    
    // garante que o token vá junto mesmo se o next for /admin
    const sep = next.includes("?") ? "&" : "?";
    redirect(`${next}${sep}token=${encodeURIComponent(adminToken)}`);
  }

  const error = typeof searchParams?.error === "string" ? searchParams.error : "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
       <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Acesso Admin</h1>
        
          <Link href="/" aria-label="Voltar ao site">
            <Image
              src="/Logo_A-removebg-preview.png"
              alt="Auditável"
              width={28}
              height={28}
              priority
            />
          </Link>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Entre com e-mail e senha.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border p-3 text-sm">
            {`Erro: ${error}`}
          </div>
        ) : null}

        <form action={signIn} className="mt-6 space-y-3">
          <label className="block text-sm font-medium">
            E-mail
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="seuemail@gmail.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <label className="block text-sm font-medium">
            Senha
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
