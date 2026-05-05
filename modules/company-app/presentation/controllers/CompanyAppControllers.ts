import { CreateCompanyAppUseCase } from "../../application/usecases/CreateCompanyAppUseCase";
import { GetCompanyAppUseCase } from "../../application/usecases/GetCompanyAppUseCase";
import { ListCompanyAppsUseCase } from "../../application/usecases/ListCompanyAppsUseCase";
import { UpdateCompanyAppUseCase } from "../../application/usecases/UpdateCompanyAppUseCase";
import {
  CompanyAppOutputDTO,
  CompanyAppWithApiKeyDTO,
  CreateCompanyAppSchema,
  UpdateCompanyAppSchema,
} from "../../application/dtos/CompanyAppDTOs";

export class CreateCompanyAppController {
  constructor(private readonly useCase: CreateCompanyAppUseCase) {}

  async handle(input: {
    body: unknown;
    companyId: string;
  }): Promise<CompanyAppWithApiKeyDTO> {
    const parsed = CreateCompanyAppSchema.parse(input.body);
    return this.useCase.execute({ ...parsed, companyId: input.companyId });
  }
}

export class ListCompanyAppsController {
  constructor(private readonly useCase: ListCompanyAppsUseCase) {}

  async handle(input: {
    companyId: string;
  }): Promise<{ items: CompanyAppOutputDTO[] }> {
    const items = await this.useCase.execute(input);
    return { items };
  }
}

export class GetCompanyAppController {
  constructor(private readonly useCase: GetCompanyAppUseCase) {}

  async handle(input: {
    appId: string;
    companyId: string;
  }): Promise<CompanyAppOutputDTO> {
    return this.useCase.execute(input);
  }
}

export class UpdateCompanyAppController {
  constructor(private readonly useCase: UpdateCompanyAppUseCase) {}

  async handle(input: {
    appId: string;
    companyId: string;
    body: unknown;
  }): Promise<CompanyAppOutputDTO> {
    const parsed = UpdateCompanyAppSchema.parse(input.body);
    return this.useCase.execute({
      ...parsed,
      appId: input.appId,
      companyId: input.companyId,
    });
  }
}
