import { NextRequest, NextResponse } from "next/server";
import { makeGetProofRequestController } from "@/modules/proof-request/factories/makeProofRequestControllers";
import { handleHttpError } from "@/shared/http/handleHttpError";
import { requireAuthenticatedUser } from "@/shared/http/requireAuthenticatedUser";

type Params = { params: Promise<{ requestId: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  try {
    const user = await requireAuthenticatedUser();
    const { requestId } = await ctx.params;
    const controller = await makeGetProofRequestController();
    const result = await controller.handle({
      requestId,
      companyId: user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
