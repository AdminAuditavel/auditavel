//app/api/participant-attributes/check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const participantId = searchParams.get("participant_id");
  const pollId = searchParams.get("poll_id"); // Adicionando poll_id

  if (!participantId || !pollId) {  // Verificando se ambos são passados
    return NextResponse.json(
      { error: "missing_participant_or_poll_id" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("participant_attributes")
    .select("participant_id")
    .eq("participant_id", participantId)
    .eq("poll_id", pollId)  // Verificando para a pesquisa específica
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar atributos:", error);
    return NextResponse.json(
      { error: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    exists: Boolean(data),  // Retorna se já existem dados para esse participante na pesquisa
  });
}
