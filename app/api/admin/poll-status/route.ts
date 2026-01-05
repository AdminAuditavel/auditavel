//app/api/admin/poll-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs"; // Garantir que estamos usando a função de criação correta
import { isAdminRequest } from "@/lib/admin-auth"; // Função para validar se o usuário tem permissões de admin

export async function POST(req: NextRequest) {
  try {
    // =========================
    // AUTH (token OU sessão)
    // =========================
    const admin = await isAdminRequest();  // Garantindo que só admin pode acessar
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Criando o cliente do Supabase
    const supabase = createServerSupabaseClient({ req }); // Instanciando corretamente o cliente Supabase

    // Processando dados do corpo da requisição
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

    // 1️⃣ Buscar status atual
    const { data: poll, error: fetchError } = await supabase
      .from("polls")
      .select("status")
      .eq("id", poll_id)
      .single();

    if (fetchError || !poll) {
      return NextResponse.json(
        { error: "poll_not_found" },
        { status: 404 }
      );
    }

    const oldStatus = poll.status;

    // 2️⃣ Atualizar status
    const { error: updateError } = await supabase
      .from("polls")
      .update({ status })
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
        action: "status_change",
        old_value: oldStatus,
        new_value: status,
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

