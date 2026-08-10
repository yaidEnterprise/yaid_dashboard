import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

type SessionAuthOpts = {
  redirectOnFail: string | null;
};

export function withSessionAuth(
  request: NextRequest,
  sessionResponse: NextResponse,
  user: User | null,
  opts: SessionAuthOpts
): NextResponse {
  if (!user) {
    if (opts.redirectOnFail) {
      const url = new URL(opts.redirectOnFail, request.url);
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-company-id", user.id);

  const modifiedResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Preserve Supabase session cookie updates
  sessionResponse.cookies.getAll().forEach((cookie) => {
    modifiedResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return modifiedResponse;
}
