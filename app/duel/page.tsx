"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CreateResp =
  | { ok: true; matchId: string; code: string; status: string }
  | { ok: false; error: string };

type JoinResp =
  | { ok: true; matchId: string; code: string; status: string }
  | { ok: false; error: string };

function normalizeCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export default function DuelLobbyPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [created, setCreated] = useState<{
    code: string;
    matchId: string;
  } | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [status, setStatus] = useState("");

  const canJoin = useMemo(() => normalizeCode(code).length >= 4, [code]);

  async function onCreate() {
    setStatus("");
    setCreated(null);
    setLoadingCreate(true);

    try {
      const res = await fetch("/api/duel/create", { method: "POST" });
      const data: CreateResp = await res.json();

      if (!res.ok || !data.ok)
        throw new Error((data as any).error || `HTTP ${res.status}`);

      setCreated({ code: data.code, matchId: data.matchId });
    } catch (e: any) {
      setStatus(e?.message || "Errore creazione stanza");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function onJoin() {
    setStatus("");
    setLoadingJoin(true);

    try {
      const normalized = normalizeCode(code);
      const res = await fetch("/api/duel/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });

      const data: JoinResp = await res.json();
      if (!res.ok || !data.ok)
        throw new Error((data as any).error || `HTTP ${res.status}`);

      router.push(`/duel/match/${data.matchId}`);
    } catch (e: any) {
      setStatus(e?.message || "Errore join stanza");
    } finally {
      setLoadingJoin(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copiato.");
      setTimeout(() => setStatus(""), 1200);
    } catch {
      setStatus("Impossibile copiare (permessi browser).");
    }
  }

  return (
    <div className="quiz-screen min-h-screen">
      <div className="game-shell mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 py-10 sm:px-0">
        <header className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow">
            Codle Duel
          </h1>
          <div className="game-subtitle mt-2 text-sm tracking-wide text-slate-300">
            Crea una stanza o entra con un codice.
          </div>
        </header>

        {status ? (
          <div className="status-panel w-full rounded-2xl border px-4 py-3 text-center text-sm font-medium">
            {status}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          {/* CREATE */}
          <div className="keypad-panel rounded-[32px] border px-6 py-8 shadow-2xl">
            <div className="mb-4 text-sm font-semibold text-slate-100">
              Crea stanza
            </div>
            <p className="mb-6 text-sm text-slate-300">
              Genera un codice e condividilo con l’altro giocatore.
            </p>

            <button
              className="submit-chip w-full rounded-2xl px-5 py-4 text-sm font-semibold uppercase tracking-[0.35em] disabled:opacity-50"
              onClick={onCreate}
              disabled={loadingCreate || loadingJoin}
            >
              {loadingCreate ? "CREAZIONE..." : "CREA"}
            </button>

            {created ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-mono text-2xl font-semibold text-white">
                  {created.code}
                </div>

                <div className="flex gap-2">
                  <button
                    className="control-key rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    onClick={() => copy(created.code)}
                  >
                    Copia codice
                  </button>

                  <button
                    className="control-key rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    onClick={() =>
                      copy(
                        `${window.location.origin}/duel/match/${created.matchId}`,
                      )
                    }
                  >
                    Copia link
                  </button>

                  <button
                    className="submit-chip rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em]"
                    onClick={() =>
                      router.push(`/duel/match/${created.matchId}`)
                    }
                  >
                    Vai
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* JOIN */}
          <div className="keypad-panel rounded-[32px] border px-6 py-8 shadow-2xl">
            <div className="mb-4 text-sm font-semibold text-slate-100">
              Entra in stanza
            </div>
            <p className="mb-6 text-sm text-slate-300">
              Incolla il codice che ti hanno inviato.
            </p>

            <div className="glass-input flex w-full items-center justify-between gap-3 rounded-[28px] border px-5 py-4">
              <div className="text-xs uppercase tracking-[0.45em] text-slate-400">
                CODE
              </div>
              <input
                className="w-full bg-transparent text-right font-mono text-xl font-semibold text-white outline-none placeholder:text-slate-500"
                placeholder="ES. HCDRX6"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <button
              className="submit-chip mt-5 w-full rounded-2xl px-5 py-4 text-sm font-semibold uppercase tracking-[0.35em] disabled:opacity-50"
              onClick={onJoin}
              disabled={!canJoin || loadingCreate || loadingJoin}
            >
              {loadingJoin ? "ENTRO..." : "ENTRA"}
            </button>

            <div className="mt-3 text-xs text-slate-400">
              Suggerimento: il codice non fa distinzione tra
              maiuscole/minuscole.
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">
          Dopo il join, entrambi impostano il segreto e parte il match.
        </div>
      </div>
    </div>
  );
}
