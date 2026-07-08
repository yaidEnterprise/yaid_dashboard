import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { CompanyAppOutputDTO } from "./list_company_apps_viewmodel";

export class ListCompanyAppsUseCase {
  constructor(private readonly repo: CompanyAppRepository) {}

  async execute(input: { companyId: string }): Promise<CompanyAppOutputDTO[]> {
    const apps = await this.repo.listByCompanyId(input.companyId);
    return apps.map((app) => ({
      id: app.id,
      appId: app.appId,
      companyId: app.companyId,
      name: app.name,
      webhookUrl: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
    }));
  }
}
