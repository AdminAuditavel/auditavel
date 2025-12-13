// app/api/vote/route.ts
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

    // Buscar configuração da pesquisa (agora incluindo voting_type e status)
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple, vote_cooldown_seconds, voting_type, status")
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
    const votingType = (poll.voting_type ?? "single") as string;
    const status = poll.status; // Captura o status da pesquisa

    // Verifica se a pesquisa está aberta para votação
    if (status !== "open") {
      return NextResponse.json(
        { error: "poll_not_open", message: "Esta pesquisa não está aberta para votos" },
        { status: 403 }
      );
    }

    // =========================
    // RANKING (option_ids array)
    // =========================
    if (Array.isArray(option_ids)) {
      // Ensure poll expects ranking
      if (votingType !== "ranking") {
        return NextResponse.json(
          { error: "ranking_not_allowed", message: "This poll is not configured for ranking votes" },
          { status: 400 }
        );
      }

      if (option_ids.length === 0) {
        return NextResponse.json(
          { error: "invalid_data", message: "option_ids must contain at least one id" },
          { status: 400 }
        );
      }

      // Cooldown check
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

      // Se allow_multiple = false -> remover votos anteriores desse usuário (ranking e vote pai)
      if (!allowMultiple) {
        try {
          // buscar votes anteriores (ids)
          const { data: previousVotes, error: prevSelectErr } = await supabase
            .from("votes")
            .select("id")
            .eq("poll_id", poll_id)
            .eq("user_hash", user_hash);

          if (prevSelectErr) {
            console.error("Erro ao selecionar votos anteriores (ranking):", prevSelectErr);
          } else if (previousVotes && previousVotes.length > 0) {
            const prevIds = previousVotes.map((v: any) => v.id);

            // deletar vote_rankings associados
            const { error: deleteRankingsErr } = await supabase
              .from("vote_rankings")
              .delete()
              .in("vote_id", prevIds);

            if (deleteRankingsErr) {
              console.error("Erro ao deletar vote_rankings anteriores:", deleteRankingsErr);
            }

            // deletar votes pai antigos
            const { error: deleteVotesErr } = await supabase
              .from("votes")
              .delete()
              .in("id", prevIds);

            if (deleteVotesErr) {
              console.error("Erro ao deletar votes anteriores:", deleteVotesErr);
            }
          }
        } catch (e) {
          console.error("Erro ao limpar votos anteriores (ranking):", e);
        }
      }

      // 1) Criar vote pai
      const parentVoteId = randomUUID();
      const parentPayload: any = {
        id: parentVoteId,
        poll_id,
        user_hash,
      };

      // insert vote pai
      const { data: parentVoteData, error: parentVoteError } = await supabase
        .from("votes")
        .insert(parentPayload)
        .select("id")
        .single();

      if (parentVoteError || !parentVoteData) {
        console.error("Erro ao inserir vote pai (ranking):", parentVoteError);
        return NextResponse.json(
          { error: "parent_vote_insert_failed", details: parentVoteError?.message ?? parentVoteError },
          { status: 500 }
        );
      }

      const voteId = parentVoteData.id ?? parentVoteId;

      // 2) Inserir linhas em vote_rankings
      const rows = option_ids.map((optId: string, idx: number) => ({
        id: randomUUID(),
        vote_id: voteId,
        option_id: optId,
        ranking: idx + 1,
      }));

      const { error: insertRankingError } = await supabase.from("vote_rankings").insert(rows);

      if (insertRankingError) {
        console.error("Erro ao inserir vote_rankings (ranking):", insertRankingError);
        // tentativa de rollback simples: remover vote pai criado
        try {
          await supabase.from("vote_rankings").delete().in("vote_id", [voteId]);
          await supabase.from("votes").delete().eq("id", voteId);
        } catch (rollbackErr) {
          console.error("Erro no rollback após falha ao inserir rankings:", rollbackErr);
        }

        return NextResponse.json(
          { error: "insert_failed", details: insertRankingError.message ?? insertRankingError },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, vote_id: voteId, inserted: rows.length });
    }

    // =========================================================================
    // MODO A — VOTO ÚNICO (option_id supplied) — fluxo existente (sem mudança)
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
