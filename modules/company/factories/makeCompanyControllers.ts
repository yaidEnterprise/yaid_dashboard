import { Environments } from "@/shared/config/env";
import { CreateCompanyUseCase } from "../application/usecases/CreateCompanyUseCase";
import { GetMyCompanyUseCase } from "../application/usecases/GetMyCompanyUseCase";
import { CreateCompanyController } from "../presentation/controllers/CreateCompanyController";
import { GetMyCompanyController } from "../presentation/controllers/GetMyCompanyController";

export async function makeCreateCompanyController() {
  const repo = await Environments.getEnvs().getCompanyRepository();
  return new CreateCompanyController(new CreateCompanyUseCase(repo));
}

export async function makeGetMyCompanyController() {
  const repo = await Environments.getEnvs().getCompanyRepository();
  return new GetMyCompanyController(new GetMyCompanyUseCase(repo));
}
