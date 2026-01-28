import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { emptyBoard, findDropY, placeOnBoard, toAbsCells, checkWin } from "@/app/lib/gridlink/engine";
import type { PieceId } from "@/app/lib/gridlink/pieces";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const matchId = body?.matchId as string;
  const inventoryId = body?.inventoryId as string;
  const rotation = Number(body?.rotation ?? 0);
  const mirrored = !!body?.mirrored;
  const dropX = Number(body?.dropX);

  if (!matchId || !inventoryId) return NextResponse.json({ ok: false, error: "Missing params" }, { status: 400 });
  if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) return NextResponse.json({ ok: false, error: "Invalid rotation" }, { status: 400 });
  if (!Number.isInteger(dropX) || dropX < 0 || dropX > 8) return NextResponse.json({ ok: false, error: "Invalid dropX" }, { status: 400 });

  const admin = supabaseAdmin();

  // match + turno
  const { data: match } = await admin
    .from("gridlink_matches")
    .select("id, status, turn_user_id, winner_user_id")
    .eq("id", matchId)
    .single();

  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
  if (match.status !== "active") return NextResponse.json({ ok: false, error: "Match not active" }, { status: 409 });
  if (match.winner_user_id) return NextResponse.json({ ok: false, error: "Match finished" }, { status: 409 });
  if (match.turn_user_id !== userId) return NextResponse.json({ ok: false, error: "Not your turn" }, { status: 409 });

  // inventory check (tuo e non usato)
  const { data: inv } = await admin
    .from("gridlink_inventory")
    .select("id, piece_id, used")
    .eq("id", inventoryId)
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .single();

  if (!inv) return NextResponse.json({ ok: false, error: "Piece not found" }, { status: 404 });
  if (inv.used) return NextResponse.json({ ok: false, error: "Piece already used" }, { status: 409 });

  const pieceId = inv.piece_id as PieceId;

  // ricostruisci board da moves
  const { data: moves } = await admin
    .from("gridlink_moves")
    .select("by_user_id, cells")
    .eq("match_id", matchId);

  const board = emptyBoard();
  for (const m of moves ?? []) {
    const p = m.by_user_id === userId ? "P1" : "P2"; // NON basta in generale: sotto facciamo via seat
  }

  // mappa user->P1/P2 via seat
  const { data: players } = await admin
    .from("gridlink_players")
    .select("user_id, seat")
    .eq("match_id", matchId);

  const pMap = new Map<string, "P1" | "P2">();
  for (const pl of players ?? []) pMap.set(pl.user_id, pl.seat === 1 ? "P1" : "P2");

  for (const m of moves ?? []) {
    const pp = pMap.get(m.by_user_id) ?? null;
    if (!pp) continue;
    const cells = (m.cells as any[]) ?? [];
    for (const c of cells) {
      if (typeof c?.x === "number" && typeof c?.y === "number") board[c.y][c.x] = pp;
    }
  }

  const myP = pMap.get(userId);
  if (!myP) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 403 });

  // gravità
  // per findDropY servono le celle relative trasformate: usiamo toAbsCells con y0 provvisorio e poi calcoliamo y reale
  // trick: calcoliamo y con engine usando celle relative (toAbsCells non va bene); qui più semplice:
  // ricaviamo abs cells a y0=0, poi sottraiamo y0 dopo; ma meglio: riusa toAbsCells solo dopo dropY.
  // quindi calcoliamo dropY facendo tentativi con toAbsCells y variabile:
  // (implementazione semplice: prova y da 0 a 8 e trova l’ultima valida)

  // Costruisci rel-cells con y0=0 e x0=0 => poi useremo canPlace tramite findDropY in engine (già fa canPlace)
  // engine findDropY richiede rel-cells, quindi:
  // import applyTransform direttamente? per tenere route pulita, facciamo un mini-call:
  const { applyTransform, PIECES } = await import("@/app/lib/gridlink/pieces");
  const base = PIECES.find((p) => p.id === pieceId)?.cells;
  if (!base) return NextResponse.json({ ok: false, error: "Unknown piece" }, { status: 400 });
  const rel = applyTransform(base, rotation, mirrored);

  const dropY = findDropY(board, rel, dropX);
  if (dropY == null) return NextResponse.json({ ok: false, error: "Cannot drop here" }, { status: 409 });

  const absCells = rel.map((c) => ({ x: dropX + c.x, y: dropY + c.y }));

  // salva move + mark used
  const { error: insErr } = await admin.from("gridlink_moves").insert({
    match_id: matchId,
    by_user_id: userId,
    inventory_id: inventoryId,
    piece_id: pieceId,
    rotation,
    mirrored,
    drop_x: dropX,
    drop_y: dropY,
    cells: absCells,
  });

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  const { error: upErr } = await admin.from("gridlink_inventory").update({ used: true }).eq("id", inventoryId);
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  // check win
  const boardAfter = placeOnBoard(board, absCells, myP);
  const isWin = checkWin(boardAfter, myP);

  // turno passa all’altro
  const opp = (players ?? []).find((p) => p.user_id !== userId)?.user_id ?? null;

  if (isWin) {
    await admin.from("gridlink_matches").update({ status: "finished", winner_user_id: userId }).eq("id", matchId);
  } else if (opp) {
    await admin.from("gridlink_matches").update({ turn_user_id: opp }).eq("id", matchId);
  }

  return NextResponse.json({ ok: true, dropX, dropY, isWin });
}
