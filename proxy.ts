import type { NextRequest, NextResponse } from "next/server";
import { middleware as sharedMiddleware } from "@/shared/middleware";

export function proxy(request: NextRequest): Promise<NextResponse> {
  return sharedMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
