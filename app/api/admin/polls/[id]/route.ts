import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 🔒 Validar token (mesmo esquema do /admin)
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    // Ajuste os campos conforme existirem na sua tabela polls
    const { data: poll, error } = await supabase
      .from("polls")
      .select(
        [
          "id",
          "title",
          "description",
          "type",
          "status",
          "allow_multiple",
          "max_votes_per_user",
          "allow_custom_option",
          "created_at",
          "closes_at",
          "vote_cooldown_seconds",
          "voting_type",
          "start_date",
          "end_date",
          "show_partial_results",
          "icon_name",
          "icon_url",
        ].join(", ")
      )
      .eq("id", id)
      .single();

    if (error || !poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, poll }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
