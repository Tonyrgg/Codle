"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const LENGTH = 4;
const MAX = 8;
const PLACEHOLDER = "-";

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
  const [status, setStatus] = useState("");

  // tentativi in UI (i piu' recenti avranno marks perche' arrivano da /api/guess)
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
    [clearRevealTimers]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

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
        setStatus("Inserisci 4 cifre.");
        return;
      }

      setStatus("");
      setIsSubmitting(true);

      try {
        const res = await fetch("/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guess: value }),
        });

        const data: GuessResponse = await res.json();

        if (!data.ok) {
          setStatus(data.error || "Errore invio tentativo");
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
          setStatus("Hai vinto.");
        } else if (data.attemptNumber >= MAX) {
          setLocked(true);
          setStatus("Tentativi terminati per oggi.");
        }
      } catch (error) {
        setStatus(getErrorMessage(error, "Errore imprevisto"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [locked, startReveal]
  );

  useEffect(() => {
    return () => clearRevealTimers();
  }, [clearRevealTimers]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus("");
      try {
        const res = await fetch("/api/today", { cache: "no-store" });
        const data: TodayResponse = await res.json();

        if (!data.ok) {
          setStatus(data.error || "Errore caricamento stato");
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

        if (alreadyWon) setStatus("Hai gia' vinto oggi.");
        else if (outOfTries) setStatus("Tentativi terminati per oggi.");
      } catch (error) {
        setStatus(getErrorMessage(error, "Errore imprevisto"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isSubmittingRef.current) return;
      // Se l'utente sta scrivendo in un input/textarea, non interferire
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable
      )
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
          setStatus("Inserisci 4 cifre.");
          return;
        }
        // Chiamiamo submit con value esplicito (vedi step 4)
        submitValue(value);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitValue]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  return (
    <div className="game-shell mx-auto max-w-md p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Codle</h1>
        <div className="game-subtitle text-sm">
          {loading ? "Caricamento..." : date ? `Data: ${date}` : ""}
        </div>
      </header>

      {status ? (
        <div className="status-panel mb-3 rounded p-2 text-sm">{status}</div>
      ) : null}

      <section className="grid gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="grid grid-cols-4 gap-2">
              {row.chars.map((ch, j) => {
                const mark = row.marks?.[j];

                const flipped =
                  // righe gia' consolidate
                  i <= revealedRowMax ||
                  // riga in reveal: flip progressivo cella per cella
                  (revealRowIndex === i && revealStep >= j);

                return (
                  <div key={j} className="flip-tile h-12 w-12">
                    <div
                      className={`flip-inner ${flipped ? "flip-reveal" : ""}`}
                    >
                      {/* FRONT (neutro) */}
                      <div className="flip-face rounded font-mono text-xl font-semibold tile-front">
                        {ch}
                      </div>

                      {/* BACK (colorato) */}
                      <div
                        className={`flip-face flip-back rounded font-mono text-xl font-semibold ${cellClass(mark)}`}
                      >
                        {ch}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="attempt-stats w-20 text-sm">
              {i < attempts.length ? (
                <div>
                  <div>V: {row.bulls}</div>
                  <div>G: {row.cows}</div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      <section className="keypad-panel mt-4 rounded border p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="code-display font-mono text-lg">
            {current.padEnd(LENGTH, PLACEHOLDER)}
          </div>
          <button
            className="primary-btn rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => submitValue(current)}
            disabled={locked || isSubmitting || current.length !== LENGTH}
          >
            {isSubmitting ? "Inviando..." : "Invio"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              className={`rounded p-3 text-lg font-semibold disabled:opacity-50 ${keyClass(keyStates[n])}`}
              onClick={() => addDigit(n)}
              disabled={locked}
            >
              {n}
            </button>
          ))}

          <button
            className="control-key rounded p-3 text-sm font-medium disabled:opacity-50"
            onClick={backspace}
            disabled={locked}
          >
            Canc
          </button>

          <button
            className={`rounded p-3 text-lg font-semibold disabled:opacity-50 ${keyClass(keyStates["0"])}`}
            onClick={() => addDigit("0")}
            disabled={locked}
          >
            0
          </button>

          <button
            className="control-key rounded p-3 text-sm font-medium disabled:opacity-50"
            onClick={() => setCurrent("")}
            disabled={locked}
          >
            Clear
          </button>
        </div>
      </section>
    </div>
  );
}
