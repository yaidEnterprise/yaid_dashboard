import { Environments } from "@/shared/environments";
import { CreateProofRequestUseCase } from "./create_proof_request_usecase";
import { CreateProofRequestController } from "./create_proof_request_controller";

export async function makeCreateProofRequestController() {
  const envs = Environments.getEnvs();
  return new CreateProofRequestController(
    new CreateProofRequestUseCase(
      await envs.getCompanyAppRepository(),
      await envs.getProofRequestRepository(),
      await envs.getProofSessionRepository(),
      await envs.getApiKeyHasher()
    )
  );
}
