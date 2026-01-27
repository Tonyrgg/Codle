"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DuelBoard from "./DuelBoard";
import { supabaseBrowser } from "@/app/lib/supabase/client";

type Mark = "green" | "yellow" | "gray";

type Move = {
  id: string;
  by_user_id: string;
  guess: string;
  bulls: number;
  cows: number;
  marks: Mark[];
  created_at: string;
};

type StateResp =
  | {
      ok: true;
      match: {
        id: string;
        code: string;
        status: "waiting" | "secrets" | "active" | "finished" | string;
        turn_user_id: string | null;
        winner_user_id: string | null;
      };
      me: { userId: string; seat: number };
      opponentUserId: string | null;
      moves: Move[];
      secrets: {
        mySecretSet: boolean;
        opponentSecretSet: boolean;
        count: number;
      };
    }
  | { ok: false; error: string };

function sortMoves(m: Move[]) {
  return [...m].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
}

export default function DuelClient({ matchId }: { matchId: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meId, setMeId] = useState<string>("");
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [turnUserId, setTurnUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [winner, setWinner] = useState<string | null>(null);

  const [moves, setMoves] = useState<Move[]>([]);
  const [matchCode, setMatchCode] = useState<string>("");

  const [mySecretSet, setMySecretSet] = useState(false);
  const [opponentSecretSet, setOpponentSecretSet] = useState(false);

  const [secretInput, setSecretInput] = useState("");
  const [settingSecret, setSettingSecret] = useState(false);

  const [uiToast, setUiToast] = useState("");

  const isMyTurn = !!turnUserId && !!meId && turnUserId === meId;

  // ---- Auth: deve avvenire PRIMA dello state e PRIMA del realtime ----
  const ensureAnon = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn("[auth getSession error]", error);
    if (data.session) return;

    const res = await supabase.auth.signInAnonymously();
    if (res.error) throw res.error;
  }, [supabase]);

  // ---- State refresh (single source of truth) ----
  const refreshingRef = useRef(false);

  const refreshState = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const res = await fetch(`/api/duel/state?matchId=${matchId}`, {
        cache: "no-store",
      });

      const text = await res.text();
      if (!text) {
        console.warn("[state] empty response", res.status);
        return;
      }

      let data: StateResp;
      try {
        data = JSON.parse(text);
      } catch {
        console.error(
          "[state] non-json response",
          res.status,
          text.slice(0, 200),
        );
        return;
      }

      if (!res.ok || !data.ok) {
        console.warn("[state] error", res.status, data);
        return;
      }

      setStatus(data.match.status);
      setTurnUserId(data.match.turn_user_id ?? null);
      setWinner(data.match.winner_user_id ?? null);
      setMatchCode(data.match.code ?? "");

      setMeId(data.me.userId);
      setOpponentId(data.opponentUserId ?? null);

      setMoves(sortMoves(data.moves ?? []));

      setMySecretSet(!!data.secrets?.mySecretSet);
      setOpponentSecretSet(!!data.secrets?.opponentSecretSet);
    } finally {
      setTimeout(() => {
        refreshingRef.current = false;
      }, 120);
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    if (winner) return;
    if (status !== "waiting" && status !== "secrets") return;

    const id = window.setInterval(() => {
      refreshState();
    }, 1200);

    return () => window.clearInterval(id);
  }, [matchId, status, winner, refreshState]);

  // ---- Bootstrap: ensureAnon -> refreshState ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        await ensureAnon();
        const { data } = await supabase.auth.getSession();
        if (!data.session)
          throw new Error("Session not available after anon sign-in");
        setAuthReady(true);
        if (cancelled) return;

        await refreshState();
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Errore inizializzazione");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureAnon, refreshState]);

  // ---- Realtime: cleanup corretto ----
  useEffect(() => {
    if (!authReady) return;
    let isUnmounted = false;

    const channel = supabase
      .channel(`duel:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        async () => {
          if (isUnmounted) return;
          await refreshState();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moves",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          if (isUnmounted) return;
          await refreshState();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_secrets",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          if (isUnmounted) return;
          await refreshState();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_players",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          console.log("[RT match_players insert]");
          await refreshState();
        },
      )
      .subscribe();

    return () => {
      isUnmounted = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, matchId, refreshState, authReady]);

  const toast = useCallback((msg: string, ms = 1200) => {
    setUiToast(msg);
    window.setTimeout(() => setUiToast(""), ms);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast("Copiato.");
      } catch {
        toast("Impossibile copiare (permessi browser).", 1600);
      }
    },
    [toast],
  );

  const submitSecret = useCallback(async () => {
    if (settingSecret) return;

    if (secretInput.length !== 4) {
      toast("Il segreto deve essere di 4 cifre.");
      return;
    }

    setSettingSecret(true);
    try {
      const res = await fetch("/api/duel/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, secret: secretInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data?.error || `HTTP ${res.status}`);

      setSecretInput("");
      toast("Segreto impostato.");

      // riallinea sempre dopo write
      await refreshState();
    } catch (e: any) {
      toast(e?.message || "Errore impostazione segreto", 1600);
    } finally {
      setSettingSecret(false);
    }
  }, [settingSecret, secretInput, matchId, toast, refreshState]);

  const myMoves = useMemo(
    () => (meId ? moves.filter((m) => m.by_user_id === meId) : []),
    [moves, meId],
  );

  const oppMoves = useMemo(
    () => (opponentId ? moves.filter((m) => m.by_user_id === opponentId) : []),
    [moves, opponentId],
  );

  const canPlay = status === "active" && !winner && isMyTurn;

  const disabledReason = winner
    ? "Partita finita."
    : status !== "active"
      ? "In attesa che entrambi scelgano il segreto."
      : !isMyTurn
        ? "Non e' il tuo turno."
        : "";

  const banner = useMemo(() => {
    if (winner)
      return winner === meId
        ? "Hai vinto la partita."
        : "Hai perso la partita.";
    if (status === "waiting")
      return "In attesa di un secondo giocatore. Condividi il codice stanza.";
    if (status === "secrets")
      return "Entrambi devono impostare un segreto (4 cifre).";
    if (status === "active")
      return isMyTurn
        ? "E' il tuo turno: inserisci una combinazione."
        : "Turno avversario: attendi.";
    return "Stato non riconosciuto.";
  }, [winner, meId, status, isMyTurn]);

  const stageLabel = winner
    ? winner === meId
      ? "Victory"
      : "Defeat"
    : status === "waiting"
      ? "Waiting"
      : status === "secrets"
        ? "Secrets"
        : status === "active"
          ? isMyTurn
            ? "Your Turn"
            : "Opp Turn"
          : "In Progress";

  if (loading) {
    return (
      <div className="game-shell mx-auto w-full max-w-[980px] px-4 py-10 text-slate-100">
        <div className="status-panel rounded-2xl border px-4 py-3 text-center text-sm font-medium">
          Caricamento...
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="game-shell mx-auto w-full max-w-[980px] px-4 py-10 text-slate-100">
        <div className="status-panel rounded-2xl border px-4 py-3 text-center text-sm font-medium">
          {err}
        </div>
        <div className="mt-4 flex justify-center">
          <button
            className="submit-chip rounded-2xl px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em]"
            onClick={refreshState}
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="vignette" aria-hidden="true" />
      <div className="game-shell mx-auto w-full max-w-[1200px] px-4 py-10 text-slate-100">
      <header className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center justify-center gap-4 text-3xl text-amber-300">
          <span aria-hidden="true">{"\u{1F3C6}"}</span>
          <h1 className="hud-heading text-5xl uppercase tracking-tight text-white drop-shadow-[0_15px_45px_rgba(0,0,0,0.75)]">
            Codle Duel
          </h1>
          <span aria-hidden="true">{"\u{1F3C6}"}</span>
        </div>
        <div className="match-id-display flex flex-wrap items-center justify-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.45em] text-cyan-300/80">
          <span>Match ID:</span>
          <span className="text-white">{matchId}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="arcade-shadow rounded-2xl border border-violet-400/50 bg-[#8B5CF6] px-5 py-3 font-mono text-xs uppercase tracking-[0.4em] text-white/90 transition hover:bg-[#a78bfa] disabled:opacity-50"
            onClick={() => {
              if (!matchCode) return;
              copy(matchCode);
            }}
            disabled={!matchCode}
            title="Copia codice stanza"
          >
            <span className="opacity-70">CODE</span>
            <span className="ml-2 font-bold text-white">
              {matchCode || "----"}
            </span>
          </button>
          <button
            type="button"
            className="arcade-shadow rounded-2xl border border-cyan-200/60 bg-cyan-400 px-5 py-3 font-mono text-xs uppercase tracking-[0.4em] text-slate-900 font-bold"
            onClick={() =>
              copy(`${window.location.origin}/duel/match/${matchId}`)
            }
            title="Copia link stanza"
          >
            Copia link
          </button>
          <a
            href="/duel"
            className="arcade-shadow rounded-2xl border border-slate-700/60 bg-slate-800 px-5 py-3 font-mono text-xs uppercase tracking-[0.4em] text-slate-100 transition hover:bg-slate-700"
          >
            Esci
          </a>
        </div>
      </header>

      <div className="status-panel mt-8 w-full rounded-3xl border px-6 py-6 shadow-2xl">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-indigo-100">{banner}</p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-200">
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-emerald-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              {stageLabel}
            </div>

            <div className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-4 py-1.5 font-mono">
              TU: <span className="text-white">{mySecretSet ? "OK" : "---"}</span>
            </div>

            <div className="arcade-shadow flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400 text-xs font-bold text-slate-900">
              VS
            </div>

            <div className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-4 py-1.5 font-mono">
              OPP:{" "}
              <span className="text-white">
                {opponentSecretSet ? "OK" : "---"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {uiToast ? (
        <div className="status-panel mt-4 w-full rounded-2xl border px-4 py-3 text-center text-sm font-medium">
          {uiToast}
        </div>
      ) : null}

      {!winner && !mySecretSet ? (
        <div className="mt-8 rounded-[32px] border-4 border-indigo-500/30 bg-[#3B2EA3] p-6 text-white shadow-[0_30px_80px_rgba(32,9,74,0.5)] glow-purple">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xl font-semibold uppercase tracking-tight">
              <span aria-hidden="true" className="text-amber-300">
                {"\u2728"}
              </span>
              <p>
                Imposta il <span className="text-amber-300">tuo</span> segreto
              </p>
            </div>
            <p className="text-sm text-indigo-100/80">
              4 cifre, tutte diverse. L&apos;avversario non le vedra&apos;.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="glass-input glossy-bar flex w-full max-w-[420px] items-center justify-between gap-6 px-6 py-4">
              <span className="text-xs uppercase tracking-[0.55em] text-indigo-200/70">
                SECRET
              </span>
              <input
                value={secretInput}
                onChange={(e) =>
                  setSecretInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-full bg-transparent text-right font-mono text-3xl font-bold tracking-[0.4em] text-white placeholder:text-indigo-200/60 outline-none"
                placeholder="####"
                inputMode="numeric"
              />
            </div>

            <button
              className="submit-chip arcade-shadow rounded-2xl px-8 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.4em] disabled:opacity-40"
              onClick={submitSecret}
              disabled={settingSecret || secretInput.length !== 4}
            >
              {settingSecret ? "..." : "SET"}
            </button>
          </div>

          <div className="mt-3 text-xs uppercase tracking-[0.35em] text-indigo-100/80">
            {opponentSecretSet ? "Avversario pronto" : "Avversario non pronto"}
          </div>
        </div>
      ) : null}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div
          className={`glow-purple rounded-[36px] border-4 ${
            canPlay ? "border-indigo-400/70" : "border-indigo-500/30"
          } bg-slate-900/40 p-1`}
        >
          <DuelBoard
            title="TU"
            subtitle={canPlay ? "E' il tuo turno" : "Attendi"}
            moves={myMoves as any}
            canPlay={canPlay}
            disabledReason={disabledReason}
            onSubmitGuess={async (guess) => {
              const res = await fetch("/api/duel/guess", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, guess }),
              });
              const data = await res.json();
              if (!res.ok || !data.ok)
                throw new Error(data?.error || `HTTP ${res.status}`);
              await refreshState();
            }}
          />
        </div>

        <div className="glow-red rounded-[36px] border-4 border-red-600/40 bg-slate-900/40 p-1">
          <DuelBoard
            title="AVVERSARIO"
            subtitle="Le sue mosse (live)"
            moves={oppMoves as any}
            canPlay={false}
            disabledReason="Solo lettura"
          />
        </div>
      </div>
      </div>
    </div>
  );
}
