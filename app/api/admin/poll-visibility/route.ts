// app/api/admin/poll-visibility/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server"; // Usando supabaseServer para SSR

export async function POST(req: NextRequest) {
  try {
    // =========================
    // AUTH (token OU sessão)
    // =========================
    const admin = await isAdminRequest();  // Garantindo que só admin pode acessar
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Processando dados do corpo da requisição
    const body = await req.json();
    const { poll_id, show_partial_results } = body as {
      poll_id?: string;
      show_partial_results?: boolean;
    };

    // 🔒 Validações básicas
    if (!poll_id || typeof show_partial_results !== "boolean") {
      return NextResponse.json(
        { error: "missing_data" },
        { status: 400 }
      );
    }

    // 1️⃣ Buscar valor atual
    const { data: poll, error: fetchError } = await supabase
      .from("polls")
      .select("show_partial_results")
      .eq("id", poll_id)
      .single();

    if (fetchError || !poll) {
      return NextResponse.json(
        { error: "poll_not_found" },
        { status: 404 }
      );
    }

    const oldValue = poll.show_partial_results;

    // 2️⃣ Atualizar visibilidade
    const { error: updateError } = await supabase
      .from("polls")
      .update({ show_partial_results })
      .eq("id", poll_id);

    if (updateError) {
      return NextResponse.json(
        { error: "db_error", details: updateError.message },
        { status: 500 }
      );
    }

    // 3️⃣ Registrar auditoria
    await supabase
      .from("admin_audit_logs")
      .insert({
        poll_id,
        action: "visibility_change",
        old_value: String(oldValue),
        new_value: String(show_partial_results),
      });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
