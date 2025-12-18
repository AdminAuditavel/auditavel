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
      if (!t)
        return NextResponse.json({ error: "missing_title" }, { status: 400 });
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
              message:
                "max_votes_per_user deve ser >= 2 quando allow_multiple=true",
            },
            { status: 400 }
          );
        }
        update.max_votes_per_user = n;
      }
    }

    if (
      "vote_cooldown_seconds" in update &&
      update.vote_cooldown_seconds != null
    ) {
      const n = Number(update.vote_cooldown_seconds);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "invalid_vote_cooldown_seconds" },
          { status: 400 }
        );
      }
      update.vote_cooldown_seconds = n;
    }

    /* =========================
       DATAS (REFINO V2 - MODELO AUDITÁVEL)
       Regras:
       - start_date é obrigatório (não pode ser apagado)
       - start_date NÃO pode ser menor que created_at (sempre)
       - end_date e closes_at podem ser vazios ("") -> null
       - coerência:
         - end_date >= start_date (se existir)
         - closes_at >= start_date (se existir)
         - closes_at >= end_date (se ambos existirem)
       Extra:
       - normaliza datetime-local -> ISO UTC (evita mistura de formatos)
    ========================= */

    // 1) normaliza quando vier do form ("" -> null)
    if ("start_date" in update) update.start_date = emptyToNull(update.start_date);
    if ("end_date" in update) update.end_date = emptyToNull(update.end_date);
    if ("closes_at" in update) update.closes_at = emptyToNull(update.closes_at);

    // 2) se admin tentar "apagar" start_date, bloqueia
    if ("start_date" in update && !update.start_date) {
      return NextResponse.json(
        { error: "missing_start_date", message: "start_date é obrigatório." },
        { status: 400 }
      );
    }

    // 3) snapshot atual (inclui created_at como âncora auditável)
    const { data: current, error: currentError } = await supabase
      .from("polls")
      .select("created_at, start_date, end_date, closes_at")
      .eq("id", id)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    // 4) calcula "próximos valores" (merge de update parcial)
    const nextStartRaw =
      "start_date" in update ? update.start_date : current.start_date;
    const nextEndRaw = "end_date" in update ? update.end_date : current.end_date;
    const nextClosesRaw =
      "closes_at" in update ? update.closes_at : current.closes_at;

    // 5) normaliza para ISO UTC (se vier datetime-local)
    const nextStartISO = toISOOrNull(nextStartRaw);
    const nextEndISO = toISOOrNull(nextEndRaw);
    const nextClosesISO = toISOOrNull(nextClosesRaw);

    // Se o update contém campos de data, já salvamos em ISO (consistência)
    if ("start_date" in update) update.start_date = nextStartISO;
    if ("end_date" in update) update.end_date = nextEndISO;
    if ("closes_at" in update) update.closes_at = nextClosesISO;

    // 6) parse para validação
    let createdAt: Date | null = null;
    let nextStart: Date | null = null;
    let nextEnd: Date | null = null;
    let nextCloses: Date | null = null;

    try {
      // created_at vem do banco (geralmente ISO)
      createdAt = parseDateOrNull(current.created_at, "created_at");

      // datas "next" já normalizadas (ISO), então o parse fica consistente
      nextStart = parseDateOrNull(nextStartISO, "start_date");
      nextEnd = parseDateOrNull(nextEndISO, "end_date");
      nextCloses = parseDateOrNull(nextClosesISO, "closes_at");
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

    if (!createdAt) {
      return NextResponse.json(
        {
          error: "invalid_created_at",
          message: "created_at inválido (não foi possível validar as datas).",
        },
        { status: 500 }
      );
    }

    if (!nextStart) {
      return NextResponse.json(
        { error: "missing_start_date", message: "start_date é obrigatório." },
        { status: 400 }
      );
    }

    // Regra auditável: start_date não pode ser menor que created_at
    if (nextStart.getTime() < createdAt.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_start_date_before_created_at",
          message: "start_date não pode ser menor que created_at.",
        },
        { status: 400 }
      );
    }

    // Coerência: end_date/closes_at também não podem ser menores que created_at
    if (nextEnd && nextEnd.getTime() < createdAt.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_end_date_before_created_at",
          message: "end_date não pode ser menor que created_at.",
        },
        { status: 400 }
      );
    }

    if (nextCloses && nextCloses.getTime() < createdAt.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_closes_at_before_created_at",
          message: "closes_at não pode ser menor que created_at.",
        },
        { status: 400 }
      );
    }

    // Coerência entre datas do modelo
    if (nextEnd && nextEnd.getTime() < nextStart.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_end_date_before_start",
          message: "end_date não pode ser menor que start_date.",
        },
        { status: 400 }
      );
    }

    if (nextCloses && nextCloses.getTime() < nextStart.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_closes_at_before_start",
          message: "closes_at não pode ser menor que start_date.",
        },
        { status: 400 }
      );
    }

    if (nextEnd && nextCloses && nextCloses.getTime() < nextEnd.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_closes_at_before_end",
          message: "closes_at não pode ser menor que end_date.",
        },
        { status: 400 }
      );
    }

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
