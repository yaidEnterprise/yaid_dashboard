import { NextRequest, NextResponse } from "next/server";
import { makeCreateCompanyController } from "@/modules/company/factories/makeCompanyControllers";
import { requireAuthenticatedUser } from "@/shared/http/requireAuthenticatedUser";
import { handleHttpError } from "@/shared/http/handleHttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user.email) throw new UnauthorizedError("User has no email");

    const body = await req.json();
    const controller = await makeCreateCompanyController();
    const result = await controller.handle({
      body,
      authUserId: user.id,
      email: user.email,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}
