// lib/admin-auth.ts

import { supabaseServer } from "@/lib/supabase-server";

const ADMIN_EMAILS = new Set(
  ["auditavel@gmail.com"].map((e) => e.toLowerCase())
);

export async function isAdminRequest() {
  try {
    // supabaseServer é assíncrono — aguardar para obter o client real
    const supabase = await supabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.log("Usuário não autenticado ou sessão expirada.", error?.message);
      return { ok: false as const, error: error?.message ?? "no_user" };
    }

    const email = user.email?.toLowerCase() ?? "";
    if (email && ADMIN_EMAILS.has(email)) {
      return { ok: true as const, user };
    }

    return { ok: false as const, error: "not_admin" };
  } catch (err) {
    console.error("isAdminRequest error:", err);
    return { ok: false as const, error: "internal_error" };
  }
}
