import { NextResponse } from "next/server";
import { makeGetMyCompanyController } from "@/modules/company/factories/makeCompanyControllers";
import { requireAuthenticatedUser } from "@/shared/http/requireAuthenticatedUser";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const controller = await makeGetMyCompanyController();
    const result = await controller.handle({
      authUserId: user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
