import { NextRequest, NextResponse } from "next/server";

export function withApiKeyAuth(request: NextRequest): NextResponse {
  const authHeader = request.headers.get("authorization");
  const xApiKey = request.headers.get("x-api-key");

  const hasBearer =
    authHeader !== null && authHeader.toLowerCase().startsWith("bearer ");
  const hasXApiKey = xApiKey !== null && xApiKey.length > 0;

  if (!hasBearer && !hasXApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}
