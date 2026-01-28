"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import { PIECES, PieceId, applyTransform } from "@/app/lib/gridlink/pieces";

type MatchStatus = "waiting" | "active" | "finished" | string;

type StateResp =
  | {
      ok: true;
      match: {
        id: string;
        code: string;
        status: MatchStatus;
        turn_user_id: string | null;
        winner_user_id: string | null;
      };
      me: { userId: string; seat: number };
      opponentUserId: string | null;
      inventory: { id: string; piece_id: PieceId; used: boolean }[];
      moves: {
        id: string;
        by_user_id: string;
        piece_id: PieceId;
        rotation: number;
        mirrored: boolean;
        drop_x: number;
        drop_y: number;
        cells: { x: number; y: number }[];
        created_at: string;
      }[];
    }
  | { ok: false; error: string };

type PlayerMark = "P1" | "P2";
type Board = (PlayerMark | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
}

function buildBoard(
  moves: StateResp extends { ok: true } ? StateResp["moves"] : any,
  seatByUserId: (uid: string) => PlayerMark | null,
): Board {
  const b = emptyBoard();
  for (const m of moves ?? []) {
    const p = seatByUserId(m.by_user_id);
    if (!p) continue;
    for (const c of m.cells ?? []) {
      if (c && typeof c.x === "number" && typeof c.y === "number") {
        if (c.x >= 0 && c.x < 9 && c.y >= 0 && c.y < 9) b[c.y][c.x] = p;
      }
    }
  }
  return b;
}

function cls(...x: (string | false | null | undefined)[]) {
  return x.filter(Boolean).join(" ");
}

/* ---------- UI components ---------- */

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[0.65rem] font-mono uppercase tracking-[0.35em] text-slate-200">
      {children}
    </span>
  );
}

function ColumnDrop({ col }: { col: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${col}`,
    data: { type: "col", col },
  });

  return (
    <div
      ref={setNodeRef}
      className={cls(
        "absolute inset-y-0",
        "w-[calc(100%/9)]",
        // IMPORTANT: deve poter ricevere pointer events
        "pointer-events-auto",
        isOver ? "bg-white/5" : "",
      )}
      style={{ left: `calc(${col} * (100% / 9))` }}
      aria-label={`drop-column-${col}`}
    />
  );
}

function PieceTile({
  invId,
  pieceId,
  disabled,
  selected,
  onSelect,
}: {
  invId: string;
  pieceId: PieceId;
  disabled: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } =
    useDraggable({
      id: `inv:${invId}`,
      data: { type: "inv", invId, pieceId },
      disabled,
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      disabled={disabled}
      className={cls(
        "relative flex items-center justify-center",
        "h-14 w-14 rounded-2xl border",
        "bg-white/5 text-white",
        "active:cursor-grabbing disabled:opacity-35",
        selected ? "border-amber-300/60 bg-amber-300/10" : "border-white/10",
      )}
      title={`${pieceId}${disabled ? " (usato)" : ""}`}
    >
      <span className="font-mono text-xs tracking-[0.25em]">{pieceId}</span>
    </button>
  );
}

/* ---------- Main client ---------- */

export default function GridLinkClient({ matchId }: { matchId: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meId, setMeId] = useState("");
  const [meSeat, setMeSeat] = useState<number>(1);
  const [opponentId, setOpponentId] = useState<string | null>(null);

  const [matchCode, setMatchCode] = useState("");
  const [status, setStatus] = useState<MatchStatus>("waiting");
  const [turnUserId, setTurnUserId] = useState<string | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  const [inventory, setInventory] = useState<
    { id: string; piece_id: PieceId; used: boolean }[]
  >([]);
  const [moves, setMoves] = useState<
    StateResp extends { ok: true } ? StateResp["moves"] : any
  >([]);

  const [toast, setToast] = useState("");

  // transform controls
  const [rotation, setRotation] = useState<number>(0);
  const [mirrored, setMirrored] = useState<boolean>(false);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const showToast = useCallback((m: string, ms = 1300) => {
    setToast(m);
    window.setTimeout(() => setToast(""), ms);
  }, []);

  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const res = await fetch(`/api/gridlink/state?matchId=${matchId}`, {
        cache: "no-store",
      });
      const text = await res.text();
      if (!text) throw new Error(`Empty response (${res.status})`);

      const data: StateResp = JSON.parse(text);
      if (!res.ok || !data.ok)
        throw new Error((data as any)?.error || `HTTP ${res.status}`);

      setMatchCode(data.match.code ?? "");
      setStatus(data.match.status);
      setTurnUserId(data.match.turn_user_id ?? null);
      setWinner(data.match.winner_user_id ?? null);

      setMeId(data.me.userId);
      setMeSeat(data.me.seat);
      setOpponentId(data.opponentUserId ?? null);

      setInventory(data.inventory ?? []);
      setMoves(data.moves ?? []);
    } finally {
      window.setTimeout(() => (refreshingRef.current = false), 120);
    }
  }, [matchId]);

  /**
   * ✅ ensureAnon ritorna un access_token valido e lo aggancia a Realtime.
   * Se non ritorna token, realtime può "SUBSCRIBED" ma non ricevere payload (RLS/JWT).
   */
  const ensureAnon = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn("[auth getSession error]", error);

    if (!data.session) {
      const res = await supabase.auth.signInAnonymously();
      if (res.error) throw res.error;
    }

    const again = await supabase.auth.getSession();
    const token = again.data.session?.access_token;
    if (!token) throw new Error("Session not ready");
    // IMPORTANT: passa token al realtime client
    supabase.realtime.setAuth(token);
    return token;
  }, [supabase]);

  /**
   * ✅ SINGLE bootstrap (prima avevi due useEffect e una race-condition).
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        await ensureAnon();
        if (cancelled) return;

        setAuthReady(true);
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

  /**
   * ✅ Se il token cambia (refresh/reauth), riallinea il realtime auth.
   */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token;
      if (token) supabase.realtime.setAuth(token);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  /**
   * ✅ Realtime: sottoscrivi SOLO dopo authReady.
   * Eventi: moves INSERT, matches UPDATE, players INSERT.
   */
  useEffect(() => {
    if (!authReady) return;
    if (!matchId) return;

    let unmounted = false;

    const channel = supabase
      .channel(`gridlink:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gridlink_moves",
          filter: `match_id=eq.${matchId}`,
        },
        async (payload: any) => {
          console.log("[RT moves INSERT]", payload.new);
          if (unmounted) return;
          await refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gridlink_matches",
          filter: `id=eq.${matchId}`,
        },
        async (payload: any) => {
          console.log("[RT matches UPDATE]", payload.new);
          if (unmounted) return;
          await refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gridlink_players",
          filter: `match_id=eq.${matchId}`,
        },
        async (payload: any) => {
          console.log("[RT players INSERT]", payload.new);
          if (unmounted) return;
          await refresh();
        },
      )
      .subscribe((st: any) => {
        console.log("[RT subscribe status]", st);
        if (st === "SUBSCRIBED") refresh();
      });

    return () => {
      unmounted = true;
      supabase.removeChannel(channel);
    };
  }, [authReady, supabase, matchId, refresh]);

  // derived
  const isMyTurn = !!turnUserId && !!meId && turnUserId === meId;
  const canPlay = status === "active" && !winner && isMyTurn;

  const seatByUserId = useCallback(
    (uid: string): PlayerMark | null => {
      if (!uid) return null;
      if (uid === meId) return meSeat === 1 ? "P1" : "P2";
      if (opponentId && uid === opponentId) return meSeat === 1 ? "P2" : "P1";
      return null;
    },
    [meId, meSeat, opponentId],
  );

  const board = useMemo(
    () => buildBoard(moves, seatByUserId),
    [moves, seatByUserId],
  );

  const myUnused = useMemo(() => inventory.filter((x) => !x.used), [inventory]);

  const selectedPiece = useMemo(() => {
    if (!selectedInvId) return null;
    return myUnused.find((x) => x.id === selectedInvId) ?? null;
  }, [selectedInvId, myUnused]);

  const banner = useMemo(() => {
    if (winner) return winner === meId ? "Hai vinto." : "Hai perso.";

    if (status === "waiting") {
      return opponentId
        ? "Avversario connesso. In attesa che inizi la partita..."
        : "In attesa di un secondo giocatore. Condividi il codice.";
    }

    if (status === "active" && !turnUserId)
      return "Partita avviata. Estrazione turno in corso...";

    if (status === "active")
      return canPlay
        ? "È il tuo turno: trascina un pezzo su una colonna."
        : "Turno avversario.";

    return "Stato non riconosciuto.";
  }, [winner, meId, status, opponentId, canPlay]);

  const placeMove = useCallback(
    async (invId: string, pieceId: PieceId, dropX: number) => {
      if (!canPlay) return showToast("Non è il tuo turno.", 1400);

      const res = await fetch("/api/gridlink/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          inventoryId: invId,
          rotation,
          mirrored,
          dropX,
        }),
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

      if (data.isWin) showToast("Connessione completata ✅", 1600);
      else showToast("Mossa inserita.", 900);

      await refresh();
    },
    [canPlay, showToast, matchId, rotation, mirrored, refresh],
  );

  function onDragEnd(e: DragEndEvent) {
    const over = e.over;
    if (!over) return;

    const activeData = e.active.data.current as any;
    const overData = over.data.current as any;

    if (activeData?.type !== "inv") return;
    if (overData?.type !== "col") return;

    const invId = String(activeData.invId);
    const pieceId = activeData.pieceId as PieceId;
    const col = Number(overData.col);
    if (!Number.isFinite(col)) return;

    placeMove(invId, pieceId, col);
  }

  // Poll SOLO se waiting (safety net; realtime dovrebbe bastare)
  useEffect(() => {
    if (!matchId) return;
    if (winner) return;
    if (status !== "waiting") return;

    const id = window.setInterval(() => {
      refresh();
    }, 1200);

    return () => window.clearInterval(id);
  }, [matchId, status, winner, refresh]);

  // preview
  const previewCells = useMemo(() => {
    if (!selectedPiece) return [];
    const base =
      PIECES.find((p) => p.id === selectedPiece.piece_id)?.cells ?? [];
    return applyTransform(base, rotation, mirrored);
  }, [selectedPiece, rotation, mirrored]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-slate-100">Caricamento...</div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-slate-100">
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
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-slate-100">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-3xl font-bold">LinkX — GridLink</div>
          <div className="mt-1 text-sm text-slate-300">
            Match: <span className="font-mono">{matchId}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-2xl border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-xs font-mono uppercase tracking-[0.35em] hover:bg-violet-500/30 disabled:opacity-40"
            onClick={async () => {
              if (!matchCode) return;
              try {
                await navigator.clipboard.writeText(matchCode);
                showToast("Codice copiato.");
              } catch {
                showToast("Impossibile copiare.", 1600);
              }
            }}
            disabled={!matchCode}
          >
            CODE{" "}
            <span className="ml-2 font-bold text-white">
              {matchCode || "----"}
            </span>
          </button>

          <a
            href="/gridlink"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-mono uppercase tracking-[0.35em] hover:bg-white/10"
          >
            Menu
          </a>
        </div>
      </header>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">{banner}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{status}</Chip>
            <Chip>{canPlay ? "YOUR TURN" : "WAIT"}</Chip>
            {winner ? <Chip>WINNER</Chip> : null}
          </div>
        </div>

        {toast ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold">
            {toast}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
            Trasformazioni
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40"
              onClick={() => setRotation((r) => (r + 1) % 4)}
              disabled={!selectedPiece}
            >
              Ruota ⟳
            </button>
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40"
              onClick={() => setMirrored((m) => !m)}
              disabled={!selectedPiece}
            >
              Mirror ⇋
            </button>
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              onClick={() => {
                setRotation(0);
                setMirrored(false);
                setSelectedInvId(null);
              }}
            >
              Reset
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-300">
            Seleziona un pezzo sotto per vedere l’anteprima (solo UI). La
            gravità è sempre verticale.
          </div>

          {selectedPiece ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-mono uppercase tracking-[0.35em] text-slate-300">
                Preview {selectedPiece.piece_id} · rot {rotation} ·{" "}
                {mirrored ? "mir" : "norm"}
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {Array.from({ length: 25 }).map((_, i) => {
                  const x = i % 5;
                  const y = Math.floor(i / 5);
                  const hit = previewCells.some((c) => c.x === x && c.y === y);
                  return (
                    <div
                      key={i}
                      className={cls(
                        "h-8 w-8 rounded-lg border",
                        hit
                          ? "border-emerald-300/60 bg-emerald-500/20"
                          : "border-white/10 bg-white/5",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-2 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
              Griglia 9×9
            </div>
            <div className="text-xs font-mono uppercase tracking-[0.35em] text-slate-300">
              Tu: {meSeat === 1 ? "P1" : "P2"} · Opp:{" "}
              {meSeat === 1 ? "P2" : "P1"}
            </div>
          </div>

          <DndContext onDragEnd={onDragEnd}>
            <div className="relative mt-4">
              {/* droppable columns overlay (IMPORTANT: niente pointer-events-none qui) */}
              <div className="absolute inset-0 z-10 grid grid-cols-9">
                {Array.from({ length: 9 }).map((_, col) => (
                  <div key={col} className="relative">
                    <ColumnDrop col={col} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-9 gap-1 rounded-2xl border border-white/10 bg-black/30 p-2">
                {board.flatMap((row, y) =>
                  row.map((cell, x) => {
                    const isMe = (meSeat === 1 ? "P1" : "P2") === cell;
                    const isOpp = cell && !isMe;
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={cls(
                          "h-9 w-9 rounded-md border",
                          cell === null && "border-white/10 bg-white/5",
                          isMe && "border-emerald-300/50 bg-emerald-500/25",
                          isOpp && "border-rose-300/50 bg-rose-500/25",
                        )}
                        title={`${x},${y}`}
                      />
                    );
                  }),
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
                  I tuoi pezzi (14)
                </div>
                <div className="text-xs text-slate-300">
                  {myUnused.length} disponibili ·{" "}
                  {inventory.length - myUnused.length} usati
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {inventory.map((inv) => (
                  <PieceTile
                    key={inv.id}
                    invId={inv.id}
                    pieceId={inv.piece_id}
                    disabled={inv.used || !canPlay}
                    selected={selectedInvId === inv.id}
                    onSelect={() => {
                      if (inv.used) return;
                      setSelectedInvId(inv.id);
                    }}
                  />
                ))}
              </div>

              <div className="mt-4 text-xs text-slate-300">
                Drag&drop: trascina un pezzo sopra una colonna della griglia. Se
                non può scendere, il server rifiuta la mossa.s
              </div>
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
