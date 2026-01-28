import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { PIECES } from "@/app/lib/gridlink/pieces";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string")
    return NextResponse.json(
      { ok: false, error: "Missing code" },
      { status: 400 },
    );

  const admin = supabaseAdmin();

  const { data: match, error: mErr } = await admin
    .from("gridlink_matches")
    .select("id, status, turn_user_id")
    .eq("code", code)
    .single();

  if (mErr || !match)
    return NextResponse.json(
      { ok: false, error: "Match not found" },
      { status: 404 },
    );

  // già dentro?
  const { data: already } = await admin
    .from("gridlink_players")
    .select("seat")
    .eq("match_id", match.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (already)
    return NextResponse.json({
      ok: true,
      matchId: match.id,
      alreadyJoined: true,
    });

  // seat 2 libero?
  const { data: seat2 } = await admin
    .from("gridlink_players")
    .select("user_id")
    .eq("match_id", match.id)
    .eq("seat", 2)
    .maybeSingle();

  if (seat2)
    return NextResponse.json(
      { ok: false, error: "Match full" },
      { status: 409 },
    );

  const { error: insErr } = await admin.from("gridlink_players").insert({
    match_id: match.id,
    user_id: userId,
    seat: 2,
  });
  if (insErr)
    return NextResponse.json(
      { ok: false, error: insErr.message },
      { status: 500 },
    );

  // inventory seat 2
  const invRows = PIECES.flatMap((p) =>
    Array.from({ length: p.copiesPerPlayer }, () => ({
      match_id: match.id,
      user_id: userId,
      piece_id: p.id,
      used: false,
    })),
  );
  const { error: iErr } = await admin
    .from("gridlink_inventory")
    .insert(invRows);
  if (iErr)
    return NextResponse.json(
      { ok: false, error: iErr.message },
      { status: 500 },
    );

  // attiva match e setta turno al seat 1 se era waiting
  if (match.status === "waiting") {
    await admin
      .from("gridlink_matches")
      .update({ status: "active", turn_user_id: null })
      .eq("id", match.id);

    // turn_user_id lo settiamo nello state (seat 1 di default) o direttamente qui:
    const { data: p1 } = await admin
      .from("gridlink_players")
      .select("user_id")
      .eq("match_id", match.id)
      .eq("seat", 1)
      .single();
    if (p1?.user_id) {
      await admin
        .from("gridlink_matches")
        .update({ turn_user_id: p1.user_id })
        .eq("id", match.id);
    }
  }

  return NextResponse.json({
    ok: true,
    matchId: match.id,
    alreadyJoined: false,
  });
}
