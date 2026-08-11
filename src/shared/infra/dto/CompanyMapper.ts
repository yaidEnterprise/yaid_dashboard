import { Company } from "@/shared/domain/entities/Company";
import { CompanyStatus } from "@/shared/domain/enums/CompanyStatus";

export type CompanyPersistence = {
  id: string;
  name: string;
  document_number: string | null;
  email: string;
  status: string;
  created_at: string;
  can_create_apps: boolean;
};

export class CompanyMapper {
  static toDomain(raw: CompanyPersistence): Company {
    return new Company({
      id: raw.id,
      name: raw.name,
      documentNumber: raw.document_number ?? null,
      email: raw.email,
      status: raw.status as CompanyStatus,
      createdAt: new Date(raw.created_at),
      canCreateApps: raw.can_create_apps,
    });
  }

  static toPersistence(company: Company): CompanyPersistence {
    return {
      id: company.id,
      name: company.name,
      document_number: company.documentNumber,
      email: company.email,
      status: company.status,
      created_at: company.createdAt.toISOString(),
      can_create_apps: company.canCreateApps,
    };
  }
}
