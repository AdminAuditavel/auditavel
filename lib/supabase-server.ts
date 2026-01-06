//lib/supabase-server.ts

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client para Server Components / SSR.
 * - NÃO modifica cookies durante a renderização (setAll é noop).
 * - Retorna uma Promise<SupabaseClient> (função async).
 *
 * Observação importante:
 * - Como esta função é async, os chamadores devem usar `await supabaseServer()`.
 *   Se houver chamadas sem `await` no seu código, o TypeScript apontará que
 *   `supabase` é uma Promise e acessos como `supabase.auth` falharão.
 * - Operações que precisam ESCREVER cookies (setSession, signOut, signInWithPassword)
 *   devem criar um client no contexto da Route Handler / Server Action usando
 *   createServerClient(...) (ou createRouteHandlerClient se migrar para auth-helpers).
 */
export async function supabaseServer(): Promise<SupabaseClient<any>> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // NOOP durante SSR para evitar o erro do Next: "Cookies can only be modified..."
        setAll() {
          /* noop intencional: não gravar cookies durante SSR */
        },
      },
    }
  );
}
