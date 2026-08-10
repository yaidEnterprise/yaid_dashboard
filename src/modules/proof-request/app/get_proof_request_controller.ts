import { GetProofRequestUseCase } from "./get_proof_request_usecase";
import { ProofRequestOutputDTO } from "./get_proof_request_viewmodel";

export class GetProofRequestController {
  constructor(private readonly useCase: GetProofRequestUseCase) {}

  async handle(input: {
    requestId: string;
    companyId: string;
  }): Promise<ProofRequestOutputDTO> {
    return this.useCase.execute(input);
  }
}
