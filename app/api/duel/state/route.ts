import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

async function handleState(matchId: string) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: me } = await admin
    .from("match_players")
    .select("seat")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ ok: false, error: "Not in match" }, { status: 403 });
  }

  const { data: match } = await admin
    .from("matches")
    .select("id, code, status, turn_user_id, winner_user_id")
    .eq("id", matchId)
    .single();

  const { data: players } = await admin
    .from("match_players")
    .select("user_id, seat")
    .eq("match_id", matchId);

  const opponent = players?.find((p) => p.user_id !== userId)?.user_id ?? null;

  const { data: moves } = await admin
    .from("moves")
    .select("id, by_user_id, guess, bulls, cows, marks, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  const { data: secrets } = await admin
    .from("match_secrets")
    .select("user_id")
    .eq("match_id", matchId);

  const mySecretSet = (secrets ?? []).some((s) => s.user_id === userId);
  const opponentSecretSet = opponent ? (secrets ?? []).some((s) => s.user_id === opponent) : false;

  return NextResponse.json({
    ok: true,
    match,
    me: { userId, seat: me.seat },
    opponentUserId: opponent,
    moves: moves ?? [],
    secrets: {
      mySecretSet,
      opponentSecretSet,
      count: (secrets ?? []).length,
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  if (!matchId || typeof matchId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing matchId" }, { status: 400 });
  }
  return handleState(matchId);
}

export async function POST(req: Request) {
  const { matchId } = await req.json().catch(() => ({}));
  if (!matchId || typeof matchId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing matchId" }, { status: 400 });
  }
  return handleState(matchId);
}
