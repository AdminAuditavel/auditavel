// app/api/admin/logout/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server"; // Importando supabaseServer corretamente

export async function POST() {
  const supabase = supabaseServer(); // Instanciando o supabaseServer corretamente

  // Encerra a sessão do usuário usando o Supabase SSR
  await supabase.auth.signOut();

  // Redireciona para a página de login
  return NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "https://auditavel.vercel.app")
  );
}
