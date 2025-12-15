//app/results/[id] /AttributesInviteClient.tsx
"use client";

import { useEffect, useState } from "react";
import AttributesInvite from "./AttributesInvite";

type Props = {
  pollId: string;
};

export default function AttributesInviteClient({ pollId }: Props) {
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("auditavel_participant_id");
    if (id) setParticipantId(id);
  }, []);

  if (!participantId) return null;

  return (
    <AttributesInvite
      participantId={participantId}
      pollId={pollId}
    />
  );
}

