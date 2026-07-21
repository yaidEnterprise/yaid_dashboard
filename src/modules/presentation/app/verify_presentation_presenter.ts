import { Environments } from "@/shared/environments";
import { VerifyPresentationUseCase } from "./verify_presentation_usecase";
import { VerifyPresentationController } from "./verify_presentation_controller";
import { makeDeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_presenter";

export async function makeVerifyPresentationController() {
  const envs = Environments.getEnvs();
  const deliverWebhook = await makeDeliverWebhookUseCase();
  return new VerifyPresentationController(
    new VerifyPresentationUseCase(
      await envs.getProofSessionRepository(),
      await envs.getProofRequestRepository(),
      await envs.getApiKeyHasher(),
      await envs.getBlockchainClient(),
      envs.ISSUER_PRIVATE_KEY,
      deliverWebhook
    )
  );
}
