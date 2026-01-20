export type Mark = "green" | "yellow" | "gray";

export function evaluate(secret: string, guess: string) {
  if (!/^\d{4}$/.test(secret) || !/^\d{4}$/.test(guess)) {
    throw new Error("Invalid secret/guess");
  }

  const s = secret.split("");
  const g = guess.split("");

  const marks: Mark[] = Array(4).fill("gray");

  // 1) Verdi
  const sRemaining: string[] = [];
  const gRemainingIdx: number[] = [];

  for (let i = 0; i < 4; i++) {
    if (g[i] === s[i]) {
      marks[i] = "green";
    } else {
      sRemaining.push(s[i]);
      gRemainingIdx.push(i);
    }
  }

  // 2) Frequenze residuo segreto
  const freq = new Map<string, number>();
  for (const ch of sRemaining) freq.set(ch, (freq.get(ch) ?? 0) + 1);

  // 3) Gialli con ripetizioni corrette
  for (const i of gRemainingIdx) {
    const ch = g[i];
    const n = freq.get(ch) ?? 0;
    if (n > 0) {
      marks[i] = "yellow";
      freq.set(ch, n - 1);
    }
  }

  const bulls = marks.filter(m => m === "green").length;
  const cows = marks.filter(m => m === "yellow").length;

  return { bulls, cows, marks };
}
