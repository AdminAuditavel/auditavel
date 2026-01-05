"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
      // Tokens vêm no hash (#...) e não chegam no servidor
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;

      const hp = new URLSearchParams(hash);

      const access_token = hp.get("access_token");
      const refresh_token = hp.get("refresh_token");
      const error_description = hp.get("error_description") || hp.get("error");

      if (error_description) {
        router.replace(
          `/admin/login?error=${encodeURIComponent(error_description)}`
        );
        return;
      }

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          router.replace(`/admin/login?error=${encodeURIComponent(error.message)}`);
          return;
        }

        // Remove tokens da URL (segurança)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
      }

      const next = safeNext(sp.get("next"));
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
