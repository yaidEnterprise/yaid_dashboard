import { NextRequest, NextResponse } from "next/server";
import { makeCreateProofRequestController } from "@/modules/proof-request/app/create_proof_request_presenter";
import { makeListProofRequestsController } from "@/modules/proof-request/app/list_proof_requests_presenter";
import { getApiKeyFromRequest } from "@/shared/http/getApiKeyFromRequest";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const companyId = req.headers.get("x-company-id") ?? undefined;
    let apiKey: string | undefined;

    try {
      apiKey = getApiKeyFromRequest(req);
    } catch {
      // Allow the session-auth dashboard flow to submit without an API key.
    }

    const body = await req.json();
    const controller = await makeCreateProofRequestController();
    const result = await controller.handle({
      apiKey,
      companyId,
      body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const companyId = req.headers.get("x-company-id")!;
    const controller = await makeListProofRequestsController();
    const result = await controller.handle({
      companyId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
