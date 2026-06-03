import { CompanyApp } from "@/shared/domain/entities/CompanyApp";

export interface CompanyAppRepository {
  create(app: CompanyApp): Promise<void>;
  findById(id: string): Promise<CompanyApp | null>;
  findByAppId(appId: string): Promise<CompanyApp | null>;
  listByCompanyId(companyId: string): Promise<CompanyApp[]>;
  update(app: CompanyApp): Promise<void>;
}
