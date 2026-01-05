//lib/supabase-server.ts

import { createServerClient } from '@supabase/ssr';  // Importação do Supabase SSR
import { cookies } from 'next/headers';  // Para acessar os cookies da requisição

/**
 * Função para configurar o Supabase SSR no backend, que lê os cookies de autenticação
 * do usuário para garantir que a sessão seja validada corretamente no servidor.
 */
export function supabaseServer() {
  const cookieStore = cookies();  // Acessando os cookies da requisição para usar no servidor
  
  // Retornando a instância do cliente Supabase configurada para SSR com autenticação via cookies
  return createServerClient({
    req: cookieStore,  // Lê os cookies da requisição
    res: {},  // Não precisa configurar a resposta aqui para este caso específico
  });
}
