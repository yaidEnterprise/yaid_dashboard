import { NextRequest, NextResponse } from "next/server";
import { makeReviewProofRequestController } from "@/modules/proof-request/app/review_proof_request_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

type Params = { params: Promise<{ requestId: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  try {
    const companyId = req.headers.get("x-company-id")!;
    const { requestId } = await ctx.params;
    const body = await req.json();
    const controller = await makeReviewProofRequestController();
    const result = await controller.handle({
      requestId,
      companyId,
      body,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
