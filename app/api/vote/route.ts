import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, option_id } = body;

    if (!poll_id || !option_id) {
      return NextResponse.json(
        { error: "poll_id e option_id são obrigatórios" },
        { status: 400 }
      );
    }

    // MVP: user_hash aleatório (depois vamos trocar por algo persistente/único)
    const user_hash = "anon_" + randomUUID();

    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1, // usamos 1 por voto individual
      // created_at e updated_at podem ficar com default do banco, se configurado
    });

    if (error) {
      console.error("Erro ao inserir voto:", error);
      return NextResponse.json(
        { error: "Erro ao registrar voto" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro na rota /api/vote:", e);
    return NextResponse.json(
      { error: "Erro inesperado ao processar o voto" },
      { status: 500 }
    );
  }
}
