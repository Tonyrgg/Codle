import { Cell, PieceId, PIECES, applyTransform } from "./pieces";

export type Player = "P1" | "P2";
export type Board = (Player | null)[][]; // [y][x]

export function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
}

export function canPlace(board: Board, cells: Cell[], x0: number, y0: number) {
  for (const c of cells) {
    const x = x0 + c.x;
    const y = y0 + c.y;
    if (x < 0 || x >= 9 || y < 0 || y >= 9) return false;
    if (board[y][x] !== null) return false;
  }
  return true;
}

export function findDropY(
  board: Board,
  cells: Cell[],
  x0: number,
): number | null {
  if (!canPlace(board, cells, x0, 0)) return null;
  let y = 0;
  while (canPlace(board, cells, x0, y + 1)) y++;
  return y;
}

export function placeOnBoard(board: Board, absCells: Cell[], p: Player): Board {
  const next = board.map((r) => [...r]) as Board;
  for (const c of absCells) next[c.y][c.x] = p;
  return next;
}

export function pieceBase(pieceId: PieceId) {
  const def = PIECES.find((p) => p.id === pieceId);
  if (!def) throw new Error(`Unknown piece ${pieceId}`);
  return def.cells;
}

export function toAbsCells(
  pieceId: PieceId,
  rotation: number,
  mirrored: boolean,
  x0: number,
  y0: number,
): Cell[] {
  const base = pieceBase(pieceId);
  const rel = applyTransform(base, rotation, mirrored);
  return rel.map((c) => ({ x: x0 + c.x, y: y0 + c.y }));
}

// BFS (Breadth-First Search, visita in ampiezza) per connessione
function bfsConnect(
  board: Board,
  p: Player,
  startCells: Cell[],
  isGoal: (c: Cell) => boolean,
) {
  const q: Cell[] = [];
  const seen = new Set<string>();

  for (const c of startCells) {
    q.push(c);
    seen.add(`${c.x},${c.y}`);
  }

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (q.length) {
    const cur = q.shift()!;
    if (isGoal(cur)) return true;

    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (nx < 0 || nx >= 9 || ny < 0 || ny >= 9) continue;
      if (board[ny][nx] !== p) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return false;
}

// win se collega sinistra→destra OR alto→basso
export function checkWin(board: Board, p: Player) {
  const left: Cell[] = [];
  const top: Cell[] = [];

  for (let y = 0; y < 9; y++) if (board[y][0] === p) left.push({ x: 0, y });
  for (let x = 0; x < 9; x++) if (board[0][x] === p) top.push({ x, y: 0 });

  const lr = left.length ? bfsConnect(board, p, left, (c) => c.x === 8) : false;

  const tb = top.length ? bfsConnect(board, p, top, (c) => c.y === 8) : false;

  return lr || tb;
}
