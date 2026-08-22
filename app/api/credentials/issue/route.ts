import { NextRequest, NextResponse } from "next/server";
import { makeIssueCredentialController } from "@/modules/credential/app/issue_credential_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";
import { AppError } from "@/shared/errors/AppError";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const holderDid = request.headers.get("x-holder-did");
    if (!holderDid) {
      return NextResponse.json({ error: "Missing auth headers" }, { status: 401 });
    }

    const body = await request.json();
    const controller = await makeIssueCredentialController();
    
    const vcJwt = await controller.handle({
      body,
      holderDid,
    });

    return new NextResponse(vcJwt, {
      status: 201,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      if (
        error.statusCode === 401 ||
        error.statusCode === 422 ||
        error.statusCode === 502
      ) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
    }
    return handleHttpError(error);
  }
}
