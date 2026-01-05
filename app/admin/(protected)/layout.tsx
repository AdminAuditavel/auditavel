import { redirect } from "next/navigation";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login?next=/admin");

  return <>{children}</>;
}
