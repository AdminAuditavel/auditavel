// app/auth/callback/AuthCallbackClient.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeNext(next: string | null) {
  if (!next) return "/admin";
  if (!next.startsWith("/")) return "/admin";
  if (next.startsWith("//")) return "/admin";
  if (next.includes("\n") || next.includes("\r")) return "/admin";
  return next;
}

export default function AuthCallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;

      const hp = new URLSearchParams(hash);

      const access_token = hp.get("access_token");
      const refresh_token = hp.get("refresh_token");
      const error_description =
        hp.get("error_description") || hp.get("error") || null;

      if (error_description) {
        router.replace(
          `/admin/login?error=${encodeURIComponent(error_description)}`
        );
        return;
      }

      if (!access_token || !refresh_token) {
        router.replace(`/admin/login?error=${encodeURIComponent("missing_tokens")}`);
        return;
      }

      // 1) manda tokens pro server gravar cookies
      const res = await fetch("/auth/set-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const msg = j?.error || "set_session_failed";
        router.replace(`/admin/login?error=${encodeURIComponent(msg)}`);
        return;
      }

      // 2) limpa a URL (remove tokens do hash)
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );

      // 3) agora o SSR vai enxergar os cookies
      router.refresh();
      router.replace(safeNext(sp.get("next")));
    };

    run();
  }, [router, sp]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Conectando…</h1>
        <p className="mt-2 text-sm text-gray-600">
          Estamos concluindo seu acesso.
        </p>
      </div>
    </main>
  );
}
