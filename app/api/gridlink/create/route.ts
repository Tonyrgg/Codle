// /api/gridlink/create/route.ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { PIECES } from "@/app/lib/gridlink/pieces";

function makeCode(n = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < n; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = supabaseAdmin();

  // crea match
  let code = makeCode();
  for (let i = 0; i < 4; i++) {
    const { data: exists } = await admin
      .from("gridlink_matches")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!exists) break;
    code = makeCode();
  }

  const { data: match, error: mErr } = await admin
    .from("gridlink_matches")
    .insert({
      code,
      status: "waiting",
      turn_user_id: null,
      winner_user_id: null,
    })
    .select("id, code, status")
    .single();

  if (mErr || !match) {
    return NextResponse.json(
      { ok: false, error: mErr?.message || "Create failed" },
      { status: 500 },
    );
  }

  // seat 1
  const { error: pErr } = await admin.from("gridlink_players").insert({
    match_id: match.id,
    user_id: userId,
    seat: 1,
  });
  if (pErr) {
    return NextResponse.json(
      { ok: false, error: pErr.message },
      { status: 500 },
    );
  }

  // inventory per player
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
  if (iErr) {
    return NextResponse.json(
      { ok: false, error: iErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, matchId: match.id, code: match.code });
}
