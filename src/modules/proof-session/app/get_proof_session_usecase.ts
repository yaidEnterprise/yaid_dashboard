import { NotFoundError } from "@/shared/errors/AppError";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ProofSessionOutputDTO } from "./get_proof_session_viewmodel";
import type { DeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_usecase";

const ACTIVE_STATUSES = new Set<ProofSessionStatus>([
  ProofSessionStatus.WAITING_USER,
  ProofSessionStatus.OPENED,
]);

export class GetProofSessionUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly hasher: ApiKeyHasher,
    private readonly requestRepo?: ProofRequestRepository,
    private readonly deliverWebhook?: DeliverWebhookUseCase
  ) {}

  async execute(input: { sessionToken: string }): Promise<ProofSessionOutputDTO> {
    const tokenHash = await this.hasher.hash(input.sessionToken);
    const context = await this.sessionRepo.findByTokenHashWithContext(tokenHash);
    if (!context) throw new NotFoundError("Session not found", "PROOF_SESSION_NOT_FOUND");

    const { session, proofType, companyName } = context;

    // If session has expired in clock time but status hasn't been updated yet, sync it
    const isClockExpired = session.expiresAt.getTime() <= Date.now();
    if (isClockExpired && ACTIVE_STATUSES.has(session.status)) {
      session.markExpired();
      await this.sessionRepo.update(session);

      // Also transition proof_request to expired (was missing before Story 6.1)
      if (this.requestRepo) {
        await this.requestRepo.updateStatus(
          session.proofRequestId,
          ProofRequestStatus.EXPIRED
        );
      }

      // Fire-and-forget webhook delivery
      if (this.deliverWebhook) {
        this.deliverWebhook
          .execute({
            proofRequestId: session.proofRequestId,
            status: ProofRequestStatus.EXPIRED,
            proofType,
            updatedAt: new Date().toISOString(),
          })
          .catch((err) =>
            console.error(`[webhook] fire-and-forget error: ${err}`)
          );
      }
    }

    return {
      status: session.status,
      proofType,
      companyName,
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}

