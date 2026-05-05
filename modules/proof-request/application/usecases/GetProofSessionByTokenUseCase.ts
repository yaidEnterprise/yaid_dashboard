import { NotFoundError } from "@/shared/errors/AppError";
import { ApiKeyHasher } from "@/modules/company-app/domain/services/ApiKeyHasher";
import { ProofSessionRepository } from "../../domain/repositories/ProofSessionRepository";
import { ProofSessionStatus } from "../../domain/enums/ProofSessionStatus";
import { ProofSessionOutputDTO } from "../dtos/ProofRequestDTOs";

export class GetProofSessionByTokenUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: { sessionToken: string }): Promise<ProofSessionOutputDTO> {
    const tokenHash = await this.hasher.hash(input.sessionToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!session) throw new NotFoundError("Session not found", "PROOF_SESSION_NOT_FOUND");

    if (
      session.status === ProofSessionStatus.WAITING_USER &&
      session.expiresAt.getTime() > Date.now()
    ) {
      session.markOpened();
      await this.sessionRepo.update(session);
    }

    return {
      id: session.id,
      proofRequestId: session.proofRequestId,
      verificationPageUrl: session.verificationPageUrl,
      deepLinkUrl: session.deepLinkUrl,
      status: session.expiresAt.getTime() <= Date.now() ? ProofSessionStatus.EXPIRED : session.status,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      openedAt: session.openedAt?.toISOString() ?? null,
      approvedAt: session.approvedAt?.toISOString() ?? null,
    };
  }
}

