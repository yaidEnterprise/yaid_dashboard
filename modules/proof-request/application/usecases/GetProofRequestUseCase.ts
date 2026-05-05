import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError";
import { ProofRequestRepository } from "../../domain/repositories/ProofRequestRepository";
import { ProofRequestOutputDTO } from "../dtos/ProofRequestDTOs";

export class GetProofRequestUseCase {
  constructor(private readonly requestRepo: ProofRequestRepository) {}

  async execute(input: {
    requestId: string;
    companyId: string;
  }): Promise<ProofRequestOutputDTO> {
    const row = await this.requestRepo.findById(input.requestId);
    if (!row) throw new NotFoundError("Proof request not found", "PROOF_REQUEST_NOT_FOUND");
    if (row.app.companyId !== input.companyId) throw new ForbiddenError();

    return {
      id: row.request.id,
      appId: row.request.appId,
      appName: row.app.name,
      environment: row.app.environment,
      proofType: row.request.proofType,
      status: row.request.status,
      result: row.request.result,
      externalRef: row.request.externalRef,
      createdAt: row.request.createdAt.toISOString(),
      validatedAt: row.request.validatedAt?.toISOString() ?? null,
    };
  }
}

