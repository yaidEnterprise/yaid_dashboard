import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/shared/clients/supabase/server";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST() {
  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
