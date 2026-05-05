import { CompanyAppRepository } from "@/modules/company-app/domain/repositories/CompanyAppRepository";
import { ProofRequestRepository } from "../../domain/repositories/ProofRequestRepository";
import { ProofRequestOutputDTO } from "../dtos/ProofRequestDTOs";

export class ListProofRequestsUseCase {
  constructor(
    private readonly appRepo: CompanyAppRepository,
    private readonly requestRepo: ProofRequestRepository
  ) {}

  async execute(input: { companyId: string }): Promise<ProofRequestOutputDTO[]> {
    const apps = await this.appRepo.listByCompanyId(input.companyId);
    if (apps.length === 0) return [];

    const appIds = apps.map((app) => app.id);
    const rows = await this.requestRepo.listByAppIds(appIds);

    return rows.map(({ request, app }) => ({
      id: request.id,
      appId: request.appId,
      appName: app.name,
      environment: app.environment,
      proofType: request.proofType,
      status: request.status,
      result: request.result,
      externalRef: request.externalRef,
      createdAt: request.createdAt.toISOString(),
      validatedAt: request.validatedAt?.toISOString() ?? null,
    }));
  }
}

