//lib/supabase-server.ts

import { createServerClient } from '@supabase/auth-helpers-nextjs'; // Usando a função correta

export const supabaseServer = () => {
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL); // Verifique se a URL está correta
  console.log('Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); // Verifique se a chave está correta

  // Retornando o cliente Supabase configurado corretamente
  return createServerClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
};
