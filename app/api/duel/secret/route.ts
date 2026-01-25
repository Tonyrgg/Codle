import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import crypto from "crypto";

function validSecret(s: unknown) {
  return typeof s === "string" && /^[0-9]{4}$/.test(s);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { matchId, secret } = await req.json().catch(() => ({}));
  if (!matchId || typeof matchId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing matchId" }, { status: 400 });
  }
  if (!validSecret(secret)) {
    return NextResponse.json({ ok: false, error: "Secret must be 4 digits" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // verifica che sia player del match
  const { data: mp } = await admin
    .from("match_players")
    .select("seat")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!mp) return NextResponse.json({ ok: false, error: "Not in match" }, { status: 403 });

  // upsert secret
  const { error: sErr } = await admin
    .from("match_secrets")
    .upsert({ match_id: matchId, user_id: userId, secret }, { onConflict: "match_id,user_id" });

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  // controlla se entrambi hanno secret
  const { data: secrets } = await admin
    .from("match_secrets")
    .select("user_id")
    .eq("match_id", matchId);

  const { data: players } = await admin
    .from("match_players")
    .select("user_id, seat")
    .eq("match_id", matchId);

  const haveAll = (players?.length ?? 0) === 2 && (secrets?.length ?? 0) === 2;

  if (haveAll) {
    // decide turno iniziale: seat 1 o random
    const seat1 = players!.find((p) => p.seat === 1)!.user_id;
    const seat2 = players!.find((p) => p.seat === 2)!.user_id;
    const first = crypto.randomInt(0, 2) === 0 ? seat1 : seat2;

    await admin
      .from("matches")
      .update({ status: "active", turn_user_id: first })
      .eq("id", matchId);

    return NextResponse.json({ ok: true, status: "active", turnUserId: first });
  }

  // altrimenti resta in secrets
  await admin.from("matches").update({ status: "secrets" }).eq("id", matchId);

  return NextResponse.json({ ok: true, status: "secrets" });
}
