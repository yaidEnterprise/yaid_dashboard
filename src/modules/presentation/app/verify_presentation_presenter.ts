import { Environments } from "@/shared/environments";
import { VerifyPresentationUseCase } from "./verify_presentation_usecase";
import { VerifyPresentationController } from "./verify_presentation_controller";

export async function makeVerifyPresentationController() {
  const envs = Environments.getEnvs();
  return new VerifyPresentationController(
    new VerifyPresentationUseCase(
      await envs.getProofSessionRepository(),
      await envs.getProofRequestRepository(),
      await envs.getApiKeyHasher(),
      await envs.getBlockchainClient(),
      envs.ISSUER_PRIVATE_KEY
    )
  );
}
