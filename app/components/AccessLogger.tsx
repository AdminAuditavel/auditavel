"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getOrCreateAccessSessionId() {
  const key = "auditavel_access_session";
  let v = localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(key, v);
  }
  return v;
}

export default function AccessLogger(props: { pollId?: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // evita múltiplos registros no mesmo "carregamento" / sessão
    const sessionId = getOrCreateAccessSessionId();

    const loggedKey = `auditavel_access_logged:${sessionId}:${pathname}`;
    if (localStorage.getItem(loggedKey) === "1") return;

    const source = searchParams.get("utm_source") || "direct";
    const medium = searchParams.get("utm_medium");
    const campaign = searchParams.get("utm_campaign");

    const payload = {
      source,
      medium,
      campaign,
      poll_id: props.pollId ?? null,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
    };

    (async () => {
      try {
        const res = await fetch("/api/access-log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        // mesmo se falhar, marcamos como "tentado" para não spammar requests
        localStorage.setItem(loggedKey, "1");

        if (!res.ok) return;

        const json = await res.json().catch(() => null);
        const accessId = json?.access_id;
        if (accessId) {
          localStorage.setItem("auditavel_access_id", String(accessId));
        }
      } catch {
        localStorage.setItem(loggedKey, "1");
      }
    })();
  }, [pathname, searchParams, props.pollId]);

  return null;
}
