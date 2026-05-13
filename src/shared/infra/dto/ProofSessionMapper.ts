import { ProofSession } from "@/shared/domain/entities/ProofSession";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";

export type ProofSessionPersistence = {
  id: string;
  proof_request_id: string;
  hash_session_token: string;
  challenge_nonce_hash: string | null;
  challenge_created_at: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  approved_at: string | null;
};

export class ProofSessionMapper {
  static toDomain(raw: ProofSessionPersistence): ProofSession {
    return new ProofSession({
      id: raw.id,
      proofRequestId: raw.proof_request_id,
      hashSessionToken: raw.hash_session_token,
      challengeNonceHash: raw.challenge_nonce_hash,
      challengeCreatedAt: raw.challenge_created_at ? new Date(raw.challenge_created_at) : null,
      status: raw.status as ProofSessionStatus,
      createdAt: new Date(raw.created_at),
      expiresAt: new Date(raw.expires_at),
      openedAt: raw.opened_at ? new Date(raw.opened_at) : null,
      approvedAt: raw.approved_at ? new Date(raw.approved_at) : null,
    });
  }

  static toPersistence(session: ProofSession): ProofSessionPersistence {
    return {
      id: session.id,
      proof_request_id: session.proofRequestId,
      hash_session_token: session.hashSessionToken,
      challenge_nonce_hash: session.challengeNonceHash,
      challenge_created_at: session.challengeCreatedAt?.toISOString() ?? null,
      status: session.status,
      created_at: session.createdAt.toISOString(),
      expires_at: session.expiresAt.toISOString(),
      opened_at: session.openedAt?.toISOString() ?? null,
      approved_at: session.approvedAt?.toISOString() ?? null,
    };
  }
}
