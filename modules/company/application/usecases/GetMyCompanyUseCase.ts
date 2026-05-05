import { CompanyRepository } from "../../domain/repositories/CompanyRepository";
import { NotFoundError } from "@/shared/errors/AppError";
import { CompanyOutputDTO } from "../dtos/CreateCompanyDTO";

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
      documentNumber: company.documentNumber,
      email: company.email,
      status: company.status,
      createdAt: company.createdAt.toISOString(),
    };
  }
}
