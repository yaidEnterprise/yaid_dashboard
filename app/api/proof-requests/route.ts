import { NextRequest, NextResponse } from "next/server";
import {
  makeCreateProofRequestController,
  makeListProofRequestsController,
} from "@/modules/proof-request/factories/makeProofRequestControllers";
import { getApiKeyFromRequest } from "@/shared/http/getApiKeyFromRequest";
import { handleHttpError } from "@/shared/http/handleHttpError";
import { requireAuthenticatedUser } from "@/shared/http/requireAuthenticatedUser";

export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKeyFromRequest(req);
    const body = await req.json();
    const controller = await makeCreateProofRequestController();
    const result = await controller.handle({
      apiKey,
      body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const controller = await makeListProofRequestsController();
    const result = await controller.handle({
      companyId: user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
