//lib/supabase-server.ts

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function supabaseServer(): Promise<SupabaseClient<any>> {
  // Retorna um client SSR que lê os cookies da requisição.
  // NÃO modifica cookies durante a renderização (evita o erro de "Cookies can only be modified...").
  return createServerComponentClient({ cookies });
}
