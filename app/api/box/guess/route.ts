import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { BOX_DIFFICULTIES, BOX_PALETTE, isDifficulty } from "@/app/lib/box/config";
import {
  correctPositions,
  dailyBoxSecretKeys,
  gameDateRome,
} from "@/app/lib/box/secret";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const difficulty = body?.difficulty;
  const guess = body?.guess;

  if (!isDifficulty(difficulty)) {
    return NextResponse.json(
      { ok: false, error: "Invalid difficulty" },
      { status: 400 },
    );
  }

  const length = BOX_DIFFICULTIES[difficulty].length;

  const allowed = new Set(BOX_PALETTE.slice(0, length).map((c) => c.key));
  if (guess.some((k: string) => !allowed.has(k))) {
    return NextResponse.json(
      { ok: false, error: "Guess contains invalid color for this difficulty" },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(guess) ||
    guess.length !== length ||
    guess.some((x) => typeof x !== "string")
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid guess" },
      { status: 400 },
    );
  }

  // opzionale: richiedi tutti diversi (come Box Match reale)
  const uniq = new Set(guess);
  if (uniq.size !== guess.length) {
    return NextResponse.json(
      { ok: false, error: "No duplicates allowed in a guess" },
      { status: 400 },
    );
  }

  const date = gameDateRome();
  const secret = dailyBoxSecretKeys(date, difficulty);

  if (!Array.isArray(secret) || secret.length !== length) {
    return NextResponse.json(
      {
        ok: false,
        error: `Secret length mismatch: expected ${length}, got ${secret?.length}`,
      },
      { status: 500 },
    );
  }

  const okPositions = correctPositions(guess, secret);

  const admin = supabaseAdmin();

  const { error: insErr } = await admin.from("box_attempts").insert({
    user_id: userId,
    date,
    difficulty,
    guess,
    correct_positions: okPositions,
  });

  if (insErr) {
    return NextResponse.json(
      { ok: false, error: insErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    correctPositions: okPositions,
    length,
    isWin: okPositions === length,
  });
}
