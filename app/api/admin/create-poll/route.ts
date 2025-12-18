//app/api/admin/create-poll/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    // token via query (mesmo padrão do resto do admin)
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const allowMultiple = Boolean((body as any).allow_multiple);

    // Regras:
    // - allow_multiple=false => max_votes_per_user=1
    // - allow_multiple=true  => max_votes_per_user obrigatório e >=2
    let maxVotesPerUser = 1;

    if (!allowMultiple) {
      maxVotesPerUser = 1;
    } else {
      const n = Number((body as any).max_votes_per_user);
      if (!Number.isFinite(n) || n < 2) {
        return NextResponse.json(
          {
            error: "invalid_max_votes_per_user",
            message: "max_votes_per_user deve ser >= 2 quando allow_multiple=true",
          },
          { status: 400 }
        );
      }
      maxVotesPerUser = n;
    }

    // Obs: estamos mantendo seu shape atual, só inserindo
    const { data, error } = await supabase
      .from("polls")
      .insert({
        title: (body as any).title,
        description: (body as any).description,
        type: (body as any).type,
        status: (body as any).status,
        allow_multiple: allowMultiple,
        max_votes_per_user: maxVotesPerUser,
        allow_custom_option: (body as any).allow_custom_option,
        closes_at: (body as any).closes_at || null,
        vote_cooldown_seconds: (body as any).vote_cooldown_seconds,
        voting_type: (body as any).voting_type,
        start_date: (body as any).start_date || null,
        end_date: (body as any).end_date || null,
        show_partial_results: (body as any).show_partial_results,
        icon_name: (body as any).icon_name || null,
        icon_url: (body as any).icon_url || null,
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
