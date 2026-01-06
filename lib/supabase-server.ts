//lib/supabase-server.ts


import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client para Server Components / SSR.
 * - NÃO modifica cookies durante a renderização.
 * - Retorna o client de forma síncrona para compatibilidade com chamadas existentes.
 *
 * Para operações que precisam ESCREVER cookies (setSession, signOut, signInWithPassword),
 * crie um client dentro do Route Handler / Server Action usando
 * createServerClient(...) ou createRouteHandlerClient({ cookies }) no contexto apropriado.
 */
export function supabaseServer(): SupabaseClient<any> {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  );
}
