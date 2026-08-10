import { UpdateCompanyAppUseCase } from "./update_company_app_usecase";
import { CompanyAppOutputDTO, UpdateCompanyAppSchema } from "./update_company_app_viewmodel";

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
