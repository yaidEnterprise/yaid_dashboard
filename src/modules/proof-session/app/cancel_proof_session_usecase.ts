import { NotFoundError, UnprocessableEntityError } from "@/shared/errors/AppError";
import { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { CancelProofSessionResponseDTO } from "./cancel_proof_session_viewmodel";

const TERMINAL_STATUSES = new Set<ProofSessionStatus>([
  ProofSessionStatus.APPROVED_BY_USER,
  ProofSessionStatus.EXPIRED,
  ProofSessionStatus.CANCELLED,
]);

export class CancelProofSessionUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly requestRepo: ProofRequestRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: { sessionToken: string }): Promise<CancelProofSessionResponseDTO> {
    const tokenHash = await this.hasher.hash(input.sessionToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      throw new NotFoundError("Session not found", "PROOF_SESSION_NOT_FOUND");
    }

    if (TERMINAL_STATUSES.has(session.status)) {
      throw new UnprocessableEntityError("Session already in terminal state");
    }

    if (session.status !== ProofSessionStatus.WAITING_USER && session.status !== ProofSessionStatus.OPENED) {
      throw new UnprocessableEntityError("Session already in terminal state");
    }

    session.cancel();
    await this.sessionRepo.update(session);
    await this.requestRepo.updateStatus(session.proofRequestId, ProofRequestStatus.REJECTED);

    return { cancelled: true };
  }
}
