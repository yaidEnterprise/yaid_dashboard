import { CompanyRepository } from "@/shared/domain/interfaces/repositories/CompanyRepository";
import { NotFoundError } from "@/shared/errors/AppError";
import { CompanyOutputDTO } from "./get_my_company_viewmodel";

export class GetMyCompanyUseCase {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: { authUserId: string }): Promise<CompanyOutputDTO> {
    const company = await this.companyRepository.findById(input.authUserId);
    if (!company) {
      throw new NotFoundError("Company not found", "COMPANY_NOT_FOUND");
    }

    return {
      id: company.id,
      name: company.name,
      cnpj: company.documentNumber,
      status: company.status,
      createdAt: company.createdAt.toISOString(),
    };
  }
}

