//lib/supabase-server.ts

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client para uso em Server Components / SSR.
 * - NÃO grava cookies durante a renderização (setAll é noop).
 * - Retorna o client de forma síncrona para evitar necessidade de `await` em chamadas existentes.
 *
 * Observação: rotas/Server Actions que precisem gravar sessão (setSession) devem usar
 * createRouteHandlerClient ou criar o client dentro do handler/Server Action.
 */
export function supabaseServer(): SupabaseClient<any> {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // apenas leitura dos cookies atuais
        getAll() {
          return cookieStore.getAll();
        },
        // NOOP: não gravar cookies durante SSR (evita erro do Next)
        setAll() {
          /* intentionally empty */
        },
      },
    }
  );
}
