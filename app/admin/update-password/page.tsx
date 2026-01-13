// app/admin/update-password/page.tsx

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SearchParams = { error?: string };

export default async function AdminUpdatePasswordPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const error =
    typeof searchParams?.error === "string" ? searchParams.error : "";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se não houver sessão, não tem como atualizar senha
  if (!user) {
    redirect(`/admin/login?error=${encodeURIComponent("missing_session")}`);
  }

  async function updatePassword(formData: FormData) {
    "use server";

    const password = String(formData.get("password") ?? "");
    const password2 = String(formData.get("password2") ?? "");

    if (!password || password.length < 10) {
      redirect(
        `/admin/update-password?error=${encodeURIComponent("weak_password_min_10")}`
      );
    }
    if (password !== password2) {
      redirect(
        `/admin/update-password?error=${encodeURIComponent("passwords_do_not_match")}`
      );
    }

    const supabase = await supabaseServer();

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      redirect(
        `/admin/update-password?error=${encodeURIComponent(error.message)}`
      );
    }

    // Opcional: pode mandar para /admin direto
    redirect("/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Definir nova senha</h1>
        <p className="mt-2 text-sm text-gray-600">
          Você está autenticado como <strong>{user.email}</strong>. Defina uma nova
          senha para concluir.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border p-3 text-sm">{`Erro: ${error}`}</div>
        ) : null}

        <form action={updatePassword} className="mt-6 space-y-3">
          <label className="block text-sm font-medium">
            Nova senha
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="mínimo 10 caracteres"
              autoComplete="new-password"
            />
          </label>

          <label className="block text-sm font-medium">
            Confirmar nova senha
            <input
              name="password2"
              type="password"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="repita a senha"
              autoComplete="new-password"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Salvar nova senha
          </button>
        </form>
      </div>
    </main>
  );
}
