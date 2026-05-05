import { NextRequest, NextResponse } from "next/server";
import {
  makeGetCompanyAppController,
  makeUpdateCompanyAppController,
} from "@/modules/company-app/factories/makeCompanyAppControllers";
import { requireAuthenticatedUser } from "@/shared/http/requireAuthenticatedUser";
import { handleHttpError } from "@/shared/http/handleHttpError";

type Params = { params: Promise<{ appId: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await ctx.params;
    const controller = await makeGetCompanyAppController();
    const result = await controller.handle({
      appId,
      companyId: user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await ctx.params;
    const body = await req.json();
    const controller = await makeUpdateCompanyAppController();
    const result = await controller.handle({
      appId,
      companyId: user.id,
      body,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
