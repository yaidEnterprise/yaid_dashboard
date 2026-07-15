import { NextRequest, NextResponse } from "next/server";
import { makeVerifyPresentationController } from "@/modules/presentation/app/verify_presentation_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const holderDid = req.headers.get("x-holder-did");
    if (!holderDid) {
      return NextResponse.json({ error: "Missing holder DID" }, { status: 401 });
    }

    const body = await req.json();
    const controller = await makeVerifyPresentationController();
    const result = await controller.handle({ body, holderDid });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
