import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { poll_id, option_id, user_hash } = await req.json();

    if (!poll_id || !option_id || !user_hash) {
      return NextResponse.json({ error: "missing data" }, { status: 400 });
    }

    // Busca configuração da pesquisa
    const { data: poll } = await supabase
      .from("polls")
      .select("allow_multiple")
      .eq("id", poll_id)
      .single();

    if (!poll) return NextResponse.json({ error: "poll_not_found" }, { status: 404 });

    // MODO A — apenas 1 voto por usuário (atualizável)
    if (!poll.allow_multiple) {
      // verifica se já existe voto desse user
      const { data: existing } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .maybeSingle();

      if (existing) {
        // atualiza o voto
        const { error } = await supabase
          .from("votes")
          .update({
            option_id,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (error) return NextResponse.json({ error }, { status: 500 });

        return NextResponse.json({ success: true, updated: true });
      }

      // se não existe, cria novo
      const { error } = await supabase.from("votes").insert({
        id: randomUUID(),
        poll_id,
        option_id,
        user_hash,
        votes_count: 1,
      });

      if (error) return NextResponse.json({ error }, { status: 500 });

      return NextResponse.json({ success: true });
    }

    // MODO B — múltiplos votos permitidos
    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1,
    });

    if (error) return NextResponse.json({ error }, { status: 500 });

    return NextResponse.json({ success: true });

  } catch (e) {
    console.log("Erro interno:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
