//app/api/admin/polls/[id]/options/[optionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { isAdminRequest } from "@/lib/admin-auth";

async function isAdmin() {
  const admin = await isAdminRequest();
  return admin.ok;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
   if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

    const { id: pollId, optionId } = await context.params;

    const body = await req.json().catch(() => null);
    const option_text = String(body?.option_text ?? "").trim();

    if (!pollId) return NextResponse.json({ error: "missing_poll_id" }, { status: 400 });
    if (!optionId) return NextResponse.json({ error: "missing_option_id" }, { status: 400 });
    if (!option_text) return NextResponse.json({ error: "missing_option_text" }, { status: 400 });

    const { data: option, error } = await supabase
      .from("poll_options")
      .update({ option_text })
      .eq("id", optionId)
      .eq("poll_id", pollId)
      .select("id, poll_id, option_text")
      .single();

    if (error || !option) {
      return NextResponse.json(
        { error: "db_error", details: error?.message ?? "update_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, option }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (PUT option):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id: pollId, optionId } = await context.params;

    if (!pollId) return NextResponse.json({ error: "missing_poll_id" }, { status: 400 });
    if (!optionId) return NextResponse.json({ error: "missing_option_id" }, { status: 400 });

    const { error } = await supabase
      .from("poll_options")
      .delete()
      .eq("id", optionId)
      .eq("poll_id", pollId);

    if (error) {
      return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (DELETE option):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
