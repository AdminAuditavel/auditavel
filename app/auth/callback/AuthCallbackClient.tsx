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
        router.replace(
          `/admin/login?error=${encodeURIComponent("missing_tokens")}`
        );
        return;
      }

      // 1) manda tokens pro server gravar cookies SSR
      const res = await fetch("/auth/set-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ access_token, refresh_token }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok || !payload?.user?.email) {
        const msg =
          payload?.error ||
          `set_session_failed_${String(res.status || "")}`.trim();
        router.replace(`/admin/login?error=${encodeURIComponent(msg)}`);
        return;
      }

      // 2) limpa hash (remove tokens da URL)
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );

      // 3) revalida e segue para destino final
      const next = safeNext(sp.get("next"));
      router.refresh();
      router.replace(next);
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
