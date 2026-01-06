//lib/supabase-server.ts

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retorna um SupabaseClient para uso em Server Components e Server Actions.
 * - NÃO modifica cookies durante SSR.
 * - Em Server Actions / Route Handlers, chamadas que escrevem cookies (ex.: setSession)
 *   poderão executar corretamente porque essas rotas/ações permitem modificação de cookies.
 */
export async function supabaseServer(): Promise<SupabaseClient<any>> {
  return createServerComponentClient({ cookies });
}
