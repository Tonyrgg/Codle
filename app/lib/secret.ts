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

/**
 * PRNG deterministico (xorshift32) seedato con SHA256(seed|date)
 */
function makeRng(seedStr: string) {
  const h = crypto.createHash("sha256").update(seedStr).digest();
  // usa 4 byte per inizializzare lo stato (uint32)
  let state = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;

  // evita stato 0 (xorshift soffre)
  if (state === 0) state = 0x9e3779b9;

  return {
    nextU32() {
      // xorshift32
      state ^= (state << 13) >>> 0;
      state ^= (state >>> 17) >>> 0;
      state ^= (state << 5) >>> 0;
      return state >>> 0;
    },
    nextInt(max: number) {
      // 0..max-1
      return (this.nextU32() % max) >>> 0;
    },
    nextPercent() {
      // 0..99
      return this.nextInt(100);
    },
  };
}

function shuffleInPlace<T>(arr: T[], rng: ReturnType<typeof makeRng>) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistinctDigits(
  n: number,
  rng: ReturnType<typeof makeRng>,
  forbidden = new Set<string>(),
) {
  const out: string[] = [];
  while (out.length < n) {
    const d = String(rng.nextInt(10));
    if (forbidden.has(d)) continue;
    if (out.includes(d)) continue;
    out.push(d);
  }
  return out;
}

function genAllDistinct(length: number, rng: ReturnType<typeof makeRng>) {
  return pickDistinctDigits(length, rng).join("");
}

function genOnePair(length: number, rng: ReturnType<typeof makeRng>) {
  const dup = String(rng.nextInt(10));
  const others = pickDistinctDigits(length - 2, rng, new Set([dup]));
  const chars = [dup, dup, ...others];
  return shuffleInPlace(chars, rng).join("");
}

function genTwoPairs(length: number, rng: ReturnType<typeof makeRng>) {
  // ha senso soprattutto a length=4
  const [a, b] = pickDistinctDigits(2, rng);
  const chars = [a, a, b, b];
  return shuffleInPlace(chars, rng).join("");
}

function genTriple(length: number, rng: ReturnType<typeof makeRng>) {
  // length=4: AAAB
  const a = String(rng.nextInt(10));
  const [b] = pickDistinctDigits(1, rng, new Set([a]));
  const chars = [a, a, a, b];
  return shuffleInPlace(chars, rng).join("");
}

export function dailySecret(dateStr: string): string {
  const seed = process.env.DAILY_SEED;
  if (!seed) throw new Error("Missing DAILY_SEED env var");

  const LENGTH = 4;

  // Config: 15% duplicati
  const DUP_PERCENT = 15;

  // Mix dentro il 15%: 70% pair, 20% twoPairs, 10% triple
  const MIX = { pair: 70, twoPairs: 20, triple: 10 };

  const rng = makeRng(`${seed}|${dateStr}`);

  const roll = rng.nextPercent(); // 0..99
  if (roll >= DUP_PERCENT) {
    return genAllDistinct(LENGTH, rng);
  }

  const total = MIX.pair + MIX.twoPairs + MIX.triple;
  const r = rng.nextInt(total) + 1;

  if (r <= MIX.pair) return genOnePair(LENGTH, rng);

  if (r <= MIX.pair + MIX.twoPairs) {
    return LENGTH === 4 ? genTwoPairs(LENGTH, rng) : genOnePair(LENGTH, rng);
  }

  return LENGTH === 4 ? genTriple(LENGTH, rng) : genOnePair(LENGTH, rng);
}
