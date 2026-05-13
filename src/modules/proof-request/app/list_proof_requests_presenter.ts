import { Environments } from "@/shared/environments";
import { ListProofRequestsUseCase } from "./list_proof_requests_usecase";
import { ListProofRequestsController } from "./list_proof_requests_controller";

export async function makeListProofRequestsController() {
  const envs = Environments.getEnvs();
  return new ListProofRequestsController(
    new ListProofRequestsUseCase(
      await envs.getCompanyAppRepository(),
      await envs.getProofRequestRepository()
    )
  );
}
