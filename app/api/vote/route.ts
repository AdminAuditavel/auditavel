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
      return NextResponse.json(
        { error: "poll_not_found", details: pollError?.message ?? null },
        { status: 404 }
      );
    }

    // ================================================================
    // MODO A — VOTO ÚNICO (allow_multiple = false)
    // ================================================================
    if (!poll.allow_multiple) {
      // Verificar se já existe voto desse usuário
      const { data: existing, error: existingError } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .maybeSingle();

      if (existingError) {
        console.error("Erro ao buscar voto existente (modo A):", existingError);
      }

      // Se já existe, atualiza a opção votada
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
          return NextResponse.json(
            { error: "update_failed", details: error.message ?? error },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, updated: true });
      }

      // Se não existe, insere novo voto
      const { error } = await supabase.from("votes").insert({
        id: randomUUID(),
        poll_id,
        option_id,
        user_hash,
        votes_count: 1,
      });

      if (error) {
        console.error("Erro ao inserir voto (modo A):", error);
        return NextResponse.json(
          { error: "insert_failed", details: error.message ?? error },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // ================================================================
    // MODO B — VOTO MÚLTIPLO (allow_multiple = true)
    // ================================================================

    const { error: insertError } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1,
    });

    if (insertError) {
      console.error("Erro ao inserir voto (modo B):", insertError);
      return NextResponse.json(
        { error: "insert_failed", details: insertError.message ?? insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json(
      { error: "internal_error", details: String(e) },
      { status: 500 }
    );
  }
}
