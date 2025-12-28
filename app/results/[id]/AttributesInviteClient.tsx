// app/results/[id]/AttributesInviteClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AttributesInvite from "./AttributesInvite";

type Props = {
  pollId: string;
  forceShow?: boolean;
};

export default function AttributesInviteClient({ pollId, forceShow = false }: Props) {
  const sp = useSearchParams();
  const pidFromQuery = sp.get("participant_id");

  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    // 1) prioriza querystring (pós-voto)
    if (pidFromQuery && pidFromQuery.trim()) {
      setParticipantId(pidFromQuery.trim());
      return;
    }

    // 2) fallback localStorage (fluxos normais)
    const id = localStorage.getItem("auditavel_participant_id");
    if (id) setParticipantId(id);
  }, [pidFromQuery]);

  if (!participantId) return null;

  return (
    <AttributesInvite
      participantId={participantId}
      pollId={pollId}
      forceShow={forceShow}
    />
  );
}
