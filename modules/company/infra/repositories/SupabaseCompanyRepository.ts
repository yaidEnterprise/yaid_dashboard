import { Company } from "../../domain/entities/Company";
import { CompanyRepository } from "../../domain/repositories/CompanyRepository";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { CompanyMapper, CompanyPersistence } from "../mappers/CompanyMapper";

const TABLE = "company";

export class SupabaseCompanyRepository implements CompanyRepository {
  private get client() {
    return getSupabaseAdminClient();
  }

  async create(company: Company): Promise<void> {
    const persistence = CompanyMapper.toPersistence(company);

    const { error } = await this.client.from(TABLE).insert(persistence);

    if (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<Company | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle<CompanyPersistence>();

    if (error) throw error;
    if (!data) return null;

    return CompanyMapper.toDomain(data);
  }

  async findByEmail(email: string): Promise<Company | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("email", email)
      .maybeSingle<CompanyPersistence>();

    if (error) throw error;
    if (!data) return null;

    return CompanyMapper.toDomain(data);
  }
}
