import { NextRequest, NextResponse } from "next/server";
import { makeGetProofSessionController } from "@/modules/proof-session/app/get_proof_session_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

type Params = { params: Promise<{ sessionToken: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  try {
    const { sessionToken } = await ctx.params;
    const controller = await makeGetProofSessionController();
    const result = await controller.handle({
      sessionToken,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
