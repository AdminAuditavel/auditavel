import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, option_id, user_hash } = body;

    console.log("Body recebido em /api/vote:", body);

    if (!poll_id || !option_id || !user_hash) {
      console.log("Erro: dados ausentes", { poll_id, option_id, user_hash });
      return NextResponse.json(
        { error: "poll_id, option_id e user_hash são obrigatórios" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,      // <-- AGORA usa exatamente o que veio do front
      votes_count: 1,
    });

    if (error) {
      console.log("Erro Supabase INSERT:", error);
      return NextResponse.json(
        { error: "Erro ao registrar voto" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.log("Erro interno /api/vote:", e);
    return NextResponse.json(
      { error: "Erro inesperado ao processar o voto" },
      { status: 500 }
    );
  }
}
