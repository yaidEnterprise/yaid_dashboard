import { NextRequest, NextResponse } from "next/server";
import { makeGetMyCompanyController } from "@/modules/company/app/get_my_company_presenter";
import { makeUpdateMyCompanyController } from "@/modules/company/app/update_my_company_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function GET(req: NextRequest) {
  try {
    const authUserId = req.headers.get("x-company-id")!;
    const controller = await makeGetMyCompanyController();
    const result = await controller.handle({
      authUserId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUserId = req.headers.get("x-company-id")!;
    const body = await req.json();
    const controller = await makeUpdateMyCompanyController();
    const result = await controller.handle({ authUserId, body });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}

