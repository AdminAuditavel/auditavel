"use client";

import { useEffect, useState } from "react";
import AttributesInvite from "./AttributesInvite";

export default function AttributesInviteClient() {
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("auditavel_participant_id");
    if (id) setParticipantId(id);
  }, []);

  if (!participantId) return null;

  return <AttributesInvite participantId={participantId} />;
}
