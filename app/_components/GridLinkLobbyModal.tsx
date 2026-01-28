"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CreateResp =
  | { ok: true; matchId: string; code: string; status?: string }
  | { ok: false; error: string };

type JoinResp =
  | { ok: true; matchId: string; status?: string; alreadyJoined?: boolean }
  | { ok: false; error: string };

export default function GridLinkLobbyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const cleanCode = useMemo(
    () =>
      code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6),
    [code],
  );

  if (!open) return null;

  async function onCreate() {
    if (creating) return;
    setErr("");
    setCreating(true);
    try {
      const res = await fetch("/api/gridlink/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // se ti serve difficulty/variant mettila qui
      });

      const text = await res.text();
      if (!text) throw new Error(`Empty response (${res.status})`);

      let data: CreateResp;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Non-JSON response (${res.status}): ${text.slice(0, 120)}`,
        );
      }

      if (!res.ok || !data.ok)
        throw new Error((data as any)?.error || `HTTP ${res.status}`);

      // Vai alla pagina gioco
      router.push(`/gridlink/match/${data.matchId}`);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Errore creazione stanza");
    } finally {
      setCreating(false);
    }
  }

  async function onJoin() {
    if (joining) return;
    if (!cleanCode) {
      setErr("Inserisci un codice valido.");
      return;
    }
    setErr("");
    setJoining(true);
    try {
      const res = await fetch("/api/gridlink/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });

      const text = await res.text();
      if (!text) throw new Error(`Empty response (${res.status})`);

      let data: JoinResp;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Non-JSON response (${res.status}): ${text.slice(0, 120)}`,
        );
      }

      if (!res.ok || !data.ok)
        throw new Error((data as any)?.error || `HTTP ${res.status}`);

      router.push(`/gridlink/match/${data.matchId}`);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Errore ingresso stanza");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* overlay */}
      <button
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-slate-100 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">GridLink</div>
            <div className="mt-1 text-sm text-slate-300">
              Crea una stanza o entra con un codice.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {/* CREA */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
              Nuova stanza
            </div>
            <div className="mt-2 text-sm text-slate-200">
              Genera un match e condividi il codice.
            </div>

            <button
              onClick={onCreate}
              disabled={creating}
              className="mt-4 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {creating ? "Creazione..." : "Crea"}
            </button>
          </div>

          {/* ENTRA */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
              Entra in una stanza
            </div>
            <div className="mt-2 text-sm text-slate-200">
              Inserisci il codice stanza (es. ABC123).
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={cleanCode}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CODICE"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-base uppercase tracking-[0.25em] text-white outline-none placeholder:text-slate-500"
                inputMode="text"
                autoCapitalize="characters"
              />
              <button
                onClick={onJoin}
                disabled={joining || !cleanCode}
                className="shrink-0 rounded-2xl border border-cyan-400/30 bg-cyan-400/20 px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/30 disabled:opacity-40"
              >
                {joining ? "..." : "Entra"}
              </button>
            </div>

            <div className="mt-2 text-[0.7rem] text-slate-400">
              Il codice viene normalizzato: solo A–Z e 0–9, max 6.
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
