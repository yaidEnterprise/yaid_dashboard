import { Environments } from "@/shared/environments";
import { CreateCompanyUseCase } from "./create_company_usecase";
import { CreateCompanyController } from "./create_company_controller";

export async function makeCreateCompanyController() {
  const repo = await Environments.getEnvs().getCompanyRepository();
  return new CreateCompanyController(new CreateCompanyUseCase(repo));
}
