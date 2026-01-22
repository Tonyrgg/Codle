"use client";

import { useEffect, useMemo, useState, useRef } from "react";

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

function cellClass(mark?: Mark) {
  switch (mark) {
    case "green":
      return "bg-green-600 text-white";
    case "yellow":
      return "bg-yellow-500 text-black";
    case "gray":
      return "bg-zinc-700 text-white";
    default:
      return "bg-zinc-200 text-zinc-900";
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
      return "bg-green-600 text-white";
    case "yellow":
      return "bg-yellow-500 text-black";
    case "gray":
      return "bg-zinc-700 text-white";
    default:
      return "bg-zinc-100 text-black";
  }
}

export function Game() {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  // tentativi in UI (i più recenti avranno marks perché arrivano da /api/guess)
  const [attempts, setAttempts] = useState<
    { guess: string; bulls: number; cows: number; marks?: Mark[] }[]
  >([]);

  const [current, setCurrent] = useState("");
  const [locked, setLocked] = useState(false);
  const currentRef = useRef(current);
  const lockedRef = useRef(locked);

  const [revealRowIndex, setRevealRowIndex] = useState<number | null>(null);
  const [revealStep, setRevealStep] = useState<number>(-1); // -1..3
  const [revealedRowMax, setRevealedRowMax] = useState<number>(-1); // righe già definitivamente rivelate

  const timeoutsRef = useRef<number[]>([]);

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

  async function submitValue(value: string) {
    if (isSubmittingRef.current) return; // blocca spam
    setIsSubmitting(true);
    if (locked) return;

    if (value.length !== LENGTH) {
      setStatus("Inserisci 4 cifre.");
      return;
    }

    setStatus("");

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
        const rowIdx = prev.length; // indice della nuova riga
        const next = [
          ...prev,
          {
            guess: value,
            bulls: data.bulls,
            cows: data.cows,
            marks: data.marks,
          },
        ];

        // avvia animazione sulla riga appena aggiunta
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
    } catch (e: any) {
      setStatus(e?.message ?? "Errore imprevisto");
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearRevealTimers() {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }

  function startReveal(rowIdx: number) {
    clearRevealTimers();

    setRevealRowIndex(rowIdx);
    setRevealStep(-1);

    const delays = [50, 170, 290, 410]; // step 0..3
    delays.forEach((d, step) => {
      const id = window.setTimeout(() => setRevealStep(step), d);
      timeoutsRef.current.push(id);
    });

    // fine animazione: “consolida” la riga come rivelata
    const endId = window.setTimeout(() => {
      setRevealedRowMax(rowIdx);
      setRevealRowIndex(null);
      setRevealStep(-1);
    }, 560);

    timeoutsRef.current.push(endId);
  }

  useEffect(() => {
    return () => clearRevealTimers();
  }, []);

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

        if (alreadyWon) setStatus("Hai già vinto oggi.");
        else if (outOfTries) setStatus("Tentativi terminati per oggi.");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setStatus(e?.message ?? "Errore imprevisto");
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
        (target as any)?.isContentEditable
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
        // submit usando lo stato più aggiornato
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
  }, []);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  return (
    <div className="mx-auto max-w-md p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Codle</h1>
        <div className="text-sm text-zinc-500">
          {loading ? "Caricamento..." : date ? `Data: ${date}` : ""}
        </div>
      </header>

      {status ? (
        <div className="mb-3 rounded border border-zinc-200 bg-white p-2 text-sm">
          {status}
        </div>
      ) : null}

      <section className="grid gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="grid grid-cols-4 gap-2">
              {row.chars.map((ch, j) => {
                const mark = row.marks?.[j];

                const flipped =
                  // righe già consolidate
                  i <= revealedRowMax ||
                  // riga in reveal: flip progressivo cella per cella
                  (revealRowIndex === i && revealStep >= j);

                return (
                  <div key={j} className="flip-tile h-12 w-12">
                    <div
                      className={`flip-inner ${flipped ? "flip-reveal" : ""}`}
                    >
                      {/* FRONT (neutro) */}
                      <div className="flip-face rounded font-mono text-xl font-semibold bg-zinc-200 text-zinc-900">
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

            <div className="w-20 text-sm text-zinc-600">
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

      <section className="mt-4 rounded border border-zinc-200 bg-emerald-700 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-black text-lg">
            {current.padEnd(LENGTH, "•")}
          </div>
          <button
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
            className="rounded bg-black p-3 text-sm font-medium disabled:opacity-50"
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
            className="rounded bg-black p-3 text-sm font-medium disabled:opacity-50"
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
