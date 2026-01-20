import { createSupabaseRouteClient } from "@/app/lib/supabase/route";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteClient(request);

  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) {
    return applyCookies(NextResponse.json({ ok: true, alreadyHadSession: true }));
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    return applyCookies(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
  }

  return applyCookies(NextResponse.json({ ok: true, alreadyHadSession: false }));
}
