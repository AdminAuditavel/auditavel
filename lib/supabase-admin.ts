// lib/supabase-admin.ts

import { createClient } from '@supabase/supabase-js';

/**
 * Função para configurar o cliente Supabase com o SERVICE_ROLE_KEY para
 * manipulação de dados administrativos no banco de dados.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,  // URL do Supabase
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // SERVICE_ROLE_KEY para acessar o banco com permissões administrativas
);
