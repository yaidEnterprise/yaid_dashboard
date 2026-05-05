import { Environments } from "@/shared/config/env";
import { CreateCompanyAppUseCase } from "../application/usecases/CreateCompanyAppUseCase";
import { GetCompanyAppUseCase } from "../application/usecases/GetCompanyAppUseCase";
import { ListCompanyAppsUseCase } from "../application/usecases/ListCompanyAppsUseCase";
import { UpdateCompanyAppUseCase } from "../application/usecases/UpdateCompanyAppUseCase";
import {
  CreateCompanyAppController,
  GetCompanyAppController,
  ListCompanyAppsController,
  UpdateCompanyAppController,
} from "../presentation/controllers/CompanyAppControllers";

export async function makeCreateCompanyAppController() {
  const envs = Environments.getEnvs();
  return new CreateCompanyAppController(
    new CreateCompanyAppUseCase(
      await envs.getCompanyAppRepository(),
      await envs.getApiKeyHasher()
    )
  );
}

export async function makeListCompanyAppsController() {
  const repo = await Environments.getEnvs().getCompanyAppRepository();
  return new ListCompanyAppsController(new ListCompanyAppsUseCase(repo));
}

export async function makeGetCompanyAppController() {
  const repo = await Environments.getEnvs().getCompanyAppRepository();
  return new GetCompanyAppController(new GetCompanyAppUseCase(repo));
}

export async function makeUpdateCompanyAppController() {
  const repo = await Environments.getEnvs().getCompanyAppRepository();
  return new UpdateCompanyAppController(new UpdateCompanyAppUseCase(repo));
}
