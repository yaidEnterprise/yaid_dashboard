import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError";
import { CompanyAppOutputDTO } from "./get_company_app_viewmodel";

export class GetCompanyAppUseCase {
  constructor(private readonly repo: CompanyAppRepository) {}

  async execute(input: {
    appId: string;
    companyId: string;
  }): Promise<CompanyAppOutputDTO> {
    const app = await this.repo.findById(input.appId);
    if (!app) {
      throw new NotFoundError("App not found", "COMPANY_APP_NOT_FOUND");
    }
    if (app.companyId !== input.companyId) {
      throw new ForbiddenError();
    }

    return {
      id: app.id,
      appId: app.id,
      companyId: app.companyId,
      name: app.name,
      webhookUrl: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
    };
  }
}
