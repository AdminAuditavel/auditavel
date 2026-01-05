// app/auth/callback/page.tsx
import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Conectando…</h1>
            <p className="mt-2 text-sm text-gray-600">
              Estamos concluindo seu acesso.
            </p>
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
