import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    // token via query (mesmo padrão do resto do admin)
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Obs: estamos mantendo seu shape atual, só inserindo
    const { data, error } = await supabase
      .from("polls")
      .insert({
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        allow_multiple: body.allow_multiple,
        max_votes_per_user: body.max_votes_per_user,
        allow_custom_option: body.allow_custom_option,
        closes_at: body.closes_at || null,
        vote_cooldown_seconds: body.vote_cooldown_seconds,
        voting_type: body.voting_type,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        show_partial_results: body.show_partial_results,
        icon_name: body.icon_name || null,
        icon_url: body.icon_url || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("create-poll db error:", error);
      return NextResponse.json(
        {
          error: "Erro ao salvar a pesquisa. Por favor, tente novamente.",
          details: error.message, // <-- importante p/ debug
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Pesquisa cadastrada com sucesso!", data },
      { status: 201 }
    );
  } catch (err) {
    console.error("Erro no endpoint create-poll:", err);
    return NextResponse.json(
      { error: "Erro desconhecido ao processar a solicitação." },
      { status: 500 }
    );
  }
}
