export default function PollPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-2xl font-bold mb-6">
        O Brasil será campeão da Copa do Mundo de 2026?
      </h1>

      <div className="flex gap-4">
        <a
          href="/vote?answer=sim"
          className="bg-green-600 text-white px-6 py-3 rounded-lg shadow hover:bg-green-700 transition"
        >
          Sim
        </a>

        <a
          href="/vote?answer=nao"
          className="bg-red-600 text-white px-6 py-3 rounded-lg shadow hover:bg-red-700 transition"
        >
          Não
        </a>
      </div>
    </main>
  );
}
