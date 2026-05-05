import { Company } from "../../domain/entities/Company";
import { CompanyStatus } from "../../domain/enums/CompanyStatus";
import { CompanyRepository } from "../../domain/repositories/CompanyRepository";
import { ConflictError } from "@/shared/errors/AppError";
import { CompanyOutputDTO, CreateCompanyDTO } from "../dtos/CreateCompanyDTO";

type CreateCompanyInput = CreateCompanyDTO & {
  authUserId: string;
  email: string;
};

export class CreateCompanyUseCase {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: CreateCompanyInput): Promise<CompanyOutputDTO> {
    const existing = await this.companyRepository.findById(input.authUserId);
    if (existing) {
      throw new ConflictError(
        "Company already exists for this user",
        "COMPANY_ALREADY_EXISTS"
      );
    }

    const company = new Company({
      id: input.authUserId,
      name: input.name.trim(),
      documentNumber: input.documentNumber?.trim() || null,
      email: input.email,
      status: CompanyStatus.ACTIVE,
      createdAt: new Date(),
    });

    await this.companyRepository.create(company);

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
