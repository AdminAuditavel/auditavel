// app/admin/layout.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  // Não autenticado → login
  if (!user || !user.email) {
    redirect("/admin/login?next=/admin");
  }

  // Autenticado mas não é o admin
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) {
    redirect("/admin/login?error=unauthorized");
  }

  return <>{children}</>;
}
