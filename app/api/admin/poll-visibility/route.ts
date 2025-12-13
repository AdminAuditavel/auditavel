import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { poll_id, show_partial_results } = await req.json();

    if (!poll_id || typeof show_partial_results !== "boolean") {
      return NextResponse.json(
        { error: "missing_or_invalid_data" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("polls")
      .update({ show_partial_results })
      .eq("id", poll_id);

    if (error) {
      console.error("Erro ao atualizar visibilidade:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
