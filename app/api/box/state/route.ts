import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { BOX_DIFFICULTIES, isDifficulty } from "@/app/lib/box/config";
import { gameDateRome } from "@/app/lib/box/secret";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get("difficulty");

  if (!isDifficulty(difficulty)) {
    return NextResponse.json({ ok: false, error: "Invalid difficulty" }, { status: 400 });
  }

  const date = gameDateRome();
  const admin = supabaseAdmin();

  const { data: attempts, error } = await admin
    .from("box_attempts")
    .select("id, guess, correct_positions, created_at")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("difficulty", difficulty)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const length = BOX_DIFFICULTIES[difficulty].length;
  const won = (attempts ?? []).some((a) => a.correct_positions === length);

  return NextResponse.json({
    ok: true,
    date,
    difficulty,
    length,
    attempts: attempts ?? [],
    won,
  });
}
