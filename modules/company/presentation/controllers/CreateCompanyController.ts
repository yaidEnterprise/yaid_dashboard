import { CreateCompanyUseCase } from "../../application/usecases/CreateCompanyUseCase";
import {
  CompanyOutputDTO,
  CreateCompanySchema,
} from "../../application/dtos/CreateCompanyDTO";

type Input = {
  body: unknown;
  authUserId: string;
  email: string;
};

export class CreateCompanyController {
  constructor(private readonly useCase: CreateCompanyUseCase) {}

  async handle(input: Input): Promise<CompanyOutputDTO> {
    const parsed = CreateCompanySchema.parse(input.body);
    return this.useCase.execute({
      ...parsed,
      authUserId: input.authUserId,
      email: input.email,
    });
  }
}
