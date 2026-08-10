import { NotFoundError } from "@/shared/errors/AppError";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofRequestOutputDTO } from "./get_proof_request_viewmodel";

export class GetProofRequestUseCase {
  constructor(private readonly requestRepo: ProofRequestRepository) {}

  async execute(input: {
    requestId: string;
    companyId: string;
  }): Promise<ProofRequestOutputDTO> {
    const row = await this.requestRepo.findById(input.requestId);
    // Both "not found" and "belongs to another company" must return 404 —
    // never 403 — to avoid enumeration of valid request IDs (NFR6).
    if (!row || row.app.companyId !== input.companyId) {
      throw new NotFoundError("Proof request not found", "PROOF_REQUEST_NOT_FOUND");
    }

    return {
      id: row.request.id,
      appId: row.request.appId,
      appName: row.app.name,
      environment: row.app.environment,
      proofType: row.request.proofType,
      status: row.request.status,
      result: row.request.result,
      externalRef: row.request.externalRef,
      externalReference: row.request.externalRef,
      createdAt: row.request.createdAt.toISOString(),
      validatedAt: row.request.validatedAt?.toISOString() ?? null,
      updatedAt: row.request.validatedAt?.toISOString() ?? null,
    };
  }
}
