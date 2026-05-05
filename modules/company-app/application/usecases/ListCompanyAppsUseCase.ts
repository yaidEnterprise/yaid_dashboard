import { CompanyAppRepository } from "../../domain/repositories/CompanyAppRepository";
import { CompanyAppOutputDTO } from "../dtos/CompanyAppDTOs";

export class ListCompanyAppsUseCase {
  constructor(private readonly repo: CompanyAppRepository) {}

  async execute(input: { companyId: string }): Promise<CompanyAppOutputDTO[]> {
    const apps = await this.repo.listByCompanyId(input.companyId);
    return apps.map((app) => ({
      id: app.id,
      companyId: app.companyId,
      name: app.name,
      webhookUrl: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
    }));
  }
}
