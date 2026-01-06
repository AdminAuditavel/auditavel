// app/admin/login/page.tsx

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

  // SSR: checa sessão via cookies
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(next);

  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      redirect(
        `/admin/login?error=${encodeURIComponent(
          "missing_email_or_password"
        )}&next=${encodeURIComponent(next)}`
      );
    }

    // Criar o client DENTRO da Server Action com adapter de cookies que grava cookies
    const cookieStore = await cookies();

    const supabaseAction = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll().map((c) => ({
              name: c.name,
              value: c.value,
            }));
          },
          setAll(cookiesToSet: Array<any>) {
            for (const c of cookiesToSet) {
              const opts: Record<string, any> = {};
              if (c.path !== undefined) opts.path = c.path;
              if (c.domain !== undefined) opts.domain = c.domain;
              if (c.httpOnly !== undefined) opts.httpOnly = c.httpOnly;
              if (c.secure !== undefined) opts.secure = c.secure;
              if (c.sameSite !== undefined) opts.sameSite = c.sameSite;
              if (c.maxAge !== undefined) opts.maxAge = c.maxAge;
              if (c.expires !== undefined) {
                opts.expires =
                  typeof c.expires === "string" ? new Date(c.expires) : c.expires;
              }

              cookieStore.set({
                name: c.name,
                value: c.value,
                ...opts,
              });
            }
          },
        },
      }
    );

    const { error } = await supabaseAction.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(
        `/admin/login?error=${encodeURIComponent(
          error.message
        )}&next=${encodeURIComponent(next)}`
      );
    }

    redirect(next);
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
              height={36}
              priority
            />
          </Link>
        </div>

        <p className="mt-2 text-sm text-gray-600">Entre com e-mail e senha.</p>

        {error ? (
          <div className="mt-4 rounded-lg border p-3 text-sm">{`Erro: ${error}`}</div>
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
