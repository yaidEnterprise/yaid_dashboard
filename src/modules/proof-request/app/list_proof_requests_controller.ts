import { ListProofRequestsUseCase } from "./list_proof_requests_usecase";
import { ProofRequestOutputDTO } from "./list_proof_requests_viewmodel";

export class ListProofRequestsController {
  constructor(private readonly useCase: ListProofRequestsUseCase) {}

  async handle(input: {
    companyId: string;
  }): Promise<{ items: ProofRequestOutputDTO[] }> {
    return { items: await this.useCase.execute(input) };
  }
}
