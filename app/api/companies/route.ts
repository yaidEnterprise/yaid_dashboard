import { NextRequest, NextResponse } from "next/server";
import { makeCreateCompanyController } from "@/modules/company/app/create_company_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const authUserId = req.headers.get("x-company-id")!;
    const body = await req.json();
    const controller = await makeCreateCompanyController();
    const result = await controller.handle({
      body,
      authUserId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}
