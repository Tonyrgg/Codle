import Link from "next/link";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-100">
      <h1 className="text-3xl font-bold">Box Match</h1>
      <p className="mt-2 text-slate-300">
        Daily puzzle. Trascina le bottiglie negli slot. Feedback: solo quante
        posizioni corrette.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/box/superEasy"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
        >
          <div className="text-lg font-semibold">Molto facile</div>
          <div className="text-sm text-slate-300">4 slot</div>
        </Link>
        <Link
          href="/box/easy"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
        >
          <div className="text-lg font-semibold">Facile</div>
          <div className="text-sm text-slate-300">6 slot</div>
        </Link>

        <Link
          href="/box/medium"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
        >
          <div className="text-lg font-semibold">Medio</div>
          <div className="text-sm text-slate-300">8 slot</div>
        </Link>

        <Link
          href="/box/hard"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
        >
          <div className="text-lg font-semibold">Difficile</div>
          <div className="text-sm text-slate-300">10 slot</div>
        </Link>
      </div>
    </div>
  );
}
