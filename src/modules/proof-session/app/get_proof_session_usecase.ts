import { NotFoundError } from "@/shared/errors/AppError";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofSessionOutputDTO } from "./get_proof_session_viewmodel";

const ACTIVE_STATUSES = new Set<ProofSessionStatus>([
  ProofSessionStatus.WAITING_USER,
  ProofSessionStatus.OPENED,
]);

export class GetProofSessionUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly hasher: ApiKeyHasher
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
    }

    return {
      status: session.status,
      proofType,
      companyName,
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}
