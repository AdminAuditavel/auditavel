//app/api/admin/polls/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

function assertAdmin(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  return !!token && token === process.env.ADMIN_TOKEN;
}

const POLL_SELECT_FIELDS = [
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
].join(", ");

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!assertAdmin(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const { data: poll, error } = await supabase
      .from("polls")
      .select(POLL_SELECT_FIELDS)
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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!assertAdmin(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    // Permite atualizar apenas campos conhecidos (evita sobrescrever colunas indevidas)
    const allowedKeys = [
      "title",
      "description",
      "type",
      "status",
      "allow_multiple",
      "max_votes_per_user",
      "allow_custom_option",
      "closes_at",
      "vote_cooldown_seconds",
      "voting_type",
      "start_date",
      "end_date",
      "show_partial_results",
      "icon_name",
      "icon_url",
    ] as const;

    const update: Record<string, any> = {};
    for (const k of allowedKeys) {
      if (k in body) update[k] = (body as any)[k];
    }

    // validações mínimas
    if ("title" in update) {
      const t = String(update.title ?? "").trim();
      if (!t) return NextResponse.json({ error: "missing_title" }, { status: 400 });
      update.title = t;
    }

    // normaliza max_votes_per_user se vier no payload
    if ("max_votes_per_user" in update && update.max_votes_per_user != null) {
      const n = Number(update.max_votes_per_user);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json(
          {
            error: "invalid_max_votes_per_user",
            message: "max_votes_per_user deve ser >= 1",
          },
          { status: 400 }
        );
      }
      update.max_votes_per_user = n;
    }

    // Regra: allow_multiple=false => max_votes_per_user=1 (e ignora o que vier)
    // Regra: allow_multiple=true => max_votes_per_user obrigatório e >=2
    if ("allow_multiple" in update) {
      update.allow_multiple = Boolean(update.allow_multiple);

      if (!update.allow_multiple) {
        update.max_votes_per_user = 1;
      } else {
        const n = Number(update.max_votes_per_user);
        if (!Number.isFinite(n) || n < 2) {
          return NextResponse.json(
            {
              error: "invalid_max_votes_per_user",
              message: "max_votes_per_user deve ser >= 2 quando allow_multiple=true",
            },
            { status: 400 }
          );
        }
        update.max_votes_per_user = n;
      }
    }

    if ("vote_cooldown_seconds" in update && update.vote_cooldown_seconds != null) {
      const n = Number(update.vote_cooldown_seconds);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "invalid_vote_cooldown_seconds" },
          { status: 400 }
        );
      }
      update.vote_cooldown_seconds = n;
    }

    // Se você está enviando "datetime-local" (YYYY-MM-DDTHH:mm),
    // o Supabase geralmente aceita isso. Se preferir, converta para ISO aqui.
    const { data: poll, error } = await supabase
      .from("polls")
      .update(update)
      .eq("id", id)
      .select(POLL_SELECT_FIELDS)
      .single();

    if (error || !poll) {
      console.error("poll PUT db error:", error);
      return NextResponse.json(
        { error: "db_error", details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, poll }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (PUT poll):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
