import { ProofSession } from "@/shared/domain/entities/ProofSession";
import {
  ProofSessionRepository,
  ProofSessionWithContext,
} from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { getSupabaseAdminClient } from "@/shared/clients/supabase/admin";
import {
  ProofSessionMapper,
  ProofSessionPersistence,
} from "@/shared/infra/dto/ProofSessionMapper";

const TABLE = "proof_session";

export class SupabaseProofSessionRepository implements ProofSessionRepository {
  private get client() {
    return getSupabaseAdminClient();
  }

  async create(session: ProofSession): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .insert(ProofSessionMapper.toPersistence(session));
    if (error) throw error;
  }

  async findByTokenHash(hashSessionToken: string): Promise<ProofSession | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("hash_session_token", hashSessionToken)
      .maybeSingle<ProofSessionPersistence>();

    if (error) throw error;
    if (!data) return null;
    return ProofSessionMapper.toDomain(data);
  }

  /**
   * Finds a proof_session by token hash and enriches it with context from
   * related tables needed by the public status endpoint:
   *   proof_session → proof_request → company_app → company
   *
   * Returns proofType, companyName and returnUrl alongside the session.
   * Sensitive fields (externalReference, challengeNonceHash, etc.) are
   * not included — filtering is done in the ViewModel layer.
   */
  async findByTokenHashWithContext(hash: string): Promise<ProofSessionWithContext | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(`
        *,
        proof_request!inner(
          proof_type,
          return_url,
          company_app!inner(
            company!inner(name)
          )
        )
      `)
      .eq("hash_session_token", hash)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Supabase returns joined data as nested objects; cast to structured shape
    type JoinedRow = ProofSessionPersistence & {
      proof_request: {
        proof_type: string;
        return_url: string | null;
        company_app: {
          company: { name: string };
        };
      };
    };

    const row = data as JoinedRow;

    return {
      session: ProofSessionMapper.toDomain(row),
      proofType: row.proof_request.proof_type,
      companyName: row.proof_request.company_app.company.name,
      returnUrl: row.proof_request.return_url ?? null,
    };
  }

  async update(session: ProofSession): Promise<void> {
    const persistence = ProofSessionMapper.toPersistence(session);
    const { error } = await this.client
      .from(TABLE)
      .update({
        status: persistence.status,
        challenge_nonce_hash: persistence.challenge_nonce_hash,
        challenge_created_at: persistence.challenge_created_at,
        opened_at: persistence.opened_at,
        approved_at: persistence.approved_at,
      })
      .eq("id", persistence.id);
    if (error) throw error;
  }
}
