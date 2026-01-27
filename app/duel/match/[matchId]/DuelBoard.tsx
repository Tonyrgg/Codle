"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mark = "green" | "yellow" | "gray";

export type Move = {
  id: string;
  by_user_id: string;
  guess: string;
  bulls: number;
  cows: number;
  marks: Mark[];
  created_at: string;
};

type Row = {
  chars: string[];
  marks?: Mark[];
  bulls: number;
  cows: number;
};

type KeyState = "green" | "yellow" | "gray" | "unused";

function upgradeKeyState(prev: KeyState, next: KeyState): KeyState {
  const rank: Record<KeyState, number> = {
    unused: 0,
    gray: 1,
    yellow: 2,
    green: 3,
  };
  return rank[next] > rank[prev] ? next : prev;
}

function keyClass(state: KeyState) {
  switch (state) {
    case "green":
      return "digit-key digit-key-green";
    case "yellow":
      return "digit-key digit-key-yellow";
    case "gray":
      return "digit-key digit-key-gray";
    default:
      return "digit-key digit-key-unused";
  }
}

function cellClass(mark?: Mark) {
  switch (mark) {
    case "green":
      return "tile-back tile-back-green tile-active";
    case "yellow":
      return "tile-back tile-back-yellow tile-active";
    case "gray":
      return "tile-back tile-back-gray";
    default:
      return "tile-back";
  }
}

const LENGTH = 4;
const MAX = 6; // come hai deciso per il daily, qui puoi tenere 6

export default function DuelBoard({
  title,
  subtitle,
  moves,
  canPlay,
  disabledReason,
  onSubmitGuess,
}: {
  title: string;
  subtitle?: string;
  moves: Move[];
  canPlay: boolean;
  disabledReason?: string;
  onSubmitGuess?: (guess: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [current, setCurrent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentRef = useRef(current);
  const canPlayRef = useRef(canPlay);
  const isSubmittingRef = useRef(false);

  // flip animation state
  const [revealRowIndex, setRevealRowIndex] = useState<number | null>(null);
  const [revealStep, setRevealStep] = useState<number>(-1);
  const [revealedRowMax, setRevealedRowMax] = useState<number>(-1);
  const timeoutsRef = useRef<number[]>([]);

  const normalizedTitle = title.toLowerCase();
  const isOpponentBoard = normalizedTitle.includes("avvers");
  const headerAccent = isOpponentBoard
    ? "bg-red-900/20 border-red-500/30"
    : "bg-indigo-900/20 border-indigo-500/30";
  const iconColor = isOpponentBoard ? "text-red-300" : "text-indigo-300";
  const infoChipAccent = isOpponentBoard
    ? "border-red-500/30 text-red-200"
    : "border-indigo-500/30 text-indigo-200";
  const badgeIcon = isOpponentBoard ? "\u2694" : "\u{1F6E1}";

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    canPlayRef.current = canPlay;
  }, [canPlay]);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const clearRevealTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  const startReveal = useCallback(
    (rowIdx: number) => {
      clearRevealTimers();
      setRevealRowIndex(rowIdx);
      setRevealStep(-1);

      const delays = [50, 170, 290, 410];
      delays.forEach((d, step) => {
        const id = window.setTimeout(() => setRevealStep(step), d);
        timeoutsRef.current.push(id);
      });

      const endId = window.setTimeout(() => {
        setRevealedRowMax(rowIdx);
        setRevealRowIndex(null);
        setRevealStep(-1);
      }, 560);

      timeoutsRef.current.push(endId);
    },
    [clearRevealTimers],
  );

  useEffect(() => () => clearRevealTimers(), [clearRevealTimers]);

  // aggiorna "righe gia' rivelate" quando arrivano mosse nuove (realtime)
  useEffect(() => {
    if (moves.length === 0) {
      setRevealedRowMax(-1);
      return;
    }
    // riveliamo automaticamente l'ultima mossa arrivata
    const lastRowIdx = moves.length - 1;
    if (lastRowIdx > revealedRowMax) {
      startReveal(lastRowIdx);
    }
  }, [moves.length, revealedRowMax, startReveal]);

  const keyStates = useMemo(() => {
    const map: Record<string, KeyState> = {};
    for (let d = 0; d <= 9; d++) map[String(d)] = "unused";

    for (const m of moves) {
      const digits = m.guess.split("");
      for (let i = 0; i < digits.length; i++) {
        const digit = digits[i];
        const mark = m.marks?.[i];
        const state: KeyState =
          mark === "green" ? "green" : mark === "yellow" ? "yellow" : "gray";
        map[digit] = upgradeKeyState(map[digit], state);
      }
    }
    return map;
  }, [moves]);

  const rows = useMemo<Row[]>(() => {
    const filled: Row[] = moves.map((m) => {
      const chars = m.guess.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
      return { chars, marks: m.marks, bulls: m.bulls, cows: m.cows };
    });

    while (filled.length < MAX) {
      filled.push({
        chars: Array(LENGTH).fill(""),
        bulls: 0,
        cows: 0,
      });
    }

    return filled;
  }, [moves]);

  const addDigit = (d: string) => {
    if (!canPlay) return;
    if (current.length >= LENGTH) return;
    setCurrent((p) => p + d);
  };

  const backspace = () => {
    if (!canPlay) return;
    setCurrent((p) => p.slice(0, -1));
  };

  const clear = () => {
    if (!canPlay) return;
    setCurrent("");
  };

  const submit = useCallback(
    async (value: string) => {
      if (!canPlayRef.current) return;
      if (!onSubmitGuess) return;

      if (isSubmittingRef.current) return; // mutex
      if (value.length !== LENGTH) {
        setStatus("Inserisci 4 cifre.");
        return;
      }

      setStatus("");
      setIsSubmitting(true);
      try {
        await onSubmitGuess(value);
        setCurrent("");
      } catch (e: any) {
        setStatus(e?.message || "Errore invio guess");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmitGuess],
  );

  // tastiera fisica
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!canPlayRef.current) return;
      if (isSubmittingRef.current) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable)
        return;

      if (e.key >= "0" && e.key <= "9") {
        setCurrent((prev) => (prev.length < LENGTH ? prev + e.key : prev));
        return;
      }

      if (e.key === "Backspace") {
        setCurrent((prev) => prev.slice(0, -1));
        return;
      }

      if (e.key === "Enter") {
        submit(currentRef.current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submit]);

  return (
    <div className="duel-board w-full rounded-[28px] bg-slate-950/40 p-6 text-white shadow-[0_25px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <header
        className={`mb-6 flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${headerAccent}`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-2xl ${iconColor}`}
          >
            <span aria-hidden="true">{badgeIcon}</span>
          </div>
          <div>
            <div className="hud-heading text-2xl tracking-tight text-white">
              {title}
            </div>
            {subtitle ? (
              <div className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-200/80">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={`flex flex-col items-end justify-center rounded-full border px-4 py-2 text-[0.65rem] font-mono uppercase tracking-[0.35em] ${infoChipAccent}`}
        >
          <span>Tentativi</span>
          <span className="text-white">
            {moves.length}/{MAX}
          </span>
        </div>
      </header>

      {!canPlay && disabledReason ? (
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[0.65rem] font-mono uppercase tracking-[0.35em] text-slate-200">
          {disabledReason}
        </div>
      ) : null}

      {status ? (
        <div className="status-panel mb-5 w-full rounded-2xl border px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-indigo-100">
          {status}
        </div>
      ) : null}

      {/* board */}
      <section className="game-board relative flex w-full flex-col gap-4">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {row.chars.map((ch, j) => {
                const mark = row.marks?.[j];

                const flipped =
                  i <= revealedRowMax ||
                  (revealRowIndex === i && revealStep >= j);

                const displayChar = ch?.trim() ?? "";
                const isEmptyCell = !displayChar && mark == null;

                return (
                  <div key={j} className="flip-tile h-12 w-12 sm:h-12 sm:w-12">
                    <div
                      className={`flip-inner ${flipped ? "flip-reveal" : ""}`}
                    >
                      <div
                        className={`flip-face rounded-2xl font-mono text-xl font-semibold tile-front ${
                          isEmptyCell ? "tile-empty" : ""
                        }`}
                      >
                        {displayChar}
                      </div>
                      <div
                        className={`flip-face flip-back rounded-2xl font-mono text-xl font-semibold ${cellClass(
                          mark,
                        )} ${isEmptyCell ? "tile-empty" : ""}`}
                      >
                        {displayChar}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="attempt-stats w-20 text-[0.6rem] font-mono uppercase tracking-[0.4em] text-slate-400">
              {i < moves.length ? (
                <div className="space-y-1">
                  <div>V: {row.bulls}</div>
                  <div>G: {row.cows}</div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      {/* keypad (solo per chi puo' giocare) */}
      {onSubmitGuess ? (
        <section className="keypad-panel mt-8 w-full px-6 py-6 text-slate-100">
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="glass-input glossy-bar flex w-full max-w-lg items-center justify-between gap-4 px-6 py-3">
              <span className="text-xs uppercase tracking-[0.55em] text-slate-400">
                #
              </span>
              <div className="code-display font-mono text-2xl font-semibold tracking-[0.3em]">
                {current.padEnd(LENGTH, "-")}
              </div>
            </div>

            <button
              className="arcade-shadow rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-6 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.5em] text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-40"
              onClick={() => submit(current)}
              disabled={!canPlay || isSubmitting || current.length !== LENGTH}
            >
              {isSubmitting ? "..." : "Invio"}
            </button>
          </div>

          <div className="keypad-wrapper flex justify-center">
            <div className="keypad-grid inline-grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  className={`${keyClass(
                    keyStates[n],
                  )} arcade-shadow aspect-square w-16 min-w-[3.25rem] text-2xl font-semibold disabled:opacity-40`}
                  onClick={() => addDigit(n)}
                  disabled={!canPlay}
                >
                  {n}
                </button>
              ))}

              <button
                className="control-key arcade-shadow rounded-2xl border border-red-500/30 bg-red-600/20 px-3 py-4 text-xs font-semibold uppercase tracking-[0.4em] text-red-300 disabled:opacity-40"
                onClick={backspace}
                disabled={!canPlay}
              >
                Canc
              </button>

              <button
                className={`${keyClass(
                  keyStates["0"],
                )} arcade-shadow aspect-square w-16 min-w-[3.25rem] text-2xl font-semibold disabled:opacity-40`}
                onClick={() => addDigit("0")}
                disabled={!canPlay}
              >
                0
              </button>

              <button
                className="control-key arcade-shadow rounded-2xl border border-slate-400/30 bg-slate-900/50 px-3 py-4 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200 disabled:opacity-40"
                onClick={clear}
                disabled={!canPlay}
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
