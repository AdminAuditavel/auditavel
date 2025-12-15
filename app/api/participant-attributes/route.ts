import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      participant_id,
      poll_id,
      age_range,
      education_level,
      region,
      income_range,
    } = body as {
      participant_id?: string;
      poll_id?: string;
      age_range?: string;
      education_level?: string;
      region?: string;
      income_range?: string;
    };

    if (!participant_id || !poll_id) {
      return NextResponse.json(
        { error: "missing_participant_or_poll" },
        { status: 400 }
      );
    }

    /* =======================
       1. SNAPSHOT DA PESQUISA
    ======================= */
    const { error: snapshotError } = await supabase
      .from("participant_attributes")
      .upsert(
        {
          participant_id,
          poll_id,
          age_range,
          education_level,
          region,
          income_range,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "participant_id,poll_id",
        }
      );

    if (snapshotError) {
      console.error("Erro snapshot:", snapshotError);
      return NextResponse.json(
        { error: "snapshot_error", details: snapshotError.message },
        { status: 500 }
      );
    }

    /* =======================
       2. PERFIL GLOBAL
       (UPSERT SILENCIOSO)
    ======================= */
    const { error: profileError } = await supabase
      .from("participant_profile")
      .upsert(
        {
          participant_id,
          age_range,
          education_level,
          region,
          income_range,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "participant_id",
        }
      );

    if (profileError) {
      // ⚠️ não quebra o fluxo do usuário
      console.error("Erro perfil:", profileError);
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
