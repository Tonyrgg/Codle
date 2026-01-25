import { NextResponse } from "next/server";
import { requireUserId } from "@/app/lib/supabase/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

type Mark = "green" | "yellow" | "gray";

function score(secret: string, guess: string) {
  const L = secret.length;

  const marks: Mark[] = Array(L).fill("gray");
  const secretArr = secret.split("");
  const guessArr = guess.split("");

  // bulls
  const usedSecret = Array(L).fill(false);
  const usedGuess = Array(L).fill(false);

  let bulls = 0;
  for (let i = 0; i < L; i++) {
    if (guessArr[i] === secretArr[i]) {
      bulls++;
      marks[i] = "green";
      usedSecret[i] = true;
      usedGuess[i] = true;
    }
  }

  // cows (count duplicates correctly)
  let cows = 0;
  for (let i = 0; i < L; i++) {
    if (usedGuess[i]) continue;
    for (let j = 0; j < L; j++) {
      if (usedSecret[j]) continue;
      if (guessArr[i] === secretArr[j]) {
        cows++;
        marks[i] = "yellow";
        usedSecret[j] = true;
        usedGuess[i] = true;
        break;
      }
    }
  }

  return { bulls, cows, marks };
}

function validGuess(s: unknown) {
  return typeof s === "string" && /^[0-9]{4}$/.test(s);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { matchId, guess } = await req.json().catch(() => ({}));
  if (!matchId || typeof matchId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing matchId" }, { status: 400 });
  }
  if (!validGuess(guess)) {
    return NextResponse.json({ ok: false, error: "Guess must be 4 digits" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // match state
  const { data: match } = await admin
    .from("matches")
    .select("id, status, turn_user_id, winner_user_id")
    .eq("id", matchId)
    .single();

  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
  if (match.status !== "active") return NextResponse.json({ ok: false, error: "Match not active" }, { status: 409 });
  if (match.winner_user_id) return NextResponse.json({ ok: false, error: "Match finished" }, { status: 409 });

  if (match.turn_user_id !== userId) {
    return NextResponse.json({ ok: false, error: "Not your turn" }, { status: 409 });
  }

  // trova avversario
  const { data: players } = await admin
    .from("match_players")
    .select("user_id")
    .eq("match_id", matchId);

  const opponent = players?.find((p) => p.user_id !== userId)?.user_id;
  if (!opponent) return NextResponse.json({ ok: false, error: "Opponent missing" }, { status: 409 });

  // leggi segreto avversario (server)
  const { data: oppSecretRow } = await admin
    .from("match_secrets")
    .select("secret")
    .eq("match_id", matchId)
    .eq("user_id", opponent)
    .single();

  if (!oppSecretRow?.secret) return NextResponse.json({ ok: false, error: "Opponent secret missing" }, { status: 409 });

  const { bulls, cows, marks } = score(oppSecretRow.secret, guess);

  // inserisci move
  const { error: mvErr } = await admin.from("moves").insert({
    match_id: matchId,
    by_user_id: userId,
    guess,
    bulls,
    cows,
    marks,
  });

  if (mvErr) return NextResponse.json({ ok: false, error: mvErr.message }, { status: 500 });

  const win = bulls === 4;

  if (win) {
    await admin
      .from("matches")
      .update({ status: "finished", winner_user_id: userId })
      .eq("id", matchId);

    return NextResponse.json({ ok: true, bulls, cows, marks, win: true });
  }

  // passa turno all'avversario
  await admin.from("matches").update({ turn_user_id: opponent }).eq("id", matchId);

  return NextResponse.json({ ok: true, bulls, cows, marks, win: false, nextTurnUserId: opponent });
}
