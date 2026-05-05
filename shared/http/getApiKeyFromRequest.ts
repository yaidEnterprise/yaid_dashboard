import { NextRequest } from "next/server";
import { UnauthorizedError } from "../errors/AppError";

export function getApiKeyFromRequest(req: NextRequest) {
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) return xApiKey;

  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  throw new UnauthorizedError("API key is required");
}

