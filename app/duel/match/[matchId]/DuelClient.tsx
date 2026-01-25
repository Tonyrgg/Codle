"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import DuelBoard from "./DuelBoard";

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
        status: string;
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

export default function DuelClient({ matchId }: { matchId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [meId, setMeId] = useState<string>("");
  const [opponentId, setOpponentId] = useState<string | null>(null);
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
  const isMyTurn = turnUserId && meId ? turnUserId === meId : false;

  const banner = useMemo(() => {
    if (winner)
      return meId && winner === meId
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
  }, [winner, status, isMyTurn, meId]);

  async function ensureAnonClient() {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getSession();

    if (data.session) return;

    // se non c'è sessione nel browser, crea anon
    const res = await supabase.auth.signInAnonymously();
    if (res.error) {
      console.error("Anon sign-in failed:", res.error);
    }
  }

  async function submitSecret() {
    if (settingSecret) return;
    if (secretInput.length !== 4) {
      setUiToast("Il segreto deve essere di 4 cifre.");
      setTimeout(() => setUiToast(""), 1200);
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

      setMySecretSet(true);
      setSecretInput("");
      setUiToast("Segreto impostato.");
      setTimeout(() => setUiToast(""), 1200);

      // ottimistico: se il server attiva subito, aggiorna UI
      if (data.status) setStatus(data.status);
      if (data.turnUserId) setTurnUserId(data.turnUserId);
    } catch (e: any) {
      setUiToast(e?.message || "Errore impostazione segreto");
      setTimeout(() => setUiToast(""), 1600);
    } finally {
      setSettingSecret(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setUiToast("Copiato.");
      setTimeout(() => setUiToast(""), 1200);
    } catch {
      setUiToast("Impossibile copiare (permessi browser).");
      setTimeout(() => setUiToast(""), 1600);
    }
  }

  // bootstrap
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      const res = await fetch("/api/duel/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data: StateResp = await res.json();
      if (!data.ok) {
        setErr(data.error || "Errore stato match");
        setLoading(false);
        return;
      }
      setMeId(data.me.userId);
      setOpponentId(data.opponentUserId);
      setMoves(data.moves);
      setTurnUserId(data.match.turn_user_id);
      setStatus(data.match.status);
      setWinner(data.match.winner_user_id);
      setLoading(false);
      setMatchCode(data.match.code || "");
      setMySecretSet(!!data.secrets?.mySecretSet);
      setOpponentSecretSet(!!data.secrets?.opponentSecretSet);
    })();
  }, [matchId]);

  // realtime subscriptions
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await ensureAnonClient();
      if (cancelled) return;

      const supabase = supabaseBrowser();

      const ch = supabase
        .channel(`duel:${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "moves",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            console.log("[RT moves]", payload);
            if (payload.eventType === "INSERT")
              setMoves((prev) => [...prev, payload.new as any]);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "matches",
            filter: `id=eq.${matchId}`,
          },
          (payload) => {
            console.log("[RT matches UPDATE]", payload);
            const row = payload.new as any;
            setTurnUserId(row.turn_user_id ?? null);
            setStatus(row.status ?? "");
            setWinner(row.winner_user_id ?? null);
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
          (payload) => {
            const row = payload.new as any;
            if (row.user_id === meId) setMySecretSet(true);
            else setOpponentSecretSet(true);
          },
        )

        .subscribe((status) => console.log("[RT subscribe status]", status));

      // cleanup
      return () => supabase.removeChannel(ch);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const myMoves = useMemo(
    () => moves.filter((m) => m.by_user_id === meId),
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

  return (
    <div className="grid gap-6 md:grid-cols-2">
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
            4 cifre. L’avversario non lo vedrà mai. (Per ora non imponiamo
            regole speciali.)
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
          // opzionale: aggiornamento ottimistico del turno
          if (data.nextTurnUserId) setTurnUserId(data.nextTurnUserId);
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
  );
}
