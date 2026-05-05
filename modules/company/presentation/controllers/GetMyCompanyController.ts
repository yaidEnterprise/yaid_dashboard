import { GetMyCompanyUseCase } from "../../application/usecases/GetMyCompanyUseCase";
import { CompanyOutputDTO } from "../../application/dtos/CreateCompanyDTO";

export class GetMyCompanyController {
  constructor(private readonly useCase: GetMyCompanyUseCase) {}

  async handle(input: { authUserId: string }): Promise<CompanyOutputDTO> {
    return this.useCase.execute(input);
  }
}
