import { GetMyCompanyUseCase } from "./get_my_company_usecase";
import { CompanyOutputDTO } from "./get_my_company_viewmodel";

export class GetMyCompanyController {
  constructor(private readonly useCase: GetMyCompanyUseCase) {}

  async handle(input: { authUserId: string }): Promise<CompanyOutputDTO> {
    return this.useCase.execute(input);
  }
}
