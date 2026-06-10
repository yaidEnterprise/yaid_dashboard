import { ProofSession } from "@/shared/domain/entities/ProofSession";

export type ProofSessionWithContext = {
  session: ProofSession;
  proofType: string;
  companyName: string;
  returnUrl: string | null;
};

export interface ProofSessionRepository {
  create(session: ProofSession): Promise<void>;
  findByTokenHash(hashSessionToken: string): Promise<ProofSession | null>;
  findByTokenHashWithContext(hash: string): Promise<ProofSessionWithContext | null>;
  update(session: ProofSession): Promise<void>;
}
