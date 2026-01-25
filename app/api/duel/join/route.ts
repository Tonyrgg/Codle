import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: match, error: mErr } = await admin
    .from("matches")
    .select("id, status")
    .eq("code", code)
    .single();

  if (mErr || !match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });

  // controlla se già dentro
  const { data: already } = await admin
    .from("match_players")
    .select("seat")
    .eq("match_id", match.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (already) {
    return NextResponse.json({ ok: true, matchId: match.id, status: match.status, alreadyJoined: true });
  }

  // verifica posti: seat 2 libero?
  const { data: seat2 } = await admin
    .from("match_players")
    .select("user_id")
    .eq("match_id", match.id)
    .eq("seat", 2)
    .maybeSingle();

  if (seat2) return NextResponse.json({ ok: false, error: "Match full" }, { status: 409 });

  const { error: insErr } = await admin
    .from("match_players")
    .insert({ match_id: match.id, user_id: userId, seat: 2 });

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  // porta a secrets (se era waiting)
  if (match.status === "waiting") {
    await admin.from("matches").update({ status: "secrets" }).eq("id", match.id);
  }

  return NextResponse.json({ ok: true, matchId: match.id, status: "secrets", alreadyJoined: false });
}
