//app/api/admin/create-poll/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminRequest } from "@/lib/admin-auth";

// Função auxiliar para tratar valores vazios como null
function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

// Função para converter string para ISO 8601, ou retornar null se inválido
function toISOOrNull(value: unknown): string | null {
  const s = emptyToNull(value);
  if (!s) return null;

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Função para parsear e validar datas
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
    // Verificação de autenticação do admin
    const admin = await isAdminRequest();
    if (!admin.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Cria o client ADMIN somente em runtime (evita erro em build)
    const supabase = getSupabaseAdmin();

    // Parse do corpo da requisição
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    // Desestruturação dos campos
    const {
      title,
      description,
      status,
      allow_multiple,
      max_votes_per_user,
      vote_cooldown_seconds,
      voting_type,
      max_options_per_vote,
      start_date,
      end_date,
      closes_at,
      show_partial_results,
      icon_name,
      icon_url,
      category,
      tem_premiacao,
      premio,
    } = body as any;

    // Verificação de múltiplos votos
    let maxVotesPerUser = 1;
    if (!allow_multiple) {
      maxVotesPerUser = 1;
    } else {
      const n = Number(max_votes_per_user);
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

    // Validação das datas
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let closesAt: Date | null = null;

    try {
      startDate = parseDateOrNull(start_date, "start_date");
      endDate = parseDateOrNull(end_date, "end_date");
      closesAt = parseDateOrNull(closes_at, "closes_at");
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

    // Validação de obrigatoriedade da data de início
    if (!startDate) {
      return NextResponse.json(
        { error: "missing_start_date", message: "start_date é obrigatório." },
        { status: 400 }
      );
    }

    // Tolerância de 60 segundos para não permitir que o início seja no passado
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

    // Validação das relações entre as datas
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

    // Convertendo as datas para ISO
    const startDateISO = toISOOrNull(start_date);
    const endDateISO = toISOOrNull(end_date);
    const closesAtISO = toISOOrNull(closes_at);

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

    // Inserção dos dados na tabela 'polls' no banco
    const { data, error } = await supabase
      .from("polls")
      .insert({
        title,
        description,
        status,
        allow_multiple: Boolean(allow_multiple),
        max_votes_per_user: maxVotesPerUser,
        vote_cooldown_seconds,
        voting_type,
        max_options_per_vote,
        start_date: startDateISO,
        end_date: endDateISO,
        closes_at: closesAtISO,
        show_partial_results: Boolean(show_partial_results),
        icon_name: emptyToNull(icon_name),
        icon_url: emptyToNull(icon_url),
        category: emptyToNull(category),

        // Novos campos de premiação
        tem_premiacao: Boolean(tem_premiacao),
        premio: tem_premiacao ? emptyToNull(premio) : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao salvar pesquisa:", error);
      return NextResponse.json(
        {
          error: "Erro ao salvar a pesquisa. Por favor, tente novamente.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Retorno de sucesso
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
