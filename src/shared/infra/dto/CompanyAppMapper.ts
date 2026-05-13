import { CompanyApp } from "@/shared/domain/entities/CompanyApp";
import { CompanyAppEnvironment } from "@/shared/domain/enums/CompanyAppEnvironment";
import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";

export type CompanyAppPersistence = {
  id: string;
  company_id: string;
  name: string;
  api_key_hash: string;
  webhook_url: string;
  environment: string;
  status: string;
  created_at: string;
};

export class CompanyAppMapper {
  static toDomain(raw: CompanyAppPersistence): CompanyApp {
    return new CompanyApp({
      id: raw.id,
      companyId: raw.company_id,
      name: raw.name,
      apiKeyHash: raw.api_key_hash,
      webhookUrl: raw.webhook_url,
      environment: raw.environment as CompanyAppEnvironment,
      status: raw.status as CompanyAppStatus,
      createdAt: new Date(raw.created_at),
    });
  }

  static toPersistence(app: CompanyApp): CompanyAppPersistence {
    return {
      id: app.id,
      company_id: app.companyId,
      name: app.name,
      api_key_hash: app.apiKeyHash,
      webhook_url: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      created_at: app.createdAt.toISOString(),
    };
  }
}
