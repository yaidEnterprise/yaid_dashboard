import { Environments } from "@/shared/environments";
import { CancelProofSessionUseCase } from "./cancel_proof_session_usecase";
import { CancelProofSessionController } from "./cancel_proof_session_controller";

export async function makeCancelProofSessionController() {
  const envs = Environments.getEnvs();
  return new CancelProofSessionController(
    new CancelProofSessionUseCase(
      await envs.getProofSessionRepository(),
      await envs.getProofRequestRepository(),
      await envs.getApiKeyHasher()
    )
  );
}
