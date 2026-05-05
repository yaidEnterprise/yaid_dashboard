import { ProofSession } from "../entities/ProofSession";

export interface ProofSessionRepository {
  create(session: ProofSession): Promise<void>;
  findByTokenHash(hashSessionToken: string): Promise<ProofSession | null>;
  update(session: ProofSession): Promise<void>;
}

