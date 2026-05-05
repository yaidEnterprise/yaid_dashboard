import { randomBytes, randomUUID } from "node:crypto";
import { CompanyApp } from "../../domain/entities/CompanyApp";
import { CompanyAppEnvironment } from "../../domain/enums/CompanyAppEnvironment";
import { CompanyAppStatus } from "../../domain/enums/CompanyAppStatus";
import { CompanyAppRepository } from "../../domain/repositories/CompanyAppRepository";
import { ApiKeyHasher } from "../../domain/services/ApiKeyHasher";
import {
  CompanyAppWithApiKeyDTO,
  CreateCompanyAppDTO,
} from "../dtos/CompanyAppDTOs";

type CreateCompanyAppInput = CreateCompanyAppDTO & {
  companyId: string;
};

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
    const secret = generateSecret();
    const apiKeyHash = await this.hasher.hash(secret);

    const app = new CompanyApp({
      id,
      companyId: input.companyId,
      name: input.name.trim(),
      apiKeyHash,
      webhookUrl: input.webhookUrl.trim(),
      environment: input.environment as CompanyAppEnvironment,
      status: CompanyAppStatus.ENABLED,
      createdAt: new Date(),
    });

    await this.repo.create(app);

    return {
      id: app.id,
      companyId: app.companyId,
      name: app.name,
      webhookUrl: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
      apiKey: `${app.id}.${secret}`,
    };
  }
}
