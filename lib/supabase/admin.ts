import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/shared/config/env";

// Untyped client. Repositories cast rows via mappers, so we don't need
// generated Database types yet. Switch to a typed Database<…> generic when
// `supabase gen types` is wired in.
let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;

  cached = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return cached;
}
