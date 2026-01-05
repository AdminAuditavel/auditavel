// app/api/admin/create-poll/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server"; // Usando o supabaseServer para SSR
import { isAdminRequest } from "@/lib/admin-auth"; // Função de validação de admin

/**
 * Normaliza valores vindos do form (datetime-local):
 * - "" / undefined / null -> null
 * - string -> string (trim)
 */
function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Converte valores de data recebidos do front para um formato consistente (ISO UTC),
 * evitando problemas de fuso horário entre client (datetime-local) e servidor.
 *
 * - "" -> null
 * - "YYYY-MM-DDTHH:mm" (datetime-local) -> Date(local) -> toISOString() (UTC)
 * - ISO com timezone (Z ou +hh:mm) -> mantém
 */
function toISOOrNull(value: unknown): string | null {
  const s = emptyToNull(value);
  if (!s) return null;

  // Se já tem timezone explícito, mantém
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) return s;

  // datetime-local (sem timezone): interpreta como horário local
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Faz o parse de data para validação.
 * Retorna null se vier vazio.
 * Dispara erro (throw) se vier string não vazia porém inválida.
 */
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
    // =========================
    // AUTH (token OU sessão)
    // =========================
        
    // Verificando se o usuário tem permissões de admin via cookies
    const admin = await isAdminRequest();
    if (!admin.ok) {
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

    /* =========================
       DATAS (REFINO V2)
       - start_date obrigatório no cadastro
       - start_date não pode ser menor que agora (com tolerância)
       - end_date e closes_at opcionais
       - valida coerência entre datas
    ========================= */
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

    // tolerância de 60s para evitar falso negativo (admin demora a clicar em salvar)
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

    // ✅ Normaliza datas para ISO UTC antes de salvar (evita problema de fuso)
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

    // Inserção de pesquisa no banco
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

        // Datas: start_date obrigatório, end_date/closes_at opcionais
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
