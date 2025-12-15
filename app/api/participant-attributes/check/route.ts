// app/api/participant-attributes/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const participantId = searchParams.get("participant_id");

  if (!participantId) {
    return NextResponse.json(
      { error: "missing_participant_id" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("participant_attributes")
    .select("participant_id")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar atributos:", error);
    return NextResponse.json(
      { error: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    exists: Boolean(data),
  });
}
