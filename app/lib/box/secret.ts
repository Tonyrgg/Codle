import crypto from "crypto";
import { BOX_DIFFICULTIES, BOX_PALETTE, Difficulty } from "./config";

export function gameDateRome(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // YYYY-MM-DD
}

// PRNG deterministico semplice (xorshift32)
function xorshift32(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296; // 0..1
  };
}

function seedFromHash(hex: string) {
  // prende 8 hex => 32-bit
  const n = parseInt(hex.slice(0, 8), 16);
  return Number.isFinite(n) ? n : 123456789;
}

export function dailyBoxSecretKeys(
  dateStr: string,
  difficulty: Difficulty,
): string[] {
  const seed = process.env.DAILY_SEED;
  if (!seed) throw new Error("Missing DAILY_SEED env var");

  const base = crypto
    .createHash("sha256")
    .update(`${seed}|box|${difficulty}|${dateStr}`)
    .digest("hex");

  const rand = xorshift32(seedFromHash(base));

  const len = BOX_DIFFICULTIES[difficulty].length;

  // ✅ POOL ALLINEATO ALLA UI: stessi colori disponibili al player
  const keys = BOX_PALETTE.slice(0, len).map((c) => c.key);

  // shuffle Fisher-Yates (su pool di dimensione len)
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }

  return keys; // già len
}


export function correctPositions(guess: string[], secret: string[]) {
  const n = Math.min(guess.length, secret.length);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    if (guess[i] === secret[i]) ok++;
  }
  return ok;
}
