//lib/admin-auth.ts

import { supabaseServer } from "@/lib/supabase-server";

/**
 * Regra de admin (V2):
 * - Aceita apenas sessão Supabase
 * - Admin definido por e-mail allowlist
 */
const ADMIN_EMAILS = new Set([
  "auditavel@gmail.com",
]);

export async function isAdminRequest() {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (user?.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return { ok: true as const, user };
  }

  return { ok: false as const };
}
