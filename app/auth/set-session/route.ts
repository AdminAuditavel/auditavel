// app/auth/set-session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = (await req.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "missing_tokens" }, { status: 400 });
    }

    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          },
        },
      }
    );

    // 1) grava sessão (cookies SSR)
    const { error: setErr } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setErr) {
      return NextResponse.json({ ok: false, error: setErr.message }, { status: 400 });
    }

    // 2) lê user via SSR (se cookie não colou, aqui vem null)
    const { data, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, user: data?.user ? { id: data.user.id, email: data.user.email } : null },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
