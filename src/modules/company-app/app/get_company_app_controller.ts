import { GetCompanyAppUseCase } from "./get_company_app_usecase";
import { CompanyAppOutputDTO } from "./get_company_app_viewmodel";

export class GetCompanyAppController {
  constructor(private readonly useCase: GetCompanyAppUseCase) {}

  async handle(input: {
    appId: string;
    companyId: string;
  }): Promise<CompanyAppOutputDTO> {
    return this.useCase.execute(input);
  }
}
