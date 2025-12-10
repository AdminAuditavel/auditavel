import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { poll_id, option_id, user_hash } = await req.json();

    console.log("Recebido:", { poll_id, option_id, user_hash });

    if (!poll_id || !option_id || !user_hash) {
      return NextResponse.json({ error: "missing data" }, { status: 400 });
    }

    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1,
    });

    if (error) {
      console.log("Erro Supabase:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (e) {
    console.log("Erro interno:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
