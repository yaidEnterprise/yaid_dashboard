import { NextResponse } from "next/server";
import { makeGetWebhookPublicKeyController } from "@/modules/webhook/app/get_webhook_public_key_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function GET() {
  try {
    const controller = await makeGetWebhookPublicKeyController();
    const result = await controller.handle();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
