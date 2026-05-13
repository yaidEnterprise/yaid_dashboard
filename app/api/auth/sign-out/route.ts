import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/shared/clients/supabase/server";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST() {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
