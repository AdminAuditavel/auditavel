// /app/api/vote/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
