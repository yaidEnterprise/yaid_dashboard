import { Environments } from "@/shared/environments";
import { GetMyCompanyUseCase } from "./get_my_company_usecase";
import { GetMyCompanyController } from "./get_my_company_controller";

export async function makeGetMyCompanyController() {
  const repo = await Environments.getEnvs().getCompanyRepository();
  return new GetMyCompanyController(new GetMyCompanyUseCase(repo));
}
