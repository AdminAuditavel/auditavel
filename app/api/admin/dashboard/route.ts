import { NextResponse } from "next/server";

export async function GET() {
  console.log("Rota do Dashboard foi chamada.");

  const dashboardData = {
    title: "Painel Administrativo - Auditável",
    menu: [
      { name: "Cadastro de Pesquisas", path: "/admin/poll-registration" },
      { name: "Gerenciar Opções", path: "/admin/options-management" },
      { name: "Logs de Auditoria", path: "/admin/audit-logs" },
    ],
  };

  return NextResponse.json(dashboardData, { status: 200 });
}
