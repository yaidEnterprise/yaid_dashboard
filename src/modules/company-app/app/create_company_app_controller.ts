import { CreateCompanyAppUseCase } from "./create_company_app_usecase";
import { CompanyAppWithApiKeyDTO, CreateCompanyAppSchema } from "./create_company_app_viewmodel";

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
