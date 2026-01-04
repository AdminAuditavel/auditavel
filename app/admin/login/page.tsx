// app/admin/login/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SearchParams = { next?: string; error?: string };

export default async function AdminLoginPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const next =
    typeof searchParams?.next === "string" ? searchParams.next : "/admin";

  // Se já estiver logado, manda direto para /admin (ou next)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  async function sendMagicLink(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) {
      redirect(`/admin/login?error=missing_email&next=${encodeURIComponent(next)}`);
    }

    // URL base (Vercel usa headers, mas aqui vamos pelo env; é o mais estável)
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.VERCEL_URL?.startsWith("http")
        ? process.env.VERCEL_URL
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "";

    if (!siteUrl) {
      redirect(
        `/admin/login?error=missing_site_url&next=${encodeURIComponent(next)}`
      );
    }

    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      redirect(
        `/admin/login?error=${encodeURIComponent(
          error.message
        )}&next=${encodeURIComponent(next)}`
      );
    }

    // Tela simples de confirmação (sem estado client)
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=sent`);
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
            {error === "sent"
              ? "Link enviado. Verifique seu e-mail."
              : `Erro: ${error}`}
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
              placeholder="seuemail@dominio.com"
              autoComplete="email"
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
