//app/api/access-log/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

// Opcional no .env: ACCESS_LOG_IP_SALT="um_valor_longo_e_aleatorio"
const IP_SALT = process.env.ACCESS_LOG_IP_SALT ?? "";

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "";
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const ALLOWED_EVENT_TYPES = new Set([
  "landing",
  "poll_open",
  "vote_start",
  "vote_submit",
]);

type Body = {
  event_type?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  poll_id?: string | null;
  participant_id?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
};

function truncateTrim(v?: string | null, max = 256) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: Request) {
  try {
    // Prefer usar a service role key (server-only) para INSERTs de logs.
    // Se não existir, faz fallback para o client criado por supabaseServer()
    // (que normalmente usa a ANON key e pode estar sujeito a RLS).
    let supabaseClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    } else {
      supabaseClient = await supabaseServer();
    }

    const rawBody = (await req.json().catch(() => ({}))) as Body;

    const rawEventType = String(rawBody.event_type ?? "").trim();
    const event_type = ALLOWED_EVENT_TYPES.has(rawEventType)
      ? rawEventType
      : "landing";

    // Sanitização / tamanho máximo para evitar payloads abusivos
    const source = truncateTrim(rawBody.source ?? "direct", 128) || "direct";
    const medium = truncateTrim(rawBody.medium ?? null, 64);
    const campaign = truncateTrim(rawBody.campaign ?? null, 128);
    const poll_id = truncateTrim(rawBody.poll_id ?? null, 64);
    const participant_id = truncateTrim(rawBody.participant_id ?? null, 64);
    const user_agent = truncateTrim(
      rawBody.user_agent ?? req.headers.get("user-agent") ?? null,
      512
    );
    const referrer = truncateTrim(
      rawBody.referrer ?? req.headers.get("referer") ?? null,
      512
    );

    const ip = getClientIp(req);
    const ip_hash =
      ip && IP_SALT ? sha256(`${ip}::${IP_SALT}`) : ip ? sha256(ip) : null;

    // Inserir no banco (access_logs)
    const { data, error } = await supabaseClient
      .from("access_logs")
      .insert({
        event_type,
        source,
        medium,
        campaign,
        poll_id,
        participant_id,
        user_agent,
        referrer,
        ip_hash,
      })
      .select("id")
      .single();

    if (error) {
      // logamos o erro no servidor para auditoria/debug, mas não vazamos a service key
      console.error("access-log insert error:", error);
      // se for erro de permissão RLS, retornar 403; caso contrário 400
      const status = /permission|forbidden|unauthorized/i.test(error.message)
        ? 403
        : 400;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }

    return NextResponse.json({ ok: true, access_id: data.id }, { status: 201 });
  } catch (e: any) {
    console.error("access-log handler exception:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}
