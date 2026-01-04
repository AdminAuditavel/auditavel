// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Para Next.js + Supabase, normalmente vem como ?code=...
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/admin";

  if (!code) {
    return NextResponse.redirect(new URL(`/admin/login?error=missing_code`, url.origin));
  }

  const supabase = supabaseServer;

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/login?error=auth_failed&next=${encodeURIComponent(next)}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
