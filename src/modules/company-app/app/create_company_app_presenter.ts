import { Environments } from "@/shared/environments";
import { CreateCompanyAppUseCase } from "./create_company_app_usecase";
import { CreateCompanyAppController } from "./create_company_app_controller";

export async function makeCreateCompanyAppController() {
  const envs = Environments.getEnvs();
  return new CreateCompanyAppController(
    new CreateCompanyAppUseCase(
      await envs.getCompanyAppRepository(),
      await envs.getApiKeyHasher()
    )
  );
}
