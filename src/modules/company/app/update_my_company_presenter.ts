import { Environments } from "@/shared/environments";
import { UpdateMyCompanyUseCase } from "./update_my_company_usecase";
import { UpdateMyCompanyController } from "./update_my_company_controller";

export async function makeUpdateMyCompanyController() {
  const repo = await Environments.getEnvs().getCompanyRepository();
  return new UpdateMyCompanyController(new UpdateMyCompanyUseCase(repo));
}
