//app/components/AccessLogger.tsx

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

        if (res.ok) {
          // marcar somente em caso de sucesso para não mascarar falhas
          localStorage.setItem(loggedKey, "1");

          const json = await res.json().catch(() => null);
          const accessId = json?.access_id;
          if (accessId) {
            localStorage.setItem("auditavel_access_id", String(accessId));
          }
        } else {
          // loga o erro para ajudar no debug (não marca como "tentado")
          const txt = await res.text().catch(() => "");
          console.error("AccessLogger: request failed", res.status, txt);
        }
      } catch (err) {
        // loga o erro para debug (não marca como "tentado")
        console.error("AccessLogger: fetch error", err);
      }
    })();
  }, [pathname, searchParams, props.pollId]);

  return null;
}
