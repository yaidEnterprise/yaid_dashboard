import { UpdateMyCompanyUseCase } from "./update_my_company_usecase";
import {
  UpdateMyCompanyInputDTO,
  UpdateMyCompanyOutputDTO,
} from "./update_my_company_viewmodel";

export class UpdateMyCompanyController {
  constructor(private readonly useCase: UpdateMyCompanyUseCase) {}

  async handle(input: {
    authUserId: string;
    body: unknown;
  }): Promise<UpdateMyCompanyOutputDTO> {
    const dto = input.body as UpdateMyCompanyInputDTO;
    return this.useCase.execute({ authUserId: input.authUserId, dto });
  }
}
