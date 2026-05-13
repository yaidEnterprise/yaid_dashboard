import { Environments } from "@/shared/environments";
import { GetProofSessionUseCase } from "./get_proof_session_usecase";
import { GetProofSessionController } from "./get_proof_session_controller";

export async function makeGetProofSessionController() {
  const envs = Environments.getEnvs();
  return new GetProofSessionController(
    new GetProofSessionUseCase(
      await envs.getProofSessionRepository(),
      await envs.getApiKeyHasher()
    )
  );
}
