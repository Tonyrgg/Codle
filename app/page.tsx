import Link from "next/link";

export default function Home() {
  return (
    <main className="menu-screen flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="menu-subtitle mb-8 text-sm uppercase tracking-[0.4em]">
        Menu principale
      </div>

      <h1 className="menu-title text-4xl font-semibold">Benvenuto in Codle</h1>
      <p className="menu-description mt-2 max-w-lg text-base">
        Preparati a mettere alla prova la tua logica. Entra nel quiz giornaliero
        quando sei pronto.
      </p>

      <Link
        href="/codle"
        className="menu-card group mt-10 w-full max-w-sm rounded-3xl px-10 py-16 text-center transition"
      >
        <div className="menu-card-label text-xs uppercase tracking-[0.5em]">
          Entra nel quiz
        </div>
        <div className="menu-card-title mt-4 text-5xl font-black tracking-[0.3em]">
          CODLE
        </div>
      </Link>
      <Link
        href="/duel"
        className="submit-chip rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.5em]"
      >
        Duel
      </Link>
    </main>
  );
}
