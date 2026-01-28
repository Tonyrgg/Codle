import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  if (!matchId)
    return NextResponse.json(
      { ok: false, error: "Missing matchId" },
      { status: 400 },
    );

  const admin = supabaseAdmin();

  const { data: me } = await admin
    .from("gridlink_players")
    .select("seat")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!me)
    return NextResponse.json(
      { ok: false, error: "Not in match" },
      { status: 403 },
    );

  const { data: match } = await admin
    .from("gridlink_matches")
    .select("id, code, status, turn_user_id, winner_user_id")
    .eq("id", matchId)
    .single();

  const { data: players } = await admin
    .from("gridlink_players")
    .select("user_id, seat")
    .eq("match_id", matchId);

  const opponentUserId =
    players?.find((p) => p.user_id !== userId)?.user_id ?? null;

  const { data: inventory } = await admin
    .from("gridlink_inventory")
    .select("id, piece_id, used")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const { data: moves } = await admin
    .from("gridlink_moves")
    .select(
      "id, by_user_id, piece_id, rotation, mirrored, drop_x, drop_y, cells, created_at",
    )
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ok: true,
    match,
    me: { userId, seat: me.seat },
    opponentUserId,
    inventory: inventory ?? [],
    moves: moves ?? [],
  });
}
