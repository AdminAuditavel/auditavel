// lib/admin-auth.ts
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Regra de admin (V1):
 * - Aceita token legado: ?token=... (ADMIN_TOKEN)
 * - OU aceita sessão Supabase (magic link) com e-mail = ADMIN_EMAIL
 */
export async function isAdminRequest(params?: { token?: string | null }) {
  // 1) Token legado (query string)
  const token = params?.token ?? null;
  const legacyOk = !!token && token === process.env.ADMIN_TOKEN;

  if (legacyOk) return { ok: true as const, mode: "token" as const };

  // 2) Sessão Supabase (cookie)
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  const adminEmail = (process.env.ADMIN_EMAIL || "auditavel@gmail.com").toLowerCase();
  const emailOk =
    !!adminEmail &&
    !!user?.email &&
    user.email.toLowerCase() === adminEmail;

  if (emailOk) return { ok: true as const, mode: "session" as const };

  return { ok: false as const, mode: "none" as const };
}
