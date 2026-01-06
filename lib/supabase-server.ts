//lib/supabase-server.ts

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client para Server Components / SSR.
 * - Não modifica cookies durante renderização (setAll é noop).
 * - Retorna o client de forma síncrona para manter compatibilidade com chamadas existentes.
 *
 * Nota: operações que precisam ESCREVER cookies (setSession, signOut, signInWithPassword)
 * devem usar createRouteHandlerClient({ cookies }) ou criar o client dentro de um
 * Route Handler / Server Action (contexto onde a escrita de cookies é permitida).
 */
export function supabaseServer(): SupabaseClient<any> {
  const cookieStore = cookies(); // use synchronous cookie store

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // NOOP durante SSR para evitar a exceção do Next.js
        setAll() {
          /* intentionally no-op in SSR */
        },
      },
    }
  );
}
