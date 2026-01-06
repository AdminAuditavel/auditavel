// app/auth/set-session/route.ts

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = (await req.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "missing_tokens" }, { status: 400 });
    }

    // Aguardamos o cookie store corretamente (antes estava sem await, causando erro de tipo)
    const cookieStore = await cookies();

    // Cria o client no contexto do Route Handler e fornece um adapter de cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // usado para leitura de cookies
          getAll() {
            return cookieStore.getAll().map((c) => ({
              name: c.name,
              value: c.value,
            }));
          },
          // usado para escrever cookies (setSession)
          setAll(cookiesToSet: Array<any>) {
            try {
              for (const c of cookiesToSet) {
                const opts: Record<string, any> = {};
                if (c.path !== undefined) opts.path = c.path;
                if (c.domain !== undefined) opts.domain = c.domain;
                if (c.httpOnly !== undefined) opts.httpOnly = c.httpOnly;
                if (c.secure !== undefined) opts.secure = c.secure;
                if (c.sameSite !== undefined) opts.sameSite = c.sameSite;
                if (c.maxAge !== undefined) opts.maxAge = c.maxAge;
                if (c.expires !== undefined) {
                  opts.expires =
                    typeof c.expires === "string" ? new Date(c.expires) : c.expires;
                }

                cookieStore.set({
                  name: c.name,
                  value: c.value,
                  ...opts,
                });
              }
            } catch (e) {
              console.error("Error setting cookies in route adapter:", e);
            }
          },
        },
      }
    );

    // seta os tokens (isto emitirá Set-Cookie via adapter acima)
    const { error: setErr } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setErr) {
      return NextResponse.json({ ok: false, error: setErr.message }, { status: 400 });
    }

    // opcional: checar usuário via SSR client
    const { data, error: userErr } = await supabase.auth.getUser();

    if (userErr || !data?.user) {
      return NextResponse.json({ ok: false, error: "user_not_visible_to_ssr" }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("set-session error:", e);
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
