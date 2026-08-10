import { randomBytes, createHash } from "node:crypto";
import { NotFoundError, UnprocessableEntityError } from "@/shared/errors/AppError";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ChallengeProofSessionOutputDTO } from "./challenge_proof_session_viewmodel";

function generateNonce(): string {
  return randomBytes(32).toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const NON_WAITING_USER_STATUSES = [
  ProofSessionStatus.OPENED,
  ProofSessionStatus.APPROVED_BY_USER,
  ProofSessionStatus.EXPIRED,
  ProofSessionStatus.CANCELLED,
];

export class ChallengeProofSessionUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly requestRepo: ProofRequestRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: {
    sessionToken: string;
  }): Promise<ChallengeProofSessionOutputDTO> {
    const tokenHash = await this.hasher.hash(input.sessionToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      throw new NotFoundError("Session not found", "PROOF_SESSION_NOT_FOUND");
    }

    // Check for non-waiting_user statuses (including expired by time)
    const isExpiredByTime =
      session.status === ProofSessionStatus.WAITING_USER &&
      session.expiresAt.getTime() <= Date.now();

    if (isExpiredByTime || NON_WAITING_USER_STATUSES.includes(session.status)) {
      throw new UnprocessableEntityError("Session not in waiting_user state");
    }

    // Generate nonce and hash it
    const nonce = generateNonce();
    const nonceHash = sha256(nonce);
    const now = new Date();

    // Transition session: waiting_user → opened, set challenge fields
    session.openWithChallenge(nonceHash, now);
    await this.sessionRepo.update(session);

    // Transition proof_request: pending_user → processing
    await this.requestRepo.updateStatus(
      session.proofRequestId,
      ProofRequestStatus.PROCESSING
    );

    // Return raw nonce — only time it is exposed
    return { nonce };
  }
}
