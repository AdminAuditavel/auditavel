// lib/supabase-admin.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Factory para obter um Supabase client com SERVICE_ROLE_KEY para operações administrativas.
 * Não cria o client em tempo de import para evitar falhas durante o build quando as envs não existirem.
 */
export function getSupabaseAdmin(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE configuration: ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
