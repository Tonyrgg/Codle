export type Cell = { x: number; y: number };
export type PieceId = "S1" | "I2" | "Z4" | "L3" | "I3" | "J4" | "T4";

export const PIECES: { id: PieceId; copiesPerPlayer: number; cells: Cell[] }[] =
  [
    { id: "S1", copiesPerPlayer: 2, cells: [{ x: 0, y: 0 }] },
    {
      id: "I2",
      copiesPerPlayer: 2,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      id: "Z4",
      copiesPerPlayer: 2,
      cells: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
    },
    {
      id: "L3",
      copiesPerPlayer: 2,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    {
      id: "I3",
      copiesPerPlayer: 2,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    },
    {
      id: "J4",
      copiesPerPlayer: 2,
      cells: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 0 },
      ],
    },
    {
      id: "T4",
      copiesPerPlayer: 2,
      cells: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 1 },
      ],
    },
  ];

export function normalize(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

export function rotate90(cells: Cell[]): Cell[] {
  return normalize(cells.map((c) => ({ x: -c.y, y: c.x })));
}

export function mirrorX(cells: Cell[]): Cell[] {
  return normalize(cells.map((c) => ({ x: -c.x, y: c.y })));
}

export function applyTransform(
  base: Cell[],
  rotation: number,
  mirrored: boolean,
): Cell[] {
  let out = base;
  if (mirrored) out = mirrorX(out);
  for (let i = 0; i < ((rotation % 4) + 4) % 4; i++) out = rotate90(out);
  return normalize(out);
}
