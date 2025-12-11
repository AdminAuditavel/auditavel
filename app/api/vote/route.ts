import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poll_id, option_id, option_ids, user_hash } = body as {
      poll_id?: string;
      option_id?: string;
      option_ids?: string[];
      user_hash?: string;
    };

    if (!poll_id || !user_hash) {
      return NextResponse.json(
        { error: "missing_data", message: "poll_id and user_hash are required" },
        { status: 400 }
      );
    }

    // Buscar configuração da pesquisa
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple, vote_cooldown_seconds")
      .eq("id", poll_id)
      .single();

    if (pollError || !poll) {
      console.error("Erro ao buscar poll:", pollError);
      return NextResponse.json(
        { error: "poll_not_found", details: pollError?.message ?? null },
        { status: 404 }
      );
    }

    const allowMultiple = Boolean(poll.allow_multiple);
    const cooldownSeconds = poll.vote_cooldown_seconds ?? 0;

    // If client sent a ranking (option_ids array) -> treat as ranking vote
    if (Array.isArray(option_ids)) {
      if (option_ids.length === 0) {
        return NextResponse.json(
          { error: "invalid_data", message: "option_ids must contain at least one id" },
          { status: 400 }
        );
      }

      if (!allowMultiple) {
        return NextResponse.json(
          { error: "ranking_not_allowed", message: "This poll does not allow multiple/ranking votes" },
          { status: 400 }
        );
      }

      // Cooldown check (same as MODO B)
      if (cooldownSeconds > 0) {
        const { data: lastVote, error: lastVoteError } = await supabase
          .from("votes")
          .select("created_at")
          .eq("poll_id", poll_id)
          .eq("user_hash", user_hash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastVoteError) {
          console.error("Erro ao verificar cooldown (ranking):", lastVoteError);
        }

        if (lastVote) {
          const lastTime = new Date(lastVote.created_at).getTime();
          const now = Date.now();
          const cooldownEnd = lastTime + cooldownSeconds * 1000;

          if (now < cooldownEnd) {
            const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);

            return NextResponse.json(
              {
                error: "cooldown_active",
                message: `Você deve esperar ${remainingSeconds} segundos antes de votar novamente.`,
                remaining_seconds: remainingSeconds
              },
              { status: 429 }
            );
          }
        }
      }

      // Borda-style scoring: first gets N points, second N-1, ... last gets 1
      const n = option_ids.length;
      const rows = option_ids.map((optId: string, idx: number) => ({
        id: randomUUID(),
        poll_id,
        option_id: optId,
        user_hash,
        votes_count: n - idx, // points
      }));

      const { error: insertError } = await supabase.from("votes").insert(rows);

      if (insertError) {
        console.error("Erro ao inserir votos (ranking):", insertError);
        return NextResponse.json(
          { error: "insert_failed", details: insertError.message ?? insertError },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, inserted: rows.length });
    }

    // =========================================================================
    // MODO A — VOTO ÚNICO (option_id supplied)
    // =========================================================================
    if (!option_id) {
      return NextResponse.json(
        { error: "missing_option", message: "option_id or option_ids must be provided" },
        { status: 400 }
      );
    }

    if (!allowMultiple) {
      // single-choice mode: upsert (update existing or insert new)
      const { data: existing, error: existingError } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .maybeSingle();

      if (existingError) {
        console.error("Erro ao buscar voto existente (modo A):", existingError);
      }

      // Já existe -> atualizar
      if (existing) {
        const { error } = await supabase
          .from("votes")
          .update({
            option_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          console.error("Erro ao atualizar voto (modo A):", error);
          return NextResponse.json(
            { error: "update_failed", details: error.message ?? error },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, updated: true });
      }

      // Não existe -> inserir
      const { error } = await supabase.from("votes").insert({
        id: randomUUID(),
        poll_id,
        option_id,
        user_hash,
        votes_count: 1,
      });

      if (error) {
        console.error("Erro ao inserir voto (modo A):", error);
        return NextResponse.json(
          { error: "insert_failed", details: error.message ?? error },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // =========================================================================
    // MODO B — VOTO MÚLTIPLO SIMPLES (allow_multiple = true) com COOLDOWN
    // =========================================================================

    // Se houver cooldown configurado, verificar o último voto do usuário
    if (cooldownSeconds > 0) {
      const { data: lastVote, error: lastVoteError } = await supabase
        .from("votes")
        .select("created_at")
        .eq("poll_id", poll_id)
        .eq("user_hash", user_hash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastVoteError) {
        console.error("Erro ao verificar cooldown:", lastVoteError);
      }

      if (lastVote) {
        const lastTime = new Date(lastVote.created_at).getTime();
        const now = Date.now();
        const cooldownEnd = lastTime + cooldownSeconds * 1000;

        if (now < cooldownEnd) {
          const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);

          return NextResponse.json(
            {
              error: "cooldown_active",
              message: `Você deve esperar ${remainingSeconds} segundos antes de votar novamente.`,
              remaining_seconds: remainingSeconds
            },
            { status: 429 }
          );
        }
      }
    }

    // Inserir voto (sempre insere, mesmo repetido)
    const { error: insertError } = await supabase.from("votes").insert({
      id: randomUUID(),
      poll_id,
      option_id,
      user_hash,
      votes_count: 1,
    });

    if (insertError) {
      console.error("Erro ao inserir voto (modo B):", insertError);
      return NextResponse.json(
        { error: "insert_failed", details: insertError.message ?? insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error("Erro interno:", e);
    return NextResponse.json(
      { error: "internal_error", details: String(e) },
      { status: 500 }
    );
  }
}
