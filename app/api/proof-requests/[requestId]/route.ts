import { NextRequest, NextResponse } from "next/server";
import { makeGetProofRequestController } from "@/modules/proof-request/app/get_proof_request_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

type Params = { params: Promise<{ requestId: string }> };

export async function GET(req: NextRequest, ctx: Params) {
  try {
    const companyId = req.headers.get("x-company-id")!;
    const { requestId } = await ctx.params;
    const controller = await makeGetProofRequestController();
    const result = await controller.handle({
      requestId,
      companyId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
