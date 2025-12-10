import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { poll_id, option_id } = await req.json();

    console.log("Recebido no body:", { poll_id, option_id });

    if (!poll_id || !option_id) {
      console.log("Erro: dados ausentes");
      return NextResponse.json({ error: "missing data" }, { status: 400 });
    }

    const { error } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash: "anon_" + randomUUID(),
      votes_count: 1,
    });

    if (error) {
      console.log("Erro Supabase INSERT:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (e) {
    console.log("Erro interno /api/vote:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
