import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { isAdminRequest } from "@/lib/admin-auth";

async function isAdmin(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const admin = await isAdminRequest({ token });
  return admin.ok;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "missing_poll_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("poll_options")
      .select("id, poll_id, option_text")
      .eq("poll_id", id)
      .order("option_text", { ascending: true });

    if (error) {
      console.error("poll_options GET error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, options: data ?? [] },
      { status: 200 }
    );
  } catch (err) {
    console.error("Erro inesperado (options GET):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "missing_poll_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const option_text = (body?.option_text ?? "").toString().trim();

    if (!option_text) {
      return NextResponse.json({ error: "missing_option_text" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("poll_options")
      .insert({ poll_id: id, option_text })
      .select("id, poll_id, option_text")
      .single();

    if (error) {
      console.error("poll_options POST error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, option: data }, { status: 201 });
  } catch (err) {
    console.error("Erro inesperado (options POST):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
