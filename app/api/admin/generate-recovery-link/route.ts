//app/api/admin/generate-recovery-link/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Proteção mínima: token de admin para não expor isso publicamente
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.ADMIN_RESET_TOKEN || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Para password recovery, o endpoint Admin para "generateLink" é o mais útil
  // Ele retorna um action_link que você pode abrir manualmente no browser.
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.auditavel.com"}/auth/callback?next=/admin/update-password`;

  const resp = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      type: "recovery",
      email,
      options: { redirectTo },
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return NextResponse.json({ error: "generate_link_failed", details: data }, { status: resp.status });
  }

  // Normalmente vem em data.action_link
  return NextResponse.json({ ok: true, action_link: data?.action_link ?? null, details: data }, { status: 200 });
}
