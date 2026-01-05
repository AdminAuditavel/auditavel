// app/admin/logout/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";  // Importando supabaseServer configurado para SSR

/**
 * Rota para realizar o logout do usuário.
 * - Encerra a sessão do usuário via supabaseServer.
 * - Redireciona o usuário para a página de login após o logout.
 */
export async function POST() {
  // Encerra a sessão do usuário usando o Supabase SSR
  await supabaseServer.auth.signOut();

  // Redireciona para a página de login
  return NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "https://auditavel.vercel.app")
  );
}
