//app/api/access-log/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer as supabase } from "@/lib/supabase-server";

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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const rawEventType = String(body.event_type ?? "").trim();
    const event_type = ALLOWED_EVENT_TYPES.has(rawEventType)
      ? rawEventType
      : "landing";

    const source = String(body.source ?? "").trim() || "direct";
    const medium = body.medium ? String(body.medium).trim() : null;
    const campaign = body.campaign ? String(body.campaign).trim() : null;

    const poll_id =
      body.poll_id && String(body.poll_id).trim()
        ? String(body.poll_id).trim()
        : null;

    const participant_id =
      body.participant_id && String(body.participant_id).trim()
        ? String(body.participant_id).trim()
        : null;

    const user_agent =
      body.user_agent && String(body.user_agent).trim()
        ? String(body.user_agent).trim()
        : req.headers.get("user-agent");

    const referrer =
      body.referrer && String(body.referrer).trim()
        ? String(body.referrer).trim()
        : req.headers.get("referer");

    const ip = getClientIp(req);
    const ip_hash =
      ip && IP_SALT ? sha256(`${ip}::${IP_SALT}`) : (ip ? sha256(ip) : null);

    const { data, error } = await supabase
      .from("access_logs_
