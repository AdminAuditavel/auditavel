//app/api/admin/create-poll/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { isAdminRequest } from "@/lib/admin-auth";

function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function toISOOrNull(value: unknown): string | null {
  const s = emptyToNull(value);
  if (!s) return null;

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseDateOrNull(value: unknown, fieldName: string): Date | null {
  const s = emptyToNull(value);
  if (!s) return null;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid_date:${fieldName}`);
  }
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await isAdminRequest();
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const allowMultiple = Boolean((body as any).allow_multiple);

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

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let closesAt: Date | null = null;

    try {
      startDate = parseDateOrNull((body as any).start_date, "start_date");
      endDate = parseDateOrNull((body as any).end_date, "end_date");
      closesAt = parseDateOrNull((body as any).closes_at, "closes_at");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.startsWith("invalid_date:")) {
        const field = msg.split("invalid_date:")[1] || "date";
        return NextResponse.json(
          {
            error: "invalid_date_format",
            field,
            message: `Formato de data inválido em ${field}.`,
          },
          { status: 400 }
        );
      }
      throw e;
    }

    if (!startDate) {
      return NextResponse.json(
        { error: "missing_start_date", message: "start_date é obrigatório." },
        { status: 400 }
      );
    }

    const toleranceMs = 60 * 1000;
    if (startDate.getTime() < Date.now() - toleranceMs) {
      return NextResponse.json(
        {
          error: "invalid_start_date_in_past",
          message:
            "start_date não pode ser menor que agora (confirme a data/hora de início da votação).",
        },
        { status: 400 }
      );
    }

    if (endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_end_date_before_start",
          message: "end_date não pode ser menor que start_date.",
        },
        { status: 400 }
      );
    }

    if (closesAt && closesAt.getTime() < startDate.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_closes_at_before_start",
          message: "closes_at não pode ser menor que start_date.",
        },
        { status: 400 }
      );
    }

    if (endDate && closesAt && closesAt.getTime() < endDate.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_closes_at_before_end",
          message: "closes_at não pode ser menor que end_date.",
        },
        { status: 400 }
      );
    }

    const startDateISO = toISOOrNull((body as any).start_date);
    const endDateISO = toISOOrNull((body as any).end_date);
    const closesAtISO = toISOOrNull((body as any).closes_at);

    if (!startDateISO) {
      return NextResponse.json(
        {
          error: "invalid_date_format",
          field: "start_date",
          message: "Formato de data inválido em start_date.",
        },
        { status: 400 }
      );
    }

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

        start_date: startDateISO,
        end_date: endDateISO,
        closes_at: closesAtISO,

        vote_cooldown_seconds: (body as any).vote_cooldown_seconds,
        voting_type: (body as any).voting_type,
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
          details: error.message,
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
