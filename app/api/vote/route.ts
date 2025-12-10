import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { poll_id, option_id, user_hash } = await req.json();

    if (!poll_id || !option_id || !user_hash) {
      return NextResponse.json({ error: "missing data" }, { status: 400 });
    }

    // Buscar configuração da pesquisa
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple")
      .eq("id", poll_id)
      .single();

    if (pollError || !poll) {
      console.log("Erro ao buscar poll:", pollError);
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    // MODO A — allow_multiple = false → 1 voto por usuário, atualizável
    if (!poll.allow_multiple) {
      // Buscar se já existe voto desse user nessa pesquisa
      const { data: existing, error: existingError } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .maybeSingle();

      if (existingError) {
        console.log("Erro ao buscar voto existente (modo A):", existingError);
      }

      if (existing) {
        const { error } = await supabase
          .from("votes")
          .update({
            option_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          console.log("Erro ao atualizar voto (modo A):", error);
          return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ success: true, updated: true });
      }

      const { error } = await supabase.from("votes").insert({
        id: randomUUID(),
        poll_id,
        option_id,
        user_hash,
        votes_count: 1,
      });

      if (error) {
        console.log("Erro ao inserir voto (modo A):", error);
        return NextResponse.json({ error }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // MODO B — allow_multiple = true
    // Para permitir múltiplos votos por usuário nesta pesquisa, sempre INSERIR
    // (não atualizar o voto existente). Opcional: evitar inserir duplicata
    // exata (mesmo poll_id + user_hash + option_id) — a seguir checamos isso.

    // Verifica se já existe exatamente o mesmo voto (mesma opção)
    const { data: duplicate, error: dupError } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", poll_id)
      .eq("user_hash", user_hash)
      .eq("option_id", option_id)
      .maybeSingle();

    if (dupError) {
      console.log("Erro ao checar duplicata (modo B):", dupError);
      // Não falhar por causa dessa checagem; continuar para tentar inserir
    }

    if (duplicate) {
      // Já existe o mesmo voto -> não inserir duplicata exata. Retornar sucesso idempotente.
      return NextResponse.json({ success: true, message: "duplicate_vote_ignored" });
    }

    // Insere nova linha de voto — cada inserção representa 1 voto
    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1,
    });

    if (error) {
      console.log("Erro ao inserir voto (modo B):", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.log("Erro interno:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
