import { GetProofSessionUseCase } from "./get_proof_session_usecase";
import { ProofSessionOutputDTO } from "./get_proof_session_viewmodel";

export class GetProofSessionController {
  constructor(private readonly useCase: GetProofSessionUseCase) {}

  async handle(input: { sessionToken: string }): Promise<ProofSessionOutputDTO> {
    return this.useCase.execute(input);
  }
}
