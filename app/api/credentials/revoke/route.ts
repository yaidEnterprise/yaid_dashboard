import { NextRequest, NextResponse } from "next/server";
import { makeRevokeCredentialController } from "@/modules/credential/app/revoke_credential_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";
import { AppError } from "@/shared/errors/AppError";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const holderDid = request.headers.get("x-holder-did");
    if (!holderDid) {
      return NextResponse.json({ error: "Missing auth headers" }, { status: 401 });
    }

    const body = await request.json();
    const controller = await makeRevokeCredentialController();
    const result = await controller.handle({ body, holderDid });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof AppError) {
      if (error.statusCode === 401 || error.statusCode === 502) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
    }
    return handleHttpError(error);
  }
}
