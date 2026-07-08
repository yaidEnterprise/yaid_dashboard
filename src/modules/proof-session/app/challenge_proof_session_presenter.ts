import { Environments } from "@/shared/environments";
import { ChallengeProofSessionUseCase } from "./challenge_proof_session_usecase";
import { ChallengeProofSessionController } from "./challenge_proof_session_controller";

export async function makeChallengeProofSessionController() {
  const envs = Environments.getEnvs();
  return new ChallengeProofSessionController(
    new ChallengeProofSessionUseCase(
      await envs.getProofSessionRepository(),
      await envs.getProofRequestRepository(),
      await envs.getApiKeyHasher()
    )
  );
}
