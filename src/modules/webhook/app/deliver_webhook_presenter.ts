import { Environments } from "@/shared/environments";
import { DeliverWebhookUseCase } from "./deliver_webhook_usecase";
import { Ed25519WebhookSigner } from "@/shared/infra/providers/Ed25519WebhookSigner";

export async function makeDeliverWebhookUseCase(): Promise<DeliverWebhookUseCase> {
  const envs = Environments.getEnvs();
  const signer = new Ed25519WebhookSigner(envs.WEBHOOK_SIGNING_PRIVATE_KEY);
  const requestRepo = await envs.getProofRequestRepository();
  return new DeliverWebhookUseCase(requestRepo, signer);
}
