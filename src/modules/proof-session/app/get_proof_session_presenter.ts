import { Environments } from "@/shared/environments";
import { GetProofSessionUseCase } from "./get_proof_session_usecase";
import { GetProofSessionController } from "./get_proof_session_controller";
import { makeDeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_presenter";

export async function makeGetProofSessionController() {
  const envs = Environments.getEnvs();
  const deliverWebhook = await makeDeliverWebhookUseCase();
  return new GetProofSessionController(
    new GetProofSessionUseCase(
      await envs.getProofSessionRepository(),
      await envs.getApiKeyHasher(),
      await envs.getProofRequestRepository(),
      deliverWebhook
    )
  );
}

