import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, status } = body as {
      poll_id?: string;
      status?: "draft" | "open" | "paused" | "closed";
    };

    // 🔒 Validações básicas
    if (!poll_id || !status) {
      return NextResponse.json(
        { error: "missing_data" },
        { status: 400 }
      );
    }

    // 🔄 Update no banco
    const { error } = await supabase
      .from("polls")
      .update({ status })
      .eq("id", poll_id);

    if (error) {
      console.error("Erro ao atualizar status:", error);
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
