import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializar o cliente do Supabase com as variáveis de ambiente
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Obter os dados enviados pelo formulário
    const body = await request.json();

    const { title, description, type, status, allow_multiple, max_votes_per_user, allow_custom_option, closes_at } =
      body;

    // Validar os campos obrigatórios
    if (!title || !type || !status) {
      return NextResponse.json(
        { error: "Os campos 'title', 'type' e 'status' são obrigatórios." },
        { status: 400 }
      );
    }

    // Inserir os dados na tabela `polls`
    const { data, error } = await supabase.from("polls").insert({
      title,
      description,
      type,
      status,
      allow_multiple,
      max_votes_per_user: max_votes_per_user || null, // Defina como null se não preenchido
      allow_custom_option,
      closes_at: closes_at ? new Date(closes_at).toISOString() : null, // Converter closes_at para ISO
    });

    // Verificar se houve algum erro no Supabase
    if (error) {
      console.error("Erro ao inserir no Supabase:", error);
      return NextResponse.json(
        { error: "Erro ao salvar a pesquisa. Por favor, tente novamente." },
        { status: 500 }
      );
    }

    // Retornar sucesso
    return NextResponse.json({ message: "Pesquisa cadastrada com sucesso!", data }, { status: 201 });
  } catch (err) {
    console.error("Erro no endpoint:", err);
    return NextResponse.json(
      { error: "Erro desconhecido ao processar a solicitação." },
      { status: 500 }
    );
  }
}
