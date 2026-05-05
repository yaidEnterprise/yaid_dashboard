import { CompanyApp } from "../../domain/entities/CompanyApp";
import { CompanyAppRepository } from "../../domain/repositories/CompanyAppRepository";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CompanyAppMapper,
  CompanyAppPersistence,
} from "../mappers/CompanyAppMapper";

const TABLE = "company_app";

export class SupabaseCompanyAppRepository implements CompanyAppRepository {
  private get client() {
    return getSupabaseAdminClient();
  }

  async create(app: CompanyApp): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .insert(CompanyAppMapper.toPersistence(app));
    if (error) throw error;
  }

  async findById(id: string): Promise<CompanyApp | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle<CompanyAppPersistence>();
    if (error) throw error;
    if (!data) return null;
    return CompanyAppMapper.toDomain(data);
  }

  async listByCompanyId(companyId: string): Promise<CompanyApp[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .returns<CompanyAppPersistence[]>();
    if (error) throw error;
    return (data ?? []).map(CompanyAppMapper.toDomain);
  }

  async update(app: CompanyApp): Promise<void> {
    const persistence = CompanyAppMapper.toPersistence(app);
    const { error } = await this.client
      .from(TABLE)
      .update({
        name: persistence.name,
        webhook_url: persistence.webhook_url,
        status: persistence.status,
      })
      .eq("id", persistence.id);
    if (error) throw error;
  }
}
