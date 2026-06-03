import { Company } from "@/shared/domain/entities/Company";
import { CompanyRepository } from "@/shared/domain/interfaces/repositories/CompanyRepository";
import { getSupabaseAdminClient } from "@/shared/clients/supabase/admin";
import { CompanyMapper, CompanyPersistence } from "@/shared/infra/dto/CompanyMapper";

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

  async update(company: Company): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .update({
        name: company.name,
        document_number: company.documentNumber,
      })
      .eq("id", company.id);

    if (error) throw error;
  }
}

