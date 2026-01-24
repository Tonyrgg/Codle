"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CODE_LENGTH_GLOBAL, MAX_ATTEMPTS_GLOBAL } from "../lib/config";

type Mark = "green" | "yellow" | "gray";

type TodayAttempt = {
  attempt_number: number;
  guess: string;
  bulls: number;
  cows: number;
  marks: Mark[];
  created_at: string;
};

type TodayResponse =
  | {
      ok: true;
      date: string;
      length: number;
      maxAttempts: number;
      attempts: TodayAttempt[];
    }
  | { ok: false; error: string };

type GuessResponse =
  | {
      ok: true;
      date: string;
      length: number;
      maxAttempts: number;
      attemptNumber: number;
      bulls: number;
      cows: number;
      marks: Mark[];
      win: boolean;
      attemptsRemaining: number;
    }
  | { ok: false; error: string };

const LENGTH = CODE_LENGTH_GLOBAL;
const MAX = MAX_ATTEMPTS_GLOBAL;
const PLACEHOLDER = "-";
const DIGIT_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function cellClass(mark?: Mark) {
  switch (mark) {
    case "green":
      return "tile-back tile-back-green";
    case "yellow":
      return "tile-back tile-back-yellow";
    case "gray":
      return "tile-back tile-back-gray";
    default:
      return "tile-back";
  }
}

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

export function Game() {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const [attempts, setAttempts] = useState<
    { guess: string; bulls: number; cows: number; marks?: Mark[] }[]
  >([]);

  const [current, setCurrent] = useState("");
  const [locked, setLocked] = useState(false);
  const currentRef = useRef(current);
  const lockedRef = useRef(locked);

  const [revealRowIndex, setRevealRowIndex] = useState<number | null>(null);
  const [revealStep, setRevealStep] = useState<number>(-1); // -1..3
  const [revealedRowMax, setRevealedRowMax] = useState<number>(-1); // righe gia' definitivamente rivelate

  const timeoutsRef = useRef<number[]>([]);
  const toastTimersRef = useRef<Record<number, number>>({});
  const toastIdRef = useRef(0);

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const pushToast = useCallback((message: string) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      window.clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }, 3200);
    toastTimersRef.current[id] = timer;
  }, []);

  const clearToastTimers = useCallback(() => {
    Object.values(toastTimersRef.current).forEach((timer) =>
      window.clearTimeout(timer),
    );
    toastTimersRef.current = {};
  }, []);

  const showToastMessage = useCallback(
    (message: string) => {
      pushToast(message);
    },
    [pushToast],
  );

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const keyStates = useMemo(() => {
    const map: Record<string, KeyState> = {};
    for (let d = 0; d <= 9; d++) map[String(d)] = "unused";

    for (const a of attempts) {
      if (!a.marks) continue;
      const digits = a.guess.split("");
      for (let i = 0; i < digits.length; i++) {
        const digit = digits[i];
        const mark = a.marks[i];

        const state: KeyState =
          mark === "green" ? "green" : mark === "yellow" ? "yellow" : "gray";

        map[digit] = upgradeKeyState(map[digit], state);
      }
    }

    return map;
  }, [attempts]);

  const rows = useMemo(() => {
    const filled = attempts.map((a) => {
      const chars = a.guess.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
      return { chars, marks: a.marks, bulls: a.bulls, cows: a.cows };
    });

    while (filled.length < MAX) {
      filled.push({
        chars: Array(LENGTH).fill(""),
        marks: undefined as Mark[] | undefined,
        bulls: 0,
        cows: 0,
      });
    }
    return filled;
  }, [attempts]);

  function addDigit(d: string) {
    if (locked) return;
    if (current.length >= LENGTH) return;
    setCurrent((prev) => prev + d);
  }

  function backspace() {
    if (locked) return;
    setCurrent((prev) => prev.slice(0, -1));
  }

  const submitValue = useCallback(
    async (value: string) => {
      if (isSubmittingRef.current || locked) return;

      if (value.length !== LENGTH) {
        showToastMessage("Inserisci 4 cifre.");
        return;
      }

      setIsSubmitting(true);

      try {
        const res = await fetch("/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guess: value }),
        });

        const data: GuessResponse = await res.json();

        if (!data.ok) {
          showToastMessage(data.error || "Errore invio tentativo");
          return;
        }

        setAttempts((prev) => {
          const rowIdx = prev.length;
          const next = [
            ...prev,
            {
              guess: value,
              bulls: data.bulls,
              cows: data.cows,
              marks: data.marks,
            },
          ];

          startReveal(rowIdx);

          return next;
        });
        setCurrent("");

        if (data.win) {
          setLocked(true);
          showToastMessage("Hai vinto.");
        } else if (data.attemptNumber >= MAX) {
          setLocked(true);
          showToastMessage("Tentativi terminati per oggi.");
        }
      } catch (error) {
        showToastMessage(getErrorMessage(error, "Errore imprevisto"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [locked, showToastMessage, startReveal],
  );

  useEffect(() => {
    return () => clearRevealTimers();
  }, [clearRevealTimers]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/today", { cache: "no-store" });
        const data: TodayResponse = await res.json();

        if (!data.ok) {
          showToastMessage(data.error || "Errore caricamento stato");
          return;
        }

        setDate(data.date);

        const mapped = (data.attempts ?? [])
          .sort((a, b) => a.attempt_number - b.attempt_number)
          .map((a) => ({
            guess: a.guess,
            bulls: a.bulls,
            cows: a.cows,
            marks: a.marks,
          }));

        setAttempts(mapped);
        setRevealedRowMax(mapped.length - 1);
        const alreadyWon = mapped.some((a) => a.bulls === LENGTH);
        const outOfTries = mapped.length >= MAX;
        setLocked(alreadyWon || outOfTries);

        if (alreadyWon) showToastMessage("Hai gia' vinto oggi.");
        else if (outOfTries) showToastMessage("Tentativi terminati per oggi.");
      } catch (error) {
        showToastMessage(getErrorMessage(error, "Errore imprevisto"));
      } finally {
        setLoading(false);
      }
    })();
  }, [showToastMessage]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isSubmittingRef.current) return;
      // Se l'utente sta scrivendo in un input/textarea, non interferire
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable)
        return;

      if (lockedRef.current) return;

      if (e.key >= "0" && e.key <= "9") {
        setCurrent((prev) => (prev.length < LENGTH ? prev + e.key : prev));
        return;
      }

      if (e.key === "Backspace") {
        setCurrent((prev) => prev.slice(0, -1));
        return;
      }

      if (e.key === "Enter") {
        // submit usando lo stato piu' aggiornato
        const value = currentRef.current;
        if (value.length !== LENGTH) {
          showToastMessage("Inserisci 4 cifre.");
          return;
        }
        // Chiamiamo submit con value esplicito (vedi step 4)
        submitValue(value);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showToastMessage, submitValue]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    return () => {
      clearToastTimers();
    };
  }, [clearToastTimers]);

  return (
    <div className="game-shell relative mx-auto flex w-full max-w-92.5 flex-col items-center px-4 text-slate-100 sm:px-0">
      <section className="game-board relative flex w-full flex-col gap-2.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-center">
            <div className="grid grid-cols-4 gap-2.5">
              {row.chars.map((ch, j) => {
                const mark = row.marks?.[j];

                const flipped =
                  // righe gia' consolidate
                  i <= revealedRowMax ||
                  // riga in reveal: flip progressivo cella per cella
                  (revealRowIndex === i && revealStep >= j);

                return (
                  <div key={j} className="flip-tile h-12 w-12 sm:h-14 sm:w-14">
                    <div
                      className={`flip-inner ${flipped ? "flip-reveal" : ""}`}
                    >
                      {/* FRONT (neutro) */}
                      <div className="flip-face rounded-xl font-mono text-xl font-semibold tile-front">
                        {ch}
                      </div>

                      {/* BACK (colorato) */}
                      <div
                        className={`flip-face flip-back rounded-xl font-mono text-xl font-semibold ${cellClass(mark)}`}
                      >
                        {ch}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="keypad-panel mt-8 w-full max-w-92.5 rounded-[28px] border px-4 py-5 text-slate-100 shadow-2xl">
        <div className="mb-4 flex justify-center">
          <div className="flex w-full max-w-sm items-stretch gap-0">
            <div className="glass-input flex flex-1 items-center justify-center gap-2 rounded-l-[20px] rounded-r-none border-r-0 px-3 py-1.5">
              <span className="text-xs uppercase tracking-[0.55em] text-slate-400">
                #
              </span>
              <div className="code-display font-mono text-lg font-semibold">
                {current.padEnd(LENGTH, PLACEHOLDER)}
              </div>
            </div>
            <button
              className="submit-chip flex items-center justify-center rounded-r-[20px] rounded-l-none border-l px-3 py-1.5 text-base disabled:opacity-50"
              onClick={() => submitValue(current)}
              disabled={locked || isSubmitting || current.length !== LENGTH}
              aria-label="Invio"
            >
              <span aria-hidden="true" className="leading-none">
                ⏎
              </span>
            </button>
          </div>
        </div>

        <div className="keypad-wrapper mt-1 flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="keypad-grid inline-grid grid-cols-5 gap-3">
              {DIGIT_KEYS.map((n) => (
                <button
                  key={n}
                  className={`rounded-2xl px-3 py-3 text-xl h-14 w-14 font-semibold disabled:opacity-60 ${keyClass(keyStates[n])}`}
                  onClick={() => addDigit(n)}
                  disabled={locked}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="keypad-controls grid w-full grid-cols-2 gap-3">
              <button
                className="control-key rounded-2xl px-3 py-3 h-14 w-full text-xs font-semibold uppercase tracking-wide disabled:opacity-60"
                onClick={backspace}
                disabled={locked}
              >
                Canc
              </button>
              <button
                className="control-key rounded-2xl px-3 py-3 h-14 w-full text-xs font-semibold uppercase tracking-wide disabled:opacity-60"
                onClick={() => setCurrent("")}
                disabled={locked}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </section>
       {toasts.length ? (
        <div className="toast-layer" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="status-toast">
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

