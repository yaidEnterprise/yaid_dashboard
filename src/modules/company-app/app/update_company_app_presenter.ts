import { Environments } from "@/shared/environments";
import { UpdateCompanyAppUseCase } from "./update_company_app_usecase";
import { UpdateCompanyAppController } from "./update_company_app_controller";

export async function makeUpdateCompanyAppController() {
  const repo = await Environments.getEnvs().getCompanyAppRepository();
  return new UpdateCompanyAppController(new UpdateCompanyAppUseCase(repo));
}
