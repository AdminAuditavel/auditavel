// app/auth/set-session/route.ts

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
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

    // Cria o client dentro do Route Handler para permitir gravação de cookies
    const supabase = createRouteHandlerClient({ cookies });

    // setSession grava os cookies corretamente porque estamos no contexto de Route Handler
    const { error: setErr } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setErr) {
      return NextResponse.json({ ok: false, error: setErr.message }, { status: 400 });
    }

    // Confirma que o SSR/route consegue ler o usuário (opcional, útil para checagem)
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
