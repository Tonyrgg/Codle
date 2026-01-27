"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  BOX_DIFFICULTIES,
  BOX_PALETTE,
  Difficulty,
} from "@/app/lib/box/config";
import { supabaseBrowser } from "@/app/lib/supabase/client";

type Attempt = {
  id: string;
  guess: string[];
  correct_positions: number;
  created_at: string;
};

type StateResp =
  | {
      ok: true;
      date: string;
      difficulty: Difficulty;
      length: number;
      attempts: Attempt[];
      won: boolean;
    }
  | { ok: false; error: string };

type DragData =
  | { type: "bottle"; key: string }
  | { type: "slotitem"; index: number }
  | { type: "slot"; index: number }
  | { type: "rack" };

function Bottle({ colorKey }: { colorKey: string }) {
  const c = BOX_PALETTE.find((x) => x.key === colorKey)!;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `bottle:${colorKey}`,
      data: { type: "bottle", key: colorKey } satisfies DragData,
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="h-14 w-14 cursor-grab select-none rounded-2xl border border-white/10 bg-white/5 p-2 active:cursor-grabbing"
      title={c.label}
    >
      <div
        className="mx-auto h-10 w-6 rounded-md border border-black/20"
        style={{ background: c.hex }}
      />
    </div>
  );
}

function Slot({
  index,
  filledColorKey,
  onClear,
}: {
  index: number;
  filledColorKey: string | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${index}`,
    data: { type: "slot", index } satisfies DragData,
  });

  const c = filledColorKey
    ? BOX_PALETTE.find((x) => x.key === filledColorKey)
    : null;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `slotitem:${index}`,
    data: { type: "slotitem", index } satisfies DragData,
    disabled: !filledColorKey,
  });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={[
        "relative h-16 w-16 rounded-2xl border-2 border-dashed",
        "flex items-center justify-center",
        isOver ? "border-white/40 bg-white/10" : "border-white/15 bg-white/5",
      ].join(" ")}
    >
      {c ? (
        <>
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1 top-1 h-6 w-6 rounded-full border border-white/10 bg-black/40 text-xs text-white/80 hover:bg-black/60"
            title="Rimuovi"
          >
            ✕
          </button>

          <div
            ref={setDragRef}
            style={style}
            {...listeners}
            {...attributes}
            className="h-12 w-7 cursor-grab select-none rounded-md border border-black/20 active:cursor-grabbing"
            title={c.label}
          >
            <div
              className="h-full w-full rounded-md"
              style={{ background: c.hex }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Rack() {
  const { setNodeRef, isOver } = useDroppable({
    id: "rack",
    data: { type: "rack" } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "mt-6 rounded-3xl border border-white/10 bg-black/20 p-4",
        isOver ? "bg-white/10" : "",
      ].join(" ")}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
        Bottiglie disponibili (drag)
      </div>
    </div>
  );
}

export default function BoxMatchClient({
  difficulty,
}: {
  difficulty: Difficulty;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const len = BOX_DIFFICULTIES[difficulty].length;

  const [date, setDate] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [won, setWon] = useState(false);

  const [slots, setSlots] = useState<(string | null)[]>(Array(len).fill(null));

  const showToast = useCallback((m: string, ms = 1200) => {
    setToast(m);
    window.setTimeout(() => setToast(""), ms);
  }, []);

  const ensureAnon = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const res = await supabase.auth.signInAnonymously();
    if (res.error) throw res.error;
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/box/state?difficulty=${difficulty}`, {
      cache: "no-store",
    });
    const text = await res.text();
    if (!text) throw new Error(`Empty response (${res.status})`);

    const data: StateResp = JSON.parse(text);
    if (!res.ok || !data.ok)
      throw new Error((data as any)?.error || `HTTP ${res.status}`);

    setDate(data.date);
    setAttempts(data.attempts ?? []);
    setWon(!!data.won);

    setSlots((prev) => {
      const next = Array(data.length).fill(null) as (string | null)[];
      for (let i = 0; i < Math.min(prev.length, next.length); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [difficulty]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        await ensureAnon();
        if (cancelled) return;
        await refresh();
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Errore");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureAnon, refresh]);

  const colorsForThisGame = useMemo(
    () => BOX_PALETTE.slice(0, len).map((c) => c.key),
    [len],
  );

  const used = useMemo(
    () => new Set(slots.filter(Boolean) as string[]),
    [slots],
  );

  const available = useMemo(
    () => colorsForThisGame.filter((k) => !used.has(k)),
    [colorsForThisGame, used],
  );

  const allFilled = slots.every((s) => !!s);

  const clearSlot = useCallback((idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }, []);

  function handleDragEnd(e: DragEndEvent) {
    const over = e.over;
    if (!over) return;

    const activeData = (e.active.data.current ?? null) as DragData | null;
    const overData = (over.data.current ?? null) as DragData | null;

    // Drop sul rack: solo gli item dentro gli slot possono tornare giù
    if (over.id === "rack") {
      if (activeData?.type === "slotitem") {
        clearSlot(activeData.index);
      }
      return;
    }

    // Drop su uno slot
    if (overData?.type === "slot") {
      const toIdx = overData.index;

      // pool -> slot
      if (activeData?.type === "bottle") {
        const key = activeData.key;

        setSlots((prev) => {
          const next = [...prev];

          // se già usata in un altro slot, la togliamo prima (no duplicati)
          const fromIdx = next.findIndex((x) => x === key);
          if (fromIdx >= 0) next[fromIdx] = null;

          // set nel target (qualsiasi cosa c'era torna disponibile sotto)
          next[toIdx] = key;
          return next;
        });
        return;
      }

      // slot -> slot (swap)
      if (activeData?.type === "slotitem") {
        const fromIdx = activeData.index;

        if (fromIdx === toIdx) return;

        setSlots((prev) => {
          const next = [...prev];
          const a = next[fromIdx];
          const b = next[toIdx];
          next[toIdx] = a;
          next[fromIdx] = b;
          return next;
        });
        return;
      }
    }
  }

  const submit = useCallback(async () => {
    if (!allFilled) return showToast("Completa tutti gli slot.");
    if (won) return showToast("Hai già completato il daily di oggi.");

    const guess = slots as string[];

    const uniq = new Set(guess);
    if (uniq.size !== guess.length)
      return showToast("Non puoi duplicare un colore.");

    const res = await fetch("/api/box/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty, guess }),
    });

    const text = await res.text();
    if (!text) return showToast(`Risposta vuota (${res.status})`, 1600);

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return showToast("Risposta non valida dal server.", 1600);
    }

    if (!res.ok || !data.ok) {
      return showToast(data?.error || `HTTP ${res.status}`, 1600);
    }

    const ok = Number(data.correctPositions ?? 0);
    if (ok === len) showToast(`Perfetto! ${ok}/${len} ✅`, 1600);
    else showToast(`Posizioni corrette: ${ok}/${len}`, 1600);

    await refresh();
  }, [allFilled, slots, difficulty, refresh, showToast, len, won]);

  const reset = useCallback(() => {
    setSlots(Array(len).fill(null));
  }, [len]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-slate-100">Caricamento...</div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {err}
        </div>
        <button
          className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 hover:bg-white/15"
          onClick={refresh}
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 text-slate-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-3xl font-bold">Box Match</div>
          <div className="text-sm text-slate-300">
            Daily {difficulty.toUpperCase()} · {date} · {len} slot
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href="/box"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Menu
          </a>
          <button
            onClick={reset}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Reset
          </button>
          <button
            onClick={submit}
            disabled={!allFilled || won}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            Check
          </button>
        </div>
      </div>

      {toast ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold">
          {toast}
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
          Slot
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <div className="mt-4 flex flex-wrap gap-3">
            {slots.map((s, i) => (
              <Slot
                key={i}
                index={i}
                filledColorKey={s}
                onClear={() => clearSlot(i)}
              />
            ))}
          </div>

          {/* ✅ Rack NON prende props */}
          <Rack />

          {/* ✅ Sotto: SOLO bottiglie disponibili (non duplicano quelle sopra) */}
          <div className="mt-4 flex flex-wrap gap-3">
            {available.map((key) => (
              <Bottle key={key} colorKey={key} />
            ))}
          </div>
        </DndContext>
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
            Tentativi
          </div>
          <div className="text-sm text-slate-300">
            {won ? (
              <span className="font-semibold text-emerald-300">
                Completato ✅
              </span>
            ) : (
              "Illimitati"
            )}
          </div>
        </div>

        {attempts.length === 0 ? (
          <div className="mt-4 text-sm text-slate-300">
            Nessun tentativo ancora.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {attempts.map((a, idx) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="text-sm text-slate-200">
                  #{idx + 1} · corrette:{" "}
                  <span className="font-semibold text-white">
                    {a.correct_positions}/{len}
                  </span>
                </div>
                <div className="flex gap-2">
                  {a.guess.map((k, i) => {
                    const c = BOX_PALETTE.find((x) => x.key === k);
                    return (
                      <div
                        key={i}
                        className="h-8 w-5 rounded-md border border-black/20"
                        title={c?.label || k}
                        style={{ background: c?.hex || "#334155" }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
