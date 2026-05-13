import { NextRequest, NextResponse } from "next/server";
import { makeGetCompanyAppController } from "@/modules/company-app/app/get_company_app_presenter";
import { makeUpdateCompanyAppController } from "@/modules/company-app/app/update_company_app_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

type Params = { params: Promise<{ appId: string }> };

export async function GET(req: NextRequest, ctx: Params) {
  try {
    const companyId = req.headers.get("x-company-id")!;
    const { appId } = await ctx.params;
    const controller = await makeGetCompanyAppController();
    const result = await controller.handle({
      appId,
      companyId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const companyId = req.headers.get("x-company-id")!;
    const { appId } = await ctx.params;
    const body = await req.json();
    const controller = await makeUpdateCompanyAppController();
    const result = await controller.handle({
      appId,
      companyId,
      body,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
