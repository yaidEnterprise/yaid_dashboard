import { Environments } from "@/shared/environments";
import { GetProofRequestUseCase } from "./get_proof_request_usecase";
import { GetProofRequestController } from "./get_proof_request_controller";

export async function makeGetProofRequestController() {
  const repo = await Environments.getEnvs().getProofRequestRepository();
  return new GetProofRequestController(new GetProofRequestUseCase(repo));
}
