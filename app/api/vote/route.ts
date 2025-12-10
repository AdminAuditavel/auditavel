import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { poll_id, option_id, user_hash } = await req.json();

    if (!poll_id || !option_id || !user_hash) {
      return NextResponse.json({ error: "missing_data" }, { status: 400 });
    }

    // Buscar configuração da pesquisa
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple")
      .eq("id", poll_id)
      .single();

    if (pollError || !poll) {
      console.error("Erro ao buscar poll:", pollError);
      return NextResponse.json({ error: "poll_not_found", details: pollError?.message ?? null }, { status: 404 });
    }

    // MODO A — voto único (atualiza ou insere)
    if (!poll.allow_multiple) {
      const { data: existing, error: existingError } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .maybeSingle();

      if (existingError) {
        console.error("Erro ao buscar voto existente (modo A):", existingError);
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
          console.error("Erro ao atualizar voto (modo A):", error);
          return NextResponse.json({ error: "update_failed", details: error.message ?? error }, { status: 500 });
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
        console.error("Erro ao inserir voto (modo A):", error);
        return NextResponse.json({ error: "insert_failed", details: error.message ?? error }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // MODO B — allow_multiple = true (sempre inserir, ignorar duplicata exata)
    const { data: duplicate, error: dupError } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", poll_id)
      .eq("user_hash", user_hash)
      .eq("option_id", option_id)
      .maybeSingle();

    if (dupError) {
      console.error("Erro ao checar duplicata (modo B):", dupError);
      // prosseguir para inserir e reportar erro se ocorrer
    }

    if (duplicate) {
      // duplicata exata — idempotente
      return NextResponse.json({ success: true, message: "duplicate_vote_ignored" });
    }

    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1,
    });

    if (error) {
      console.error("Erro ao inserir voto (modo B):", error);
      // Retorna detalhes do erro para o cliente (temporário, para debug)
      return NextResponse.json({ error: "insert_failed", details: error.message ?? error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json({ error: "internal_error", details: String(e) }, { status: 500 });
  }
}
