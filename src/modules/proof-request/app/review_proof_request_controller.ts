import { ReviewProofRequestUseCase } from "./review_proof_request_usecase";
import { ReviewProofRequestOutputDTO, ReviewProofRequestSchema } from "./review_proof_request_viewmodel";

export class ReviewProofRequestController {
  constructor(private readonly useCase: ReviewProofRequestUseCase) {}

  async handle(input: {
    requestId: string;
    companyId: string;
    body: unknown;
  }): Promise<ReviewProofRequestOutputDTO> {
    const { decision } = ReviewProofRequestSchema.parse(input.body);
    return this.useCase.execute({
      requestId: input.requestId,
      companyId: input.companyId,
      decision,
    });
  }
}
