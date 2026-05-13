import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import {
  ProofRequestRepository,
  ProofRequestWithApp,
} from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { getSupabaseAdminClient } from "@/shared/clients/supabase/admin";
import {
  ProofRequestMapper,
  ProofRequestPersistence,
} from "@/shared/infra/dto/ProofRequestMapper";

const TABLE = "proof_request";

type ProofRequestWithAppPersistence = ProofRequestPersistence & {
  company_app: {
    id: string;
    company_id: string;
    name: string;
    environment: "dev" | "homol" | "prod";
  };
};

function mapWithApp(raw: ProofRequestWithAppPersistence): ProofRequestWithApp {
  return {
    request: ProofRequestMapper.toDomain(raw),
    app: {
      id: raw.company_app.id,
      name: raw.company_app.name,
      environment: raw.company_app.environment,
      companyId: raw.company_app.company_id,
    },
  };
}

export class SupabaseProofRequestRepository implements ProofRequestRepository {
  private get client() {
    return getSupabaseAdminClient();
  }

  async create(request: ProofRequest): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .insert(ProofRequestMapper.toPersistence(request));
    if (error) throw error;
  }

  async findById(id: string): Promise<ProofRequestWithApp | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*, company_app!inner(id, company_id, name, environment)")
      .eq("id", id)
      .maybeSingle<ProofRequestWithAppPersistence>();

    if (error) throw error;
    if (!data) return null;
    return mapWithApp(data);
  }

  async listByAppIds(appIds: string[]): Promise<ProofRequestWithApp[]> {
    if (appIds.length === 0) return [];

    const { data, error } = await this.client
      .from(TABLE)
      .select("*, company_app!inner(id, company_id, name, environment)")
      .in("app_id", appIds)
      .order("created_at", { ascending: false })
      .returns<ProofRequestWithAppPersistence[]>();

    if (error) throw error;
    return (data ?? []).map(mapWithApp);
  }
}
