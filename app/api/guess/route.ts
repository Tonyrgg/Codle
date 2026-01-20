import { evaluate } from "@/app/lib/evaluate";
import { gameDateRome, dailySecret } from "@/app/lib/secret";
import { createSupabaseRouteClient } from "@/app/lib/supabase/route";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs"; // usa Node (serve crypto)
export const dynamic = "force-dynamic"; // evita caching indesiderati

const LENGTH = 4;
const MAX_ATTEMPTS = 8;

export async function POST(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteClient(request);

  // 1) Parse body
  const body = await request.json().catch(() => ({}));
  const guess = body?.guess;

  if (typeof guess !== "string" || !/^\d{4}$/.test(guess)) {
    return applyCookies(
      NextResponse.json(
        { ok: false, error: "Invalid guess. Expected 4 digits string." },
        { status: 400 },
      ),
    );
  }

  // 2) Ensure session (self-healing)
  const { data: userData1 } = await supabase.auth.getUser();
  if (!userData1?.user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      return applyCookies(
        NextResponse.json({ ok: false, error: error.message }, { status: 500 }),
      );
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return applyCookies(
      NextResponse.json(
        { ok: false, error: "Failed to establish session" },
        { status: 500 },
      ),
    );
  }

  // 3) Read today attempts
  const date = gameDateRome();

  const { data: attempts, error: readErr } = await supabase
    .from("attempts")
    .select("attempt_number, bulls")
    .eq("game_date", date)
    .order("attempt_number", { ascending: true });

  if (readErr) {
    return applyCookies(
      NextResponse.json({ ok: false, error: readErr.message }, { status: 500 }),
    );
  }

  const attemptsList = attempts ?? [];

  // lock if already won
  const alreadyWon = attemptsList.some((a) => a.bulls === LENGTH);
  if (alreadyWon) {
    return applyCookies(
      NextResponse.json(
        { ok: false, error: "Game already won for today." },
        { status: 409 },
      ),
    );
  }

  const attemptNumber = attemptsList.length + 1;
  if (attemptNumber > MAX_ATTEMPTS) {
    return applyCookies(
      NextResponse.json(
        { ok: false, error: "No attempts left for today." },
        { status: 409 },
      ),
    );
  }

  // 4) Evaluate against secret (server-only)
  let secret: string;
  try {
    secret = dailySecret(date);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return applyCookies(
      NextResponse.json(
        { ok: false, error: e?.message ?? "Secret error" },
        { status: 500 },
      ),
    );
  }

  const { bulls, cows, marks } = evaluate(secret, guess);
  const win = bulls === LENGTH;

  // 5) Insert attempt (RLS ensures only own rows)
  const { error: insErr } = await supabase.from("attempts").insert({
    user_id: user.id,
    game_date: date,
    attempt_number: attemptNumber,
    guess,
    bulls,
    cows,
  });

  if (insErr) {
    return applyCookies(
      NextResponse.json({ ok: false, error: insErr.message }, { status: 500 }),
    );
  }

  return applyCookies(
    NextResponse.json({
      ok: true,
      date,
      length: LENGTH,
      maxAttempts: MAX_ATTEMPTS,
      attemptNumber,
      bulls,
      cows,
      marks,
      win,
      attemptsRemaining: MAX_ATTEMPTS - attemptNumber,
    }),
  );
}
