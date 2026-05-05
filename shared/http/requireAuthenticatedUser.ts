import { getSupabaseServerClient } from "@/lib/supabase/server";
import { UnauthorizedError } from "@/shared/errors/AppError";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError();
  }

  return { id: user.id, email: user.email ?? null };
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}
