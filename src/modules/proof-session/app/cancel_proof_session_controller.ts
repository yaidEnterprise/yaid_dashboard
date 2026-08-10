import { CancelProofSessionUseCase } from "./cancel_proof_session_usecase";
import { CancelProofSessionResponseDTO } from "./cancel_proof_session_viewmodel";

export class CancelProofSessionController {
  constructor(private readonly useCase: CancelProofSessionUseCase) {}

  async handle(input: { sessionToken: string }): Promise<CancelProofSessionResponseDTO> {
    return this.useCase.execute(input);
  }
}
