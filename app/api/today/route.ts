import { CODE_LENGTH_GLOBAL, MAX_ATTEMPTS_GLOBAL } from "@/app/lib/config";
import { evaluate } from "@/app/lib/evaluate";
import { gameDateRome, dailySecret } from "@/app/lib/secret";
import { createSupabaseRouteClient } from "@/app/lib/supabase/routeClient";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LENGTH = CODE_LENGTH_GLOBAL;
const MAX_ATTEMPTS = MAX_ATTEMPTS_GLOBAL;

export async function GET(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteClient(request);

  // 1) Ensure session (self-healing)
  const { data: userData1 } = await supabase.auth.getUser();
  if (!userData1?.user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      return applyCookies(
        NextResponse.json({ ok: false, error: error.message }, { status: 500 }),
      );
    }
  }

  // 2) Data di gioco (Europe/Rome)
  const date = gameDateRome();

  // 3) Leggi tentativi (RLS applicata)
  const { data: attempts, error } = await supabase
    .from("attempts")
    .select("attempt_number, guess, bulls, cows, created_at")
    .eq("game_date", date)
    .order("attempt_number", { ascending: true });

  if (error) {
    return applyCookies(
      NextResponse.json({ ok: false, error: error.message }, { status: 500 }),
    );
  }

  // 4) Calcola segreto giornaliero e marks per ogni riga
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

  const enriched = (attempts ?? []).map((a) => {
    const guess = String(a.guess ?? "");
    const { marks } = evaluate(secret, guess); // green/yellow/gray
    return { ...a, marks };
  });

  return applyCookies(
    NextResponse.json({
      ok: true,
      date,
      length: LENGTH,
      maxAttempts: MAX_ATTEMPTS,
      attempts: enriched,
    }),
  );
}
