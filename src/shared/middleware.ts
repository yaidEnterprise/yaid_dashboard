import { NextRequest, NextResponse } from "next/server";
import { updateSupabaseSession } from "@/shared/clients/supabase/proxy";
import { withSessionAuth } from "@/shared/middlewares/withSessionAuth";
import { withApiKeyAuth } from "@/shared/middlewares/withApiKeyAuth";
import { withDIDAuth } from "@/shared/middlewares/withDIDAuth";

function isDashboardPage(pathname: string): boolean {
  const dashboardPaths = ["/dashboard", "/apps", "/proof-requests", "/settings"];
  return dashboardPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isPublicAuthPage(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname.startsWith("/v/")
  );
}

function isSessionAuthApiRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/company-apps")) return true;
  if (pathname.startsWith("/api/companies")) return true;
  if (pathname.startsWith("/api/auth/sign-out")) return true;
  if (pathname.startsWith("/api/proof-requests") && method === "GET")
    return true;
  if (/^\/api\/proof-requests\/[^/]+\/review\/?$/.test(pathname) && method === "POST")
    return true;
  return false;
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  if (pathname === "/api/health" && method === "GET") return true;
  if (/^\/api\/proof-sessions\/[^/]+$/.test(pathname) && method === "GET")
    return true;
  if (pathname === "/api/webhook-public-key" && method === "GET") return true;
  if (pathname === "/api/auth/sign-up" && method === "POST") return true;
  return false;
}

function isDIDAuthRoute(pathname: string): boolean {
  if (/^\/api\/proof-sessions\/[^/]+\/challenge$/.test(pathname)) return true;
  if (/^\/api\/proof-sessions\/[^/]+\/cancel$/.test(pathname)) return true;
  if (pathname.startsWith("/api/presentations/verify")) return true;
  if (pathname.startsWith("/api/credentials/")) return true;
  return false;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Always refresh Supabase session cookies on every request
  const { response: sessionResponse, user } =
    await updateSupabaseSession(request);

  // 1. Public auth pages — redirect authenticated users away from sign-in
  if (isPublicAuthPage(pathname)) {
    if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return sessionResponse;
  }

  // 2. Root — authenticated users go to the dashboard, visitors pass through
  if (pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return sessionResponse;
  }

  // 3. Dashboard pages — redirect to sign-in if not authenticated
  if (isDashboardPage(pathname)) {
    return withSessionAuth(request, sessionResponse, user, {
      redirectOnFail: "/sign-in",
    });
  }

  // 4. POST /api/proof-requests — API key or session auth
  if (pathname === "/api/proof-requests" && method === "POST") {
    const hasApiKeyHeader =
      Boolean(request.headers.get("x-api-key")) ||
      request.headers.get("authorization")?.toLowerCase().startsWith("bearer ") === true;

    if (hasApiKeyHeader) {
      return withApiKeyAuth(request);
    }

    return withSessionAuth(request, sessionResponse, user, {
      redirectOnFail: null,
    });
  }

  // 5. DID auth routes — DID signature validation (Epic 5)
  if (isDIDAuthRoute(pathname)) {
    return await withDIDAuth(request);
  }

  // 6. Session-auth API routes — require authenticated user
  if (isSessionAuthApiRoute(pathname, method)) {
    return withSessionAuth(request, sessionResponse, user, {
      redirectOnFail: null,
    });
  }

  // 7. Explicit public API routes (no auth)
  if (isPublicApiRoute(pathname, method)) {
    return sessionResponse;
  }

  // 8. Everything else — pass through
  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
