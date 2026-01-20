import { createSupabaseRouteClient } from "@/app/lib/supabase/route";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function gameDateRome(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

export async function GET(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteClient(request);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return applyCookies(NextResponse.json({ ok: false, error: "No session" }, { status: 401 }));
  }

  const date = gameDateRome();

  const { data: attempts, error } = await supabase
    .from("attempts")
    .select("attempt_number, guess, bulls, cows, created_at")
    .eq("game_date", date)
    .order("attempt_number", { ascending: true });

  if (error) {
    return applyCookies(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
  }

  return applyCookies(
    NextResponse.json({
      ok: true,
      date,
      length: 4,
      maxAttempts: 8,
      attempts: attempts ?? [],
    })
  );
}
