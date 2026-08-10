import { Environments } from "@/shared/environments";
import { ListCompanyAppsUseCase } from "./list_company_apps_usecase";
import { ListCompanyAppsController } from "./list_company_apps_controller";

export async function makeListCompanyAppsController() {
  const repo = await Environments.getEnvs().getCompanyAppRepository();
  return new ListCompanyAppsController(new ListCompanyAppsUseCase(repo));
}
