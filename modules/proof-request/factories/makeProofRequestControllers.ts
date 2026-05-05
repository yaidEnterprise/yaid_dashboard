import { Environments } from "@/shared/config/env";
import { CreateProofRequestUseCase } from "../application/usecases/CreateProofRequestUseCase";
import { GetProofRequestUseCase } from "../application/usecases/GetProofRequestUseCase";
import { GetProofSessionByTokenUseCase } from "../application/usecases/GetProofSessionByTokenUseCase";
import { ListProofRequestsUseCase } from "../application/usecases/ListProofRequestsUseCase";
import {
  CreateProofRequestController,
  GetProofRequestController,
  GetProofSessionByTokenController,
  ListProofRequestsController,
} from "../presentation/controllers/ProofRequestControllers";

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

export async function makeListProofRequestsController() {
  const envs = Environments.getEnvs();
  return new ListProofRequestsController(
    new ListProofRequestsUseCase(
      await envs.getCompanyAppRepository(),
      await envs.getProofRequestRepository()
    )
  );
}

export async function makeGetProofRequestController() {
  const repo = await Environments.getEnvs().getProofRequestRepository();
  return new GetProofRequestController(new GetProofRequestUseCase(repo));
}

export async function makeGetProofSessionByTokenController() {
  const envs = Environments.getEnvs();
  return new GetProofSessionByTokenController(
    new GetProofSessionByTokenUseCase(
      await envs.getProofSessionRepository(),
      await envs.getApiKeyHasher()
    )
  );
}
