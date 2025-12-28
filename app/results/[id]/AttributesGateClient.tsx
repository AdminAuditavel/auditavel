//app/results/[id]/AttributesGateClient.tsx
"use client";

import { useEffect, useState } from "react";
import AttributesInviteClient from "./AttributesInviteClient";

type Props = {
  pollId: string;
};

function keyFor(pollId: string) {
  return `auditavel_show_attrs_${pollId}`;
}

export default function AttributesGateClient({ pollId }: Props) {
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    try {
      const key = keyFor(pollId);
      const val = sessionStorage.getItem(key);

      if (val === "1") {
        setCanShow(true);
        // garante “uma única vez”
        sessionStorage.removeItem(key);
      } else {
        setCanShow(false);
      }
    } catch {
      setCanShow(false);
    }
  }, [pollId]);

  if (!canShow) return null;

  return <AttributesInviteClient pollId={pollId} />;
}
