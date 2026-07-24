import { Environments } from "@/shared/environments";
import { GetWebhookPublicKeyUseCase } from "./get_webhook_public_key_usecase";
import { GetWebhookPublicKeyController } from "./get_webhook_public_key_controller";

export async function makeGetWebhookPublicKeyController(): Promise<GetWebhookPublicKeyController> {
  const envs = Environments.getEnvs();
  return new GetWebhookPublicKeyController(
    new GetWebhookPublicKeyUseCase(envs.WEBHOOK_SIGNING_PRIVATE_KEY, envs.stage)
  );
}
