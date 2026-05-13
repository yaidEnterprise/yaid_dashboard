import { NextRequest, NextResponse } from "next/server";
import { makeCreateCompanyAppController } from "@/modules/company-app/app/create_company_app_presenter";
import { makeListCompanyAppsController } from "@/modules/company-app/app/list_company_apps_presenter";
import { requireAuthenticatedUser } from "@/shared/http/requireAuthenticatedUser";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await req.json();
    const controller = await makeCreateCompanyAppController();
    const result = await controller.handle({
      body,
      companyId: user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const controller = await makeListCompanyAppsController();
    const result = await controller.handle({
      companyId: user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
