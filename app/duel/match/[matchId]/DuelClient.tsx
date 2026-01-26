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
      .subscribe((st) => console.log("[RT subscribe status]", st));

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
        ? "Non è il tuo turno."
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
        ? "È il tuo turno: inserisci una combinazione."
        : "Turno avversario: attendi.";
    return "Stato non riconosciuto.";
  }, [winner, meId, status, isMyTurn]);

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
    <div className="game-shell mx-auto w-full max-w-[980px] px-4 py-8 text-slate-100">
      <header className="mb-5 flex w-full items-center justify-between">
        <div>
          <div className="text-2xl font-semibold text-white">Codle Duel</div>
          <div className="text-xs text-slate-300">
            Match: <span className="font-mono">{matchId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {matchCode ? (
            <button
              className="control-key rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
              onClick={() => copy(matchCode)}
              title="Copia codice stanza"
            >
              Code: <span className="font-mono">{matchCode}</span>
            </button>
          ) : null}

          <button
            className="control-key rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            onClick={() =>
              copy(`${window.location.origin}/duel/match/${matchId}`)
            }
            title="Copia link stanza"
          >
            Copia link
          </button>

          <a
            href="/duel"
            className="submit-chip rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em]"
          >
            Esci
          </a>
        </div>
      </header>

      <div className="mb-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
        {banner}
        <div className="mt-2 text-xs text-slate-300">
          Segreti: tu{" "}
          <span className="font-semibold">{mySecretSet ? "OK" : "—"}</span> ·
          avversario{" "}
          <span className="font-semibold">
            {opponentSecretSet ? "OK" : "—"}
          </span>
        </div>
      </div>

      {uiToast ? (
        <div className="status-panel mb-4 w-full rounded-2xl border px-4 py-3 text-center text-sm font-medium">
          {uiToast}
        </div>
      ) : null}

      {!winner && !mySecretSet ? (
        <div className="keypad-panel mb-6 w-full rounded-[32px] border px-6 py-6 shadow-2xl">
          <div className="mb-2 text-sm font-semibold text-slate-100">
            Imposta il tuo segreto
          </div>
          <div className="mb-4 text-xs text-slate-300">
            4 cifre. L’avversario non lo vedrà mai.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="glass-input flex w-full max-w-lg items-center justify-center gap-4 rounded-[28px] border px-6 py-3">
              <span className="text-xs uppercase tracking-[0.55em] text-slate-400">
                SECRET
              </span>
              <input
                value={secretInput}
                onChange={(e) =>
                  setSecretInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-full bg-transparent text-right font-mono text-2xl font-semibold text-white outline-none"
                placeholder="####"
                inputMode="numeric"
              />
            </div>

            <button
              className="submit-chip rounded-full px-5 py-3 text-[0.75rem] font-semibold uppercase tracking-[0.45em] disabled:opacity-50"
              onClick={submitSecret}
              disabled={settingSecret || secretInput.length !== 4}
            >
              {settingSecret ? "..." : "CONFERMA"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <DuelBoard
          title="TU"
          subtitle={canPlay ? "È il tuo turno" : "Attendi"}
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

        <DuelBoard
          title="AVVERSARIO"
          subtitle="Le sue mosse (live)"
          moves={oppMoves as any}
          canPlay={false}
          disabledReason="Solo lettura"
        />
      </div>
    </div>
  );
}
