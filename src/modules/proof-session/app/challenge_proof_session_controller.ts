import { ChallengeProofSessionUseCase } from "./challenge_proof_session_usecase";
import { ChallengeProofSessionOutputDTO } from "./challenge_proof_session_viewmodel";

export class ChallengeProofSessionController {
  constructor(private readonly useCase: ChallengeProofSessionUseCase) {}

  async handle(input: { sessionToken: string }): Promise<ChallengeProofSessionOutputDTO> {
    return this.useCase.execute(input);
  }
}
