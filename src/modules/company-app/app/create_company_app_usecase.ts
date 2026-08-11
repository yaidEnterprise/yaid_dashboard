import { randomBytes, randomUUID } from "node:crypto";
import { CompanyApp } from "@/shared/domain/entities/CompanyApp";
import { CompanyAppEnvironment } from "@/shared/domain/enums/CompanyAppEnvironment";
import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";
import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { CompanyRepository } from "@/shared/domain/interfaces/repositories/CompanyRepository";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError";
import { CompanyAppWithApiKeyDTO, CreateCompanyAppDTO } from "./create_company_app_viewmodel";

type CreateCompanyAppInput = CreateCompanyAppDTO & {
  companyId: string;
};

function generateSecret() {
  return randomBytes(32).toString("base64url");
}

export class CreateCompanyAppUseCase {
  constructor(
    private readonly repo: CompanyAppRepository,
    private readonly hasher: ApiKeyHasher,
    private readonly companyRepository: CompanyRepository
  ) {}

  async execute(input: CreateCompanyAppInput): Promise<CompanyAppWithApiKeyDTO> {
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw new NotFoundError("Company not found", "COMPANY_NOT_FOUND");
    }
    if (!company.canCreateApps) {
      throw new ForbiddenError("Company not allowed to create apps");
    }

    const id = randomUUID();
    const secret = generateSecret();
    const apiKey = `${id}.${secret}`;
    const apiKeyHash = await this.hasher.hash(apiKey);

    const app = new CompanyApp({
      id,
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
      appId: app.id,
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
