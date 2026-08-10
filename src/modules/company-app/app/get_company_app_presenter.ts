import { Environments } from "@/shared/environments";
import { GetCompanyAppUseCase } from "./get_company_app_usecase";
import { GetCompanyAppController } from "./get_company_app_controller";

export async function makeGetCompanyAppController() {
  const repo = await Environments.getEnvs().getCompanyAppRepository();
  return new GetCompanyAppController(new GetCompanyAppUseCase(repo));
}
