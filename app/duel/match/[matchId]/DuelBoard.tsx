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
const MAX = 6;

export default function DuelBoard({
  title,
  subtitle,
  moves,
  canPlay,
  disabledReason,
  // NEW
  displayValue,
  displayMuted,
  statusMessage,
}: {
  title: string;
  subtitle?: string;
  moves: Move[];
  canPlay: boolean;
  disabledReason?: string;

  // barra sotto la griglia (tipo "# 5678" o "----")
  displayValue: string;
  displayMuted?: boolean;

  // messaggio “Inserisci 4 cifre.” ecc (opzionale)
  statusMessage?: string;
}) {
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

  useEffect(() => {
    if (moves.length === 0) {
      setRevealedRowMax(-1);
      return;
    }
    const lastRowIdx = moves.length - 1;
    if (lastRowIdx > revealedRowMax) {
      startReveal(lastRowIdx);
    }
  }, [moves.length, revealedRowMax, startReveal]);

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

      {statusMessage ? (
        <div className="status-panel mb-5 w-full rounded-2xl border px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-indigo-100">
          {statusMessage}
        </div>
      ) : null}

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
                  <div key={j} className="flip-tile h-12 w-12">
                    <div className={`flip-inner ${flipped ? "flip-reveal" : ""}`}>
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

      {/* Display bar (come primo screenshot) */}
      <div className="glossy-bar mt-8 flex items-center justify-center gap-4 rounded-xl py-4">
        <span className="text-slate-500 font-mono text-xl">#</span>
        <span
          className={`font-mono text-3xl font-bold tracking-[0.5em] ${
            displayMuted ? "text-white/20" : "text-white"
          }`}
        >
          {displayValue}
        </span>
      </div>
    </div>
  );
}
