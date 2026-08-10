import { ListCompanyAppsUseCase } from "./list_company_apps_usecase";
import { CompanyAppOutputDTO } from "./list_company_apps_viewmodel";

export class ListCompanyAppsController {
  constructor(private readonly useCase: ListCompanyAppsUseCase) {}

  async handle(input: {
    companyId: string;
  }): Promise<{ items: CompanyAppOutputDTO[] }> {
    const items = await this.useCase.execute(input);
    return { items };
  }
}
