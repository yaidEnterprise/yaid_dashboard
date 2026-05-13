import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";
import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError";
import { CompanyAppOutputDTO, UpdateCompanyAppDTO } from "./update_company_app_viewmodel";

type Input = UpdateCompanyAppDTO & {
  appId: string;
  companyId: string;
};

export class UpdateCompanyAppUseCase {
  constructor(private readonly repo: CompanyAppRepository) {}

  async execute(input: Input): Promise<CompanyAppOutputDTO> {
    const app = await this.repo.findById(input.appId);
    if (!app) throw new NotFoundError("App not found", "COMPANY_APP_NOT_FOUND");
    if (app.companyId !== input.companyId) throw new ForbiddenError();

    if (input.name !== undefined) app.rename(input.name);
    if (input.webhookUrl !== undefined) app.updateWebhook(input.webhookUrl);
    if (input.status !== undefined) {
      app.setStatus(input.status as CompanyAppStatus);
    }

    await this.repo.update(app);

    return {
      id: app.id,
      companyId: app.companyId,
      name: app.name,
      webhookUrl: app.webhookUrl,
      environment: app.environment,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
    };
  }
}
