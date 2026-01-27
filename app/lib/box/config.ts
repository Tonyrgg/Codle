export type Difficulty = "superEasy" | "easy" | "medium" | "hard";

export const BOX_DIFFICULTIES: Record<
  Difficulty,
  { length: number; label: string }
> = {
  superEasy: { length: 4, label: "Molto facile" },
  easy: { length: 6, label: "Facile" },
  medium: { length: 8, label: "Medio" },
  hard: { length: 10, label: "Difficile" },
};

export type BoxColor = {
  key: string; // usato in DB/logic
  label: string; // UI
  hex: string; // UI
};

export const BOX_PALETTE: BoxColor[] = [
  { key: "red", label: "Rosso", hex: "#ef4444" },
  { key: "green", label: "Verde", hex: "#10b981" },
  { key: "yellow", label: "Giallo", hex: "#f59e0b" },
  { key: "purple", label: "Viola", hex: "#8b5cf6" },
  { key: "white", label: "Bianco", hex: "#e5e7eb" },
  { key: "blue", label: "Blu", hex: "#3b82f6" },
  { key: "pink", label: "Rosa", hex: "#ec4899" },
  { key: "orange", label: "Arancione", hex: "#fb923c" },
  { key: "teal", label: "Turchese", hex: "#14b8a6" },
  { key: "lime", label: "Lime", hex: "#84cc16" },
];

export function isDifficulty(x: any): x is Difficulty {
  return x === "superEasy" || x === "easy" || x === "medium" || x === "hard";
}
