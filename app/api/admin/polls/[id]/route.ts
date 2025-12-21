import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase-server";

function assertAdmin(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  return !!token && token === process.env.ADMIN_TOKEN;
}

/**
 * Campos alinhados com a sua tabela atual:
 * id,title,description,status,allow_multiple,max_votes_per_user,created_at,closes_at,
 * vote_cooldown_seconds,voting_type,start_date,end_date,show_partial_results,icon_name,icon_url,max_options_per_vote,category
 */
const POLL_SELECT_FIELDS = [
  "id",
  "title",
  "description",
  "status",
  "allow_multiple",
  "max_votes_per_user",
  "created_at",
  "closes_at",
  "vote_cooldown_seconds",
  "voting_type",
  "max_options_per_vote",
  "start_date",
  "end_date",
  "show_partial_results",
  "icon_name",
  "icon_url",
  "category",
].join(", ");

/** "" / null / undefined -> null ; string -> trim */
function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** datetime-local sem timezone -> ISO UTC ; ISO com timezone -> mantém */
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

function isValidVotingType(v: any): v is "single" | "ranking" | "multiple" {
  return v === "single" || v === "ranking" || v === "multiple";
}

/**
 * IMPORTANTÍSSIMO: manter a assinatura do seu projeto:
 * context: { params: Promise<{ id: string }> }
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!assertAdmin(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const { data: poll, error } = await supabase
      .from("polls")
      .select(POLL_SELECT_FIELDS)
      .eq("id", id)
      .single();

    // Erro de DB é 500 com details (não mascarar como poll_not_found)
    if (error) {
      console.error("poll GET db error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    if (!poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, poll }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (GET poll):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!assertAdmin(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    // Somente campos existentes no schema atual
    const allowedKeys = [
      "title",
      "description",
      "status",
      "allow_multiple",
      "max_votes_per_user",
      "closes_at",
      "vote_cooldown_seconds",
      "voting_type",
      "max_options_per_vote",
      "start_date",
      "end_date",
      "show_partial_results",
      "icon_name",
      "icon_url",
      "category",
    ] as const;

    const update: Record<string, any> = {};
    for (const k of allowedKeys) {
      if (k in body) update[k] = (body as any)[k];
    }

    // ===== validações básicas =====

    if ("title" in update) {
      const t = String(update.title ?? "").trim();
      if (!t) return NextResponse.json({ error: "missing_title" }, { status: 400 });
      update.title = t;
    }

    if ("status" in update) {
      const s = String(update.status ?? "").trim();
      const ok = s === "draft" || s === "open" || s === "paused" || s === "closed";
      if (!ok) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
      update.status = s;
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

    if ("voting_type" in update) {
      const vt = update.voting_type;
      if (vt == null || vt === "") {
        update.voting_type = "single";
      } else if (!isValidVotingType(vt)) {
        return NextResponse.json({ error: "invalid_voting_type" }, { status: 400 });
      }
    }

    // max_votes_per_user / allow_multiple
    if ("max_votes_per_user" in update && update.max_votes_per_user != null) {
      const n = Number(update.max_votes_per_user);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json(
          { error: "invalid_max_votes_per_user", message: "max_votes_per_user deve ser >= 1" },
          { status: 400 }
        );
      }
      update.max_votes_per_user = n;
    }

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

    // Se max_options_per_vote vier vazio, vira null
    if ("max_options_per_vote" in update) {
      if (update.max_options_per_vote == null || update.max_options_per_vote === "") {
        update.max_options_per_vote = null;
      } else {
        const n = Number(update.max_options_per_vote);
        if (!Number.isFinite(n) || n < 1) {
          return NextResponse.json(
            {
              error: "invalid_max_options_per_vote",
              message: "max_options_per_vote deve ser >= 1",
            },
            { status: 400 }
          );
        }
        update.max_options_per_vote = n;
      }
    }

    // Normaliza category (string vazia -> null)
    if ("category" in update) {
      update.category = emptyToNull(update.category);
    }

    // Snapshot atual (para validar datas + coerência com voting_type)
    const { data: current, error: currentError } = await supabase
      .from("polls")
      .select("created_at, start_date, end_date, closes_at, voting_type, max_options_per_vote")
      .eq("id", id)
      .single();

    if (currentError) {
      console.error("poll PUT current db error:", currentError);
      return NextResponse.json(
        { error: "db_error", details: currentError.message },
        { status: 500 }
      );
    }

    if (!current) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    const nextVotingType: "single" | "ranking" | "multiple" =
      (("voting_type" in update ? update.voting_type : current.voting_type) as any) ?? "single";

    // Regra: só multiple usa max_options_per_vote
    if (nextVotingType !== "multiple") {
      update.max_options_per_vote = null;
    } else {
      const candidate =
        "max_options_per_vote" in update ? update.max_options_per_vote : current.max_options_per_vote;

      const n = Number(candidate);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json(
          {
            error: "invalid_max_options_per_vote",
            message: "max_options_per_vote é obrigatório quando voting_type=multiple (>=1).",
          },
          { status: 400 }
        );
      }
      update.max_options_per_vote = n;
    }

    /* =========================
       DATAS (mesma lógica auditável)
    ========================= */
    if ("start_date" in update) update.start_date = emptyToNull(update.start_date);
    if ("end_date" in update) update.end_date = emptyToNull(update.end_date);
    if ("closes_at" in update) update.closes_at = emptyToNull(update.closes_at);

    if ("start_date" in update && !update.start_date) {
      return NextResponse.json(
        { error: "missing_start_date", message: "start_date é obrigatório." },
        { status: 400 }
      );
    }

    const nextStartRaw = "start_date" in update ? update.start_date : current.start_date;
    const nextEndRaw = "end_date" in update ? update.end_date : current.end_date;
    const nextClosesRaw = "closes_at" in update ? update.closes_at : current.closes_at;

    const nextStartISO = toISOOrNull(nextStartRaw);
    const nextEndISO = toISOOrNull(nextEndRaw);
    const nextClosesISO = toISOOrNull(nextClosesRaw);

    if ("start_date" in update) update.start_date = nextStartISO;
    if ("end_date" in update) update.end_date = nextEndISO;
    if ("closes_at" in update) update.closes_at = nextClosesISO;

    let createdAt: Date | null = null;
    let nextStart: Date | null = null;
    let nextEnd: Date | null = null;
    let nextCloses: Date | null = null;

    try {
      createdAt = parseDateOrNull(current.created_at, "created_at");
      nextStart = parseDateOrNull(nextStartISO, "start_date");
      nextEnd = parseDateOrNull(nextEndISO, "end_date");
      nextCloses = parseDateOrNull(nextClosesISO, "closes_at");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.startsWith("invalid_date:")) {
        const field = msg.split("invalid_date:")[1] || "date";
        return NextResponse.json(
          { error: "invalid_date_format", field, message: `Formato de data inválido em ${field}.` },
          { status: 400 }
        );
      }
      throw e;
    }

    if (!createdAt) {
      return NextResponse.json(
        { error: "invalid_created_at", message: "created_at inválido." },
        { status: 500 }
      );
    }

    if (!nextStart) {
      return NextResponse.json(
        { error: "missing_start_date", message: "start_date é obrigatório." },
        { status: 400 }
      );
    }

    if (nextStart.getTime() < createdAt.getTime()) {
      return NextResponse.json(
        {
          error: "invalid_start_date_before_created_at",
          message: "start_date não pode ser menor que created_at.",
        },
        { status: 400 }
      );
    }

    if (nextEnd && nextEnd.getTime() < createdAt.getTime()) {
      return NextResponse.json(
        { error: "invalid_end_date_before_created_at", message: "end_date < created_at." },
        { status: 400 }
      );
    }

    if (nextCloses && nextCloses.getTime() < createdAt.getTime()) {
      return NextResponse.json(
        { error: "invalid_closes_at_before_created_at", message: "closes_at < created_at." },
        { status: 400 }
      );
    }

    if (nextEnd && nextEnd.getTime() < nextStart.getTime()) {
      return NextResponse.json(
        { error: "invalid_end_date_before_start", message: "end_date < start_date." },
        { status: 400 }
      );
    }

    if (nextCloses && nextCloses.getTime() < nextStart.getTime()) {
      return NextResponse.json(
        { error: "invalid_closes_at_before_start", message: "closes_at < start_date." },
        { status: 400 }
      );
    }

    if (nextEnd && nextCloses && nextCloses.getTime() < nextEnd.getTime()) {
      return NextResponse.json(
        { error: "invalid_closes_at_before_end", message: "closes_at < end_date." },
        { status: 400 }
      );
    }

    const { data: poll, error } = await supabase
      .from("polls")
      .update(update)
      .eq("id", id)
      .select(POLL_SELECT_FIELDS)
      .single();

    if (error) {
      console.error("poll PUT db error:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    if (!poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, poll }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado (PUT poll):", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
