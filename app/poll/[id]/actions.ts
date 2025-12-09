"use server"

import { supabase } from "@/lib/supabase";

/**
 * Registra um voto
 * @param poll_id ID da pesquisa
 * @param option_id ID da opção escolhida
 * @param allow_multiple Se a poll permite múltiplos votos
 */
export async function vote(poll_id: string, option_id: string, allow_multiple: boolean) {
  // Se NÃO pode múltiplos votos, apagamos o voto anterior deste usuário
  if (!allow_multiple) {
    await supabase
      .from("votes")
      .delete()
      .eq("poll_id", poll_id)
      .eq("user_id", "DEV_USER"); // ← depois trocaremos por cookie/conta real
  }

  // Insere novo voto
  const { error } = await supabase
    .from("votes")
    .insert({ poll_id, option_id, user_id: "DEV_USER" });

  if (error) throw error;

  return { success: true };
}
