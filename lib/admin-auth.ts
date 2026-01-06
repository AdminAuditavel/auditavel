// lib/admin-auth.ts

import { supabaseServer } from "@/lib/supabase-server";

const ADMIN_EMAILS = new Set(["auditavel@gmail.com"]);

export async function isAdminRequest() {
  const supabase = supabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.log("Usuário não autenticado ou sessão expirada.", error?.message);
    return { ok: false as const, error: error?.message ?? "no_user" };
  }

  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return { ok: true as const, user };
  }

  return { ok: false as const, error: "not_admin" };
}
