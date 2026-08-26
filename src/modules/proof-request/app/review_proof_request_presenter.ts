import { Environments } from "@/shared/environments";
import { makeDeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_presenter";
import { ReviewProofRequestUseCase } from "./review_proof_request_usecase";
import { ReviewProofRequestController } from "./review_proof_request_controller";

export async function makeReviewProofRequestController() {
  const envs = Environments.getEnvs();
  const requestRepo = await envs.getProofRequestRepository();
  const deliverWebhook = await makeDeliverWebhookUseCase();
  return new ReviewProofRequestController(
    new ReviewProofRequestUseCase(requestRepo, deliverWebhook)
  );
}
