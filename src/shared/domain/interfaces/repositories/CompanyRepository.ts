import { Company } from "@/shared/domain/entities/Company";

export interface CompanyRepository {
  create(company: Company): Promise<void>;
  findById(id: string): Promise<Company | null>;
  findByEmail(email: string): Promise<Company | null>;
}
