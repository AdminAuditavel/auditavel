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

    // cookie store do Next (RequestCookies)
    const cookieStore = cookies();

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
                // Alguns campos podem estar ausentes — mapeamos com segurança
                const opts: Record<string, any> = {};
                if (c.path !== undefined) opts.path = c.path;
                if (c.domain !== undefined) opts.domain = c.domain;
                if (c.httpOnly !== undefined) opts.httpOnly = c.httpOnly;
                if (c.secure !== undefined) opts.secure = c.secure;
                if (c.sameSite !== undefined) opts.sameSite = c.sameSite;
                if (c.maxAge !== undefined) opts.maxAge = c.maxAge;
                if (c.expires !== undefined) {
                  // cookieStore.set aceita Date | string
                  opts.expires = typeof c.expires === "string" ? new Date(c.expires) : c.expires;
                }

                // next/headers cookies().set aceita objeto com name/value/options
                cookieStore.set({
                  name: c.name,
                  value: c.value,
                  ...opts,
                });
              }
            } catch (e) {
              // Não falhar por uma escrita de cookie; log apenas para debug
              // (Vercel logs exibirão console.error)
              // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error("set-session error:", e);
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
