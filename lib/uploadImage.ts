// lib/uploadImage.ts

import { supabase } from "@/lib/supabase"; // Certifique-se de ter a instância do Supabase configurada

// Função para fazer o upload da imagem
export async function uploadImageToStorage(imageFile: File) {
  const bucketName = "poll-icons"; // Nome do seu bucket no Supabase Storage
  const fileName = `poll-icon-${Date.now()}.${imageFile.name.split(".").pop()}`; // Nome único para o arquivo

  // Envia o arquivo para o Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, imageFile);

  if (error) {
    console.error("Erro ao fazer upload da imagem:", error.message);
    return null;
  }

  // Obtém a URL pública do arquivo carregado
  const { publicURL, error: urlError } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  if (urlError) {
    console.error("Erro ao gerar URL pública:", urlError.message);
    return null;
  }

  return publicURL; // Retorna a URL pública da imagem
}
