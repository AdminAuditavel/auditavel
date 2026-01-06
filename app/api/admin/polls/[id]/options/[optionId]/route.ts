// app/api/admin/polls/[id]/options/[optionId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { isAdminRequest } from "@/lib/admin-auth";

type Ctx = {
  params: Promise<{ id: string; optionId: string }> | { id: string; optionId: string };
};

export async function PUT(req: NextRequest, context: Ctx) {
  try {
    const admin = await isAdminRequest();
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const resolvedParams =
      context?.params && typeof (context.params as any).then === "function"
        ? await (context.params as Promise<{ id: string; optionId: string }>)
        : (context.params as { id: string; optionId: string });

    const pollId = String(resolvedParams?.id ?? "").trim();
    const optionId = String(resolvedParams?.optionId ?? "").trim();

    if (!pollId || !optionId) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const option_text = String((body as any)?.option_text ?? "").trim();

    if (!option_text) {
      return NextResponse.json({ error: "missing_option_text" }, { status: 400 });
    }

    const { data: option, error } = await supabase
      .from("poll_options")
      .update({ option_text })
      .eq("id", optionId)
      .eq("poll_id", pollId)
      .select("id, poll_id, option_text")
      .single();

    if (error) {
      console.error("poll_options PUT error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    // auditoria (opcional)
    const { error: auditError } = await supabase.from("admin_audit_logs").insert({
      poll_id: pollId,
      action: "option_update",
      old_value: null,
      new_value: option_text,
    });
    if (auditError) console.error("admin_audit_logs insert error:", auditError);

    return NextResponse.json({ success: true, option }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (options PUT):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const admin = await isAdminRequest();
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const resolvedParams =
      context?.params && typeof (context.params as any).then === "function"
        ? await (context.params as Promise<{ id: string; optionId: string }>)
        : (context.params as { id: string; optionId: string });

    const pollId = String(resolvedParams?.id ?? "").trim();
    const optionId = String(resolvedParams?.optionId ?? "").trim();

    if (!pollId || !optionId) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    // (opcional) pegar texto antes de deletar p/ auditoria
    const { data: existing } = await supabase
      .from("poll_options")
      .select("option_text")
      .eq("id", optionId)
      .eq("poll_id", pollId)
      .maybeSingle();

    const { error } = await supabase
      .from("poll_options")
      .delete()
      .eq("id", optionId)
      .eq("poll_id", pollId);

    if (error) {
      console.error("poll_options DELETE error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    const { error: auditError } = await supabase.from("admin_audit_logs").insert({
      poll_id: pollId,
      action: "option_delete",
      old_value: existing?.option_text ?? null,
      new_value: null,
    });
    if (auditError) console.error("admin_audit_logs insert error:", auditError);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (options DELETE):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
