"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateParticipantId } from "@/lib/participant";

export default function AttributesInvite() {
  const [hasAttributes, setHasAttributes] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAttributes = async () => {
      const participantId = getOrCreateParticipantId();

      const { data } = await supabase
        .from("participant_attributes")
        .select("participant_id")
        .eq("participant_id", participantId)
        .maybeSingle();

      setHasAttributes(Boolean(data));
    };

    checkAttributes();
  }, []);

  // Ainda carregando ou já respondeu → não mostra nada
  if (hasAttributes !== false) return null;

  return (
    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <strong>Quer análises mais detalhadas?</strong>
      <p className="mt-1">
        Informe alguns dados anônimos (faixa etária, escolaridade, renda) e
        ajude a enriquecer os resultados.
      </p>
      <p className="mt-1 text-xs text-blue-700">
        Opcional · sem identificação pessoal
      </p>
    </div>
  );
}
