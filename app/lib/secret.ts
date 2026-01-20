import crypto from "crypto";

export function gameDateRome(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // YYYY-MM-DD
}

export function dailySecret(dateStr: string): string {
  const seed = process.env.DAILY_SEED;
  if (!seed) throw new Error("Missing DAILY_SEED env var");

  const h = crypto.createHash("sha256").update(`${seed}|${dateStr}`).digest("hex");

  // 4 cifre 0-9, ripetizioni possibili
  const digits: string[] = [];
  for (let i = 0; i < 4; i++) {
    const nibble = parseInt(h[i], 16); // 0..15
    digits.push(String(nibble % 10));
  }
  return digits.join("");
}
