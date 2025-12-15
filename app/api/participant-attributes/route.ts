// app/api/participant-attributes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      participant_id,
      age_range,
      education_level,
      region,
      income_range,
    } = body as {
      participant_id?: string;
      age_range?: string;
      education_level?: string;
      region?: string;
      income_range?: string;
    };

    if (!participant_id) {
      return NextResponse.json(
        { error: "missing_participant_id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("participant_attributes")
      .upsert(
        {
          participant_id,
          age_range,
          education_level,
          region,
          income_range,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_id" }
      );

    if (error) {
      console.error("Erro ao salvar atributos:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
