import { supabase } from "@/lib/supabase";

export async function vote(poll_id: string, option_id: string, allow_multiple: boolean) {
  // Verifica se o usuário já votou
  const { data: existingVote } = await supabase
    .from("votes")
    .select("*")
    .eq("poll_id", poll_id)
    .eq("option_id", option_id)
    .single();

  // Se o voto já existir e "permitir múltiplos votos" for falso, retorna
  if (existingVote && !allow_multiple) {
    return { error: "Você já votou nesta opção." };
  }

  // Se tudo certo, insere o voto
  const { data, error } = await supabase
    .from("votes")
    .insert([{ poll_id: poll_id, option_id: option_id }]);

  if (error) {
    return { error: error.message };
  }

  return { data };
}
