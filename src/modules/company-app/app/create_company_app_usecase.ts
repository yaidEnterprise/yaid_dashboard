import { randomBytes, randomUUID } from "node:crypto";
import { CompanyApp } from "@/shared/domain/entities/CompanyApp";
import { CompanyAppEnvironment } from "@/shared/domain/enums/CompanyAppEnvironment";
import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";
import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { CompanyAppWithApiKeyDTO, CreateCompanyAppDTO } from "./create_company_app_viewmodel";

type CreateCompanyAppInput = CreateCompanyAppDTO & {
  companyId: string;
};

function generateAppId() {
  return randomBytes(12).toString("base64url");
}

function generateSecret() {
  return randomBytes(32).toString("base64url");
}

export class CreateCompanyAppUseCase {
  constructor(
    private readonly repo: CompanyAppRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: CreateCompanyAppInput): Promise<CompanyAppWithApiKeyDTO> {
    const id = randomUUID();
    const appId = generateAppId();
    const secret = generateSecret();
    const apiKey = `${appId}.${secret}`;
    const apiKeyHash = await this.hasher.hash(apiKey);

    const app = new CompanyApp({
      id,
      appId,
      companyId: input.companyId,
      name: input.name.trim(),
      apiKeyHash,
      webhookUrl: input.webhookUrl,
      environment: input.environment as CompanyAppEnvironment,
      status: CompanyAppStatus.ENABLED,
      createdAt: new Date(),
    });

    await this.repo.create(app);

    return {
      id: app.id,
      appId: app.appId,
      companyId: app.companyId,
      name: app.name,
      webhookUrl: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
      apiKey,
    };
  }
}
