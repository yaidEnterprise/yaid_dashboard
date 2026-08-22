import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "@/shared/errors/AppError";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import type { DeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_usecase";
import { ReviewProofRequestOutputDTO } from "./review_proof_request_viewmodel";

const TERMINAL_STATUSES = new Set<ProofRequestStatus>([
  ProofRequestStatus.APPROVED,
  ProofRequestStatus.REJECTED,
  ProofRequestStatus.EXPIRED,
]);

export class ReviewProofRequestUseCase {
  constructor(
    private readonly requestRepo: ProofRequestRepository,
    private readonly deliverWebhook?: DeliverWebhookUseCase
  ) {}

  async execute(input: {
    requestId: string;
    companyId: string;
    decision: "approve" | "reject";
  }): Promise<ReviewProofRequestOutputDTO> {
    const row = await this.requestRepo.findById(input.requestId);

    // Both "not found" and "belongs to another company" must return 404 —
    // never 403 — to avoid enumeration of valid request IDs (NFR6).
    if (!row || row.app.companyId !== input.companyId) {
      throw new NotFoundError("Proof request not found", "PROOF_REQUEST_NOT_FOUND");
    }

    if (row.app.environment !== "homol") {
      throw new ForbiddenError("Manual review is only available for homologation apps");
    }

    if (TERMINAL_STATUSES.has(row.request.status)) {
      throw new UnprocessableEntityError("Proof request already in terminal state");
    }

    const newStatus =
      input.decision === "approve" ? ProofRequestStatus.APPROVED : ProofRequestStatus.REJECTED;

    await this.requestRepo.updateStatus(input.requestId, newStatus);

    const updatedAt = new Date().toISOString();

    // Fire-and-forget webhook delivery — mirrors CancelProofSessionUseCase.
    if (this.deliverWebhook) {
      this.deliverWebhook
        .execute({
          proofRequestId: input.requestId,
          status: newStatus,
          proofType: row.request.proofType,
          externalReference: row.request.externalRef,
          updatedAt,
        })
        .catch((err) => console.error(`[webhook] fire-and-forget error: ${err}`));
    }

    return { id: input.requestId, status: newStatus, updatedAt };
  }
}
