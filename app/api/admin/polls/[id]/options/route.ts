//app/api/admin/polls/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

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
      .maybeSingle(); // ✅ melhor que single p/ permitir "não encontrado" sem erro

    if (error) {
      console.error("poll GET db error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    if (!poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, poll }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
