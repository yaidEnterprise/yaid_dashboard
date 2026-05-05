import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ProofSession } from "../../domain/entities/ProofSession";
import { ProofSessionRepository } from "../../domain/repositories/ProofSessionRepository";
import {
  ProofSessionMapper,
  ProofSessionPersistence,
} from "../mappers/ProofSessionMapper";

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

  async update(session: ProofSession): Promise<void> {
    const persistence = ProofSessionMapper.toPersistence(session);
    const { error } = await this.client
      .from(TABLE)
      .update({
        status: persistence.status,
        opened_at: persistence.opened_at,
        approved_at: persistence.approved_at,
      })
      .eq("id", persistence.id);
    if (error) throw error;
  }
}

