// lib/supabase-admin.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy admin Supabase client + factory.
 *
 * - getSupabaseAdmin(): cria/retorna o client explicitamente (use dentro de handlers).
 * - supabaseAdmin: proxy que instancia o client no primeiro acesso a qualquer propriedade,
 *   preservando compatibilidade com código que ainda assume um client importado.
 *
 * Observação: se algum ficheiro acede a supabaseAdmin em tempo de import (top-level),
 * a proxy irá instanciar o client nesse momento — então evite chamar métodos do client
 * no topo do módulo. Idealmente use getSupabaseAdmin() dentro de handlers.
 */

function createAdminClient(): SupabaseClient<any> {
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

let _adminClient: SupabaseClient<any> | null = null;

export function getSupabaseAdmin(): SupabaseClient<any> {
  if (!_adminClient) {
    _adminClient = createAdminClient();
  }
  return _adminClient;
}

/**
 * Exporta supabaseAdmin como proxy para manter compatibilidade com os ficheiros que importam
 * a variável original. O client só será criado quando alguma propriedade for usada.
 */
export const supabaseAdmin: SupabaseClient<any> = new Proxy(
  {},
  {
    get(_, prop: string | symbol) {
      return (getSupabaseAdmin() as any)[prop];
    },
    set(_, prop: string | symbol, value: unknown) {
      (getSupabaseAdmin() as any)[prop] = value;
      return true;
    },
    apply(_, thisArg, args) {
      return (getSupabaseAdmin() as any).apply(thisArg, args);
    },
    has(_, prop) {
      return prop in (getSupabaseAdmin() as any);
    },
    ownKeys() {
      return Reflect.ownKeys(getSupabaseAdmin() as any);
    },
    getOwnPropertyDescriptor() {
      return Object.getOwnPropertyDescriptor(getSupabaseAdmin() as any, arguments[2]);
    },
  }
) as any;
