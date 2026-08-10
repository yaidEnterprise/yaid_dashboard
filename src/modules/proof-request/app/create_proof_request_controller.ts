import { CreateProofRequestUseCase } from "./create_proof_request_usecase";
import { CreatedProofRequestOutputDTO, CreateProofRequestSchema } from "./create_proof_request_viewmodel";

export class CreateProofRequestController {
  constructor(private readonly useCase: CreateProofRequestUseCase) {}

  async handle(input: {
    body: unknown;
    apiKey?: string;
    companyId?: string;
  }): Promise<CreatedProofRequestOutputDTO> {
    const body = CreateProofRequestSchema.parse(input.body);
    return this.useCase.execute({
      apiKey: input.apiKey,
      companyId: input.companyId,
      body,
    });
  }
}
