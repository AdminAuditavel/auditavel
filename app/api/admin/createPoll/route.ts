import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server"; // Certifique-se de que você está importando o supabase corretamente

// Rota para criação de pesquisa
export async function POST(req: NextRequest) {
  try {
    const { title, description, startDate, endDate, votingType, status, iconUrl } = await req.json();

    // Inserindo dados no banco de dados
    const { data, error } = await supabase.from("polls").insert([
      {
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        voting_type: votingType,
        status,
        icon_url: iconUrl,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
