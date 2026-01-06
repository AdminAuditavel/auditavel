//lib/supabase-server.ts

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retorna um SupabaseClient para uso em Server Components e Server Actions.
 * - NÃO modifica cookies durante a renderização (evita o erro de "Cookies can only be modified...").
 * - Retornado de forma síncrona para evitar a necessidade de `await` em chamadas já existentes.
 */
export function supabaseServer(): SupabaseClient<any> {
  // createServerComponentClient é síncrono e usa os cookies da requisição (next/headers)
  return createServerComponentClient({ cookies });
}
