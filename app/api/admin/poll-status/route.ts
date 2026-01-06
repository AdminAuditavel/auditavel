//app/api/admin/poll-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { isAdminRequest } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const admin = await isAdminRequest();
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const { poll_id, status } = (body ?? {}) as {
      poll_id?: string;
      status?: "draft" | "open" | "paused" | "closed";
    };

    if (!poll_id || !status) {
      return NextResponse.json({ error: "missing_data" }, { status: 400 });
    }

    // 1) Buscar status atual
    const { data: poll, error: fetchError } = await supabase
      .from("polls")
      .select("status")
      .eq("id", poll_id)
      .single();

    if (fetchError || !poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    const oldStatus = poll.status;

    // 2) Atualizar status
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

    // 3) Registrar auditoria (não falhar a request se log der erro)
    const { error: auditError } = await supabase.from("admin_audit_logs").insert({
      poll_id,
      action: "status_change",
      old_value: oldStatus,
      new_value: status,
    });

    if (auditError) {
      console.error("admin_audit_logs insert error:", auditError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
