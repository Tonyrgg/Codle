import Link from "next/link";

export default function Home() {
  return (
    <main className="menu-screen px-6 py-12 text-center">
      <div className="vignette" aria-hidden="true" />
      <div className="menu-shell mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="menu-subtitle text-xs uppercase tracking-[0.5em] text-cyan-200">
          Hub principale
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-amber-300 text-4xl">
          <span aria-hidden="true">{"\u{1F3C6}"}</span>
          <h1 className="menu-title text-5xl">Codle Nexus</h1>
          <span aria-hidden="true">{"\u{1F3C6}"}</span>
        </div>
        <p className="menu-description mt-4 max-w-2xl text-base">
          Scegli la tua sfida: affronta il quiz giornaliero oppure invita un amico
          in un duello neon dove conta ogni cifra.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.4em] text-slate-200">
          <span className="menu-chip bg-emerald-500/20 text-emerald-100">
            Daily Ready
          </span>
          <span className="menu-chip bg-violet-500/20 text-violet-100">
            Duel Live
          </span>
          <span className="menu-chip bg-cyan-500/15 text-cyan-200">
            Arcade HUD
          </span>
        </div>

        <div className="menu-actions mt-10 w-full flex-col gap-6 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8">
          <Link
            href="/codle"
            className="menu-card menu-card-primary arcade-shadow flex flex-col items-center px-10 py-16 transition"
          >
            <div className="menu-card-label">Entra nel quiz</div>
            <div className="menu-card-title mt-4 text-5xl font-black">
              CODLE
            </div>
            <p className="mt-4 text-sm text-indigo-100/70">
              Sfida quotidiana con 4 cifre da scoprire.
            </p>
          </Link>

          <Link
            href="/duel"
            className="menu-card menu-card-secondary menu-card-duel arcade-shadow flex flex-col items-center px-10 py-16 transition"
          >
            <div className="menu-card-label">Sfida un amico</div>
            <div className="menu-card-title mt-4 text-5xl font-black">
              DUEL
            </div>
            <p className="mt-4 text-sm text-slate-200/70">
              Match realtime con HUD neon e tastierino arcade.
            </p>
          </Link>

          <Link
            href="/box"
            className="menu-card menu-card-box arcade-shadow flex flex-col items-center px-10 py-16 transition"
          >
            <div className="menu-card-label">Box Match</div>
            <div className="menu-card-box-icon">{"\u{1F4E6}"}</div>
            <div className="menu-card-title mt-4 text-5xl font-black">
              BOX
            </div>
            <p className="mt-4 text-sm text-amber-100/80">
              Modalità multiround con difficoltà dinamica e tempo limitato.
            </p>
            <div className="menu-card-meta text-amber-100/80">
              <span>Easy</span>
              <span>Medium</span>
              <span>Hard</span>
            </div>
          </Link>
        </div>

        <div className="menu-description mt-10 text-xs uppercase tracking-[0.35em] text-slate-300">
          © {new Date().getFullYear()} Codle Arcade HUD Edition
        </div>
      </div>
    </main>
  );
}
