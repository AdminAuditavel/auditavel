import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

const VALID_STATUS = ["draft", "open", "paused", "closed"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, status } = body;

    if (!poll_id || !status) {
      return NextResponse.json(
        { error: "missing_parameters" },
        { status: 400 }
      );
    }

    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json(
        { error: "invalid_status" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("polls")
      .update({ status })
      .eq("id", poll_id);

    if (error) {
      console.error("ADMIN STATUS UPDATE ERROR:", error);
      return NextResponse.json(
        { error: "db_update_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("ADMIN STATUS API ERROR:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
