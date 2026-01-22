import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white p-6 text-center">
      <div className="mb-8 text-sm uppercase tracking-[0.4em] text-zinc-500">
        Menu principale
      </div>

      <h1 className="text-4xl font-semibold text-zinc-900">Benvenuto in Codle</h1>
      <p className="mt-2 max-w-lg text-base text-zinc-600">
        Preparati a mettere alla prova la tua logica. Entra nel quiz giornaliero
        quando sei pronto.
      </p>

      <Link
        href="/quiz"
        className="group mt-10 w-full max-w-sm rounded-3xl border border-emerald-100 bg-white px-10 py-16 text-center shadow-lg transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-emerald-100"
      >
        <div className="text-xs uppercase tracking-[0.5em] text-zinc-400 group-hover:text-emerald-600">
          Entra nel quiz
        </div>
        <div className="mt-4 text-5xl font-black tracking-[0.3em] text-emerald-700 group-hover:text-emerald-800">
          CODLE
        </div>
      </Link>
    </main>
  );
}
