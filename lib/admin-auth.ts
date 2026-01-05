// lib/admin-auth.ts

import { supabaseServer } from "@/lib/supabase-server";

/**
 * Regra de admin (V2):
 * - Aceita apenas sessão Supabase
 * - Admin definido por e-mail allowlist
 */
const ADMIN_EMAILS = new Set([
  "auditavel@gmail.com",  // Adicione outros emails de admin aqui
]);

export async function isAdminRequest() {
  const supabase = supabaseServer();  // Usando o Supabase com SSR e cookies

  // Tentando obter o usuário autenticado a partir dos cookies da requisição
  const { data: { user }, error } = await supabase.auth.getUser();

  // Verificando se houve erro na obtenção do usuário ou se o usuário não está autenticado
  if (error || !user) {
    console.log("Usuário não autenticado ou sessão expirada.", error);
    return { ok: false };  // Retorna falha se o usuário não estiver autenticado
  }

  // Verificando se o e-mail do usuário está na lista de administradores
  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return { ok: true as const, user };  // Retorna sucesso se o e-mail for de um admin
  }

  // Caso o usuário não seja admin
  return { ok: false as const };
}
