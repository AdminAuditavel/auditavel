// /app/api/vote/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* ======================================================
   Helpers
====================================================== */

async function syncParticipant(participant_id: string) {
  try {
    const { data } = await supabase
      .from("participants")
      .select("id")
      .eq("id", participant_id)
      .maybeSingle();

    if (!data) {
      await supabase.from("participants").insert({ id: participant_id });
    } else {
      await supabase
        .from("participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", participant_id);
    }
  } catch (e) {
    console.error("syncParticipant error:", e);
  }
}

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "";
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function truncateTrim(v?: string | null, max = 256) {
  if (!v) return null;
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

type CastVoteResult = {
  ok: boolean;
  http_status: number;
  message: string;
  vote_id: string | null;
  remaining_seconds: number | null;
  resolved_voting_type: "single" | "ranking" | "multiple" | string | null;
};

/* ======================================================
   Handler
====================================================== */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { poll_id, option_id, option_ids, participant_id, user_hash } = body as any;

    if (!poll_id || !participant_id || !user_hash) {
      return NextResponse.json({ error: "missing_data" }, { status: 400 });
    }

    // Compat: aceitar option_ids array para single (pega o primeiro)
    if ((!option_id || option_id == null) && Array.isArray(option_ids) && option_ids.length > 0) {
      option_id = option_ids[0];
    }

    // Normaliza option_ids: somente se for array de strings
    const safeOptionIds: string[] | null =
      Array.isArray(option_ids) && option_ids.every((x: any) => typeof x === "string")
        ? option_ids
        : null;

    // Chama RPC transacional (toda regra está no DB agora)
    const { data, error } = await supabase.rpc("cast_vote", {
      p_poll_id: poll_id,
      p_participant_id: participant_id,
      p_user_hash: user_hash,
      p_option_id: option_id ?? null,
      p_option_ids: safeOptionIds,
    });

    if (error) {
      console.error("cast_vote rpc error:", error);
      return NextResponse.json(
        { error: "rpc_error", details: error.message },
        { status: 500 }
      );
    }

    const r = data as CastVoteResult;
    const status = typeof r?.http_status === "number" ? r.http_status : 200;

    // Falha (inclui cooldown/limites/validações)
    if (!r?.ok) {
      if (status === 429) {
        return NextResponse.json(
          {
            error: "cooldown_active",
            remaining_seconds: r.remaining_seconds ?? null,
            vote_id: r.vote_id ?? null,
            voting_type: r.resolved_voting_type ?? null,
            message: r.message ?? null,
          },
          { status: 429 }
        );
      }

      // Mapeamento simples e compatível
      return NextResponse.json(
        {
          error: "vote_rejected",
          vote_id: r.vote_id ?? null,
          voting_type: r.resolved_voting_type ?? null,
          message: r.message ?? null,
        },
        { status }
      );
    }

    // Sucesso: só agora fazemos syncParticipant (evita writes quando bloqueado)
    await syncParticipant(participant_id);

    // --- Fire-and-forget: registrar vote_submit em access_logs via service role
    (async () => {
      try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.warn("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL not set; skipping server-side access_log insert.");
          return;
        }

        const svc = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const IP_SALT = process.env.ACCESS_LOG_IP_SALT ?? "";
        const ip = getClientIp(req);
        const ip_hash = ip && IP_SALT ? sha256(`${ip}::${IP_SALT}`) : ip ? sha256(ip) : null;

        const payload = {
          event_type: "vote_submit",
          source: truncateTrim(body.source ?? "site", 128) || "site",
          medium: truncateTrim(body.medium ?? null, 64),
          campaign: truncateTrim(body.campaign ?? null, 128),
          poll_id: truncateTrim(poll_id ?? null, 64),
          participant_id: truncateTrim(participant_id ?? null, 128),
          user_agent: truncateTrim(body.user_agent ?? req.headers.get("user-agent") ?? null, 512),
          referrer: truncateTrim(body.referrer ?? req.headers.get("referer") ?? null, 512),
          ip_hash,
        };

        const { error: logError } = await svc.from("access_logs").insert(payload);
        if (logError) {
          console.error("Failed to insert access_log for vote_submit:", logError);
        }
      } catch (e) {
        console.error("Unexpected error when inserting access_log for vote_submit:", e);
      }
    })();

    // Compat com retorno antigo: updated boolean
    const updated = r.message === "Voto atualizado";

    return NextResponse.json(
      {
        success: true,
        updated,
        vote_id: r.vote_id,
        voting_type: r.resolved_voting_type,
      },
      { status }
    );
  } catch (e: any) {
    console.error("internal_error", e);
    return NextResponse.json(
      { error: "invalid_payload", details: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}
