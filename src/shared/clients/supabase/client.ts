import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/shared/environments";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
