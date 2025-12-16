import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token || "demo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
      <div className="w-full max-w-2xl">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-center text-blue-800 mb-12">
          Painel Administrativo - Auditável
        </h1>

        {/* Menu Cards */}
        <div className="space-y-4">
          <Link
            href={`/admin?token=${token}`}
            className="block w-full p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-blue-200 hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-700 mb-2">
                  Cadastro de Pesquisas
                </h2>
                <p className="text-gray-600 text-sm">
                  Crie e gerencie pesquisas e votações
                </p>
              </div>
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </Link>

          <Link
            href={`/admin?token=${token}`}
            className="block w-full p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-blue-200 hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-700 mb-2">
                  Gerenciar Opções
                </h2>
                <p className="text-gray-600 text-sm">
                  Configure opções e alternativas das pesquisas
                </p>
              </div>
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
          </Link>

          <Link
            href={`/admin/audit?token=${token}`}
            className="block w-full p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-blue-200 hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-700 mb-2">
                  Logs de Auditoria
                </h2>
                <p className="text-gray-600 text-sm">
                  Visualize registros de auditoria e atividades
                </p>
              </div>
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
          >
            ← Voltar ao site público
          </Link>
        </div>
      </div>
    </main>
  );
}
