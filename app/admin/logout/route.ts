// app/api/admin/logout/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server"; // Importando supabaseServer corretamente

export async function POST() {
  // Aguarda a factory async para obter o client real
  const supabase = await supabaseServer();

  // Encerra a sessão do usuário usando o Supabase SSR
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Erro ao encerrar sessão:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Redireciona para a página de login
  return NextResponse.redirect(
    new URL(
      "/admin/login",
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://auditavel.vercel.app"
    )
  );
}
