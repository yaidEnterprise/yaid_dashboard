import { Company } from "@/shared/domain/entities/Company";
import { CompanyRepository } from "@/shared/domain/interfaces/repositories/CompanyRepository";
import { NotFoundError } from "@/shared/errors/AppError";
import {
  UpdateMyCompanyInputDTO,
  UpdateMyCompanyOutputDTO,
} from "./update_my_company_viewmodel";

export class UpdateMyCompanyUseCase {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: {
    authUserId: string;
    dto: UpdateMyCompanyInputDTO;
  }): Promise<UpdateMyCompanyOutputDTO> {
    const company = await this.companyRepository.findById(input.authUserId);
    if (!company) {
      throw new NotFoundError("Company not found", "COMPANY_NOT_FOUND");
    }

    // Apply partial updates — only fields provided in the DTO are mutated
    const updated = new Company({
      id: company.id,
      name: input.dto.name ?? company.name,
      documentNumber:
        input.dto.cnpj !== undefined ? input.dto.cnpj : company.documentNumber,
      email: company.email,
      status: company.status,
      createdAt: company.createdAt,
      canCreateApps: company.canCreateApps,
    });

    await this.companyRepository.update(updated);

    return {
      id: updated.id,
      name: updated.name,
      cnpj: updated.documentNumber,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}

