//lib/supabase-server.ts


import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client para Server Components / SSR.
 * - NÃO modifica cookies durante a renderização.
 * - Retornado de forma síncrona para evitar necessidade de `await` nos locais atuais.
 *
 * Observação: operações que precisam ESCREVER cookies (setSession, signOut, etc.)
 * devem usar createRouteHandlerClient({ cookies }) dentro de Route Handlers
 * ou criar o client dentro de uma Server Action (onde a escrita de cookies é permitida).
 */
export function supabaseServer(): SupabaseClient<any> {
  return createServerComponentClient({ cookies });
}
