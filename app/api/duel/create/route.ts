import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import crypto from "crypto";

function makeCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  // genera codice invito unico (retry pochi tentativi)
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = makeCode(6);
    const { data: existing } = await admin.from("matches").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
  }
  if (!code) return NextResponse.json({ ok: false, error: "Code generation failed" }, { status: 500 });

  const { data: match, error: mErr } = await admin
    .from("matches")
    .insert({ code, status: "waiting" })
    .select("id, code, status")
    .single();

  if (mErr || !match) return NextResponse.json({ ok: false, error: mErr?.message || "DB error" }, { status: 500 });

  const { error: pErr } = await admin
    .from("match_players")
    .insert({ match_id: match.id, user_id: userId, seat: 1 });

  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, matchId: match.id, code: match.code, status: match.status });
}
