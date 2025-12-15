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
    .from("participant_profile")
    .select(
      "age_range, education_level, region, income_range"
    )
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar perfil:", error);
    return NextResponse.json(
      { error: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profile: data || null,
  });
}
