import { Environments } from "@/shared/environments";
import { CancelProofSessionUseCase } from "./cancel_proof_session_usecase";
import { CancelProofSessionController } from "./cancel_proof_session_controller";
import { makeDeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_presenter";

export async function makeCancelProofSessionController() {
  const envs = Environments.getEnvs();
  const deliverWebhook = await makeDeliverWebhookUseCase();
  return new CancelProofSessionController(
    new CancelProofSessionUseCase(
      await envs.getProofSessionRepository(),
      await envs.getProofRequestRepository(),
      await envs.getApiKeyHasher(),
      deliverWebhook
    )
  );
}

