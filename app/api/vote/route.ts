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

    // Busca se já existe voto desse user nessa pesquisa
    const { data: existing, error: existingError } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", poll_id)
      .eq("user_hash", user_hash)
      .maybeSingle();

    if (existingError) {
      console.log("Erro ao buscar voto existente:", existingError);
    }

    // MODO A — allow_multiple = false → 1 voto por usuário, atualizável
    if (!poll.allow_multiple) {
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
    // Agora: permite MUDAR o voto sem erro.
    // Se já tiver voto desse usuário, vamos atualizar em vez de quebrar.
    if (existing) {
      const { error } = await supabase
        .from("votes")
        .update({
          option_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        console.log("Erro ao atualizar voto (modo B):", error);
        return NextResponse.json({ error }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: true });
    }

    // Se ainda não tem voto desse usuário nessa pesquisa → insere novo
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
