"use client"; // Marcar o arquivo como Client Component

import { useState, useEffect } from "react";
import { useRouter } from "next/router"; // Importando useRouter
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import VoteButton from "./VoteButton";

export default function PollPage() {
  const router = useRouter();
  const { id } = router.query; // Captura o ID diretamente da URL

  const [userHasVoted, setUserHasVoted] = useState(false);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);

  useEffect(() => {
    if (!id || Array.isArray(id)) return; // Verifica se o id está disponível e não é um array

    const fetchPollData = async () => {
      // Buscar dados da pesquisa
      const { data: pollData, error } = await supabase
        .from("polls")
        .select("*")
        .eq("id", id)
        .single();

      if (pollData) {
        setPoll(pollData);
        setAllowMultiple(pollData.allow_multiple);
      }

      // Buscar opções
      const { data: optionsData, error: optionsError } = await supabase
        .from("poll_options")
        .select("id, option_text")
        .eq("poll_id", id);
      setOptions(optionsData || []);
    };

    fetchPollData();
  }, [id]); // Atualiza sempre que o id mudar

  // Verificar se o usuário já votou nesta pesquisa
  useEffect(() => {
    if (!id || Array.isArray(id)) return; // Verifica se o id está disponível e não é um array

    const checkUserVote = async () => {
      const userHash = localStorage.getItem("user_hash");
      const { data: voteData, error } = await supabase
        .from("votes")
        .select("option_id")
        .eq("poll_id", id)
        .eq("user_hash", userHash)
        .single();

      if (voteData) {
        setUserHasVoted(true);
      } else {
        setUserHasVoted(false);
      }
    };

    checkUserVote();
  }, [id]); // Verifique sempre que o id mudar

  if (!poll) return notFound();

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      {/* Mensagem para pesquisa de voto único (allow_multiple=false) */}
      {allowMultiple === false && userHasVoted && (
        <p className="text-red-500 mb-4">Você já votou nesta pesquisa. Deseja alterar seu voto?</p>
      )}

      {/* Mensagem para pesquisa de múltiplos votos (allow_multiple=true) */}
      {allowMultiple === true && userHasVoted && (
        <p className="text-green-500 mb-4">
          Você já votou nesta pesquisa, mas pode votar novamente! Seu voto será somado ao total.
        </p>
      )}

      <div className="space-y-3">
        {options.map((o) => (
          <VoteButton
            key={o.id}
            pollId={id as string}  {/* Garantindo que o id seja tratado como string */}
            optionId={o.id}
            text={o.option_text}
            allowMultiple={allowMultiple}
          />
        ))}
      </div>
    </main>
  );
}
