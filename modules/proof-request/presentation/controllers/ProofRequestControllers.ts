import { CreateProofRequestUseCase } from "../../application/usecases/CreateProofRequestUseCase";
import { GetProofRequestUseCase } from "../../application/usecases/GetProofRequestUseCase";
import { GetProofSessionByTokenUseCase } from "../../application/usecases/GetProofSessionByTokenUseCase";
import { ListProofRequestsUseCase } from "../../application/usecases/ListProofRequestsUseCase";
import {
  CreatedProofRequestOutputDTO,
  CreateProofRequestSchema,
  ProofRequestOutputDTO,
  ProofSessionOutputDTO,
} from "../../application/dtos/ProofRequestDTOs";

export class CreateProofRequestController {
  constructor(private readonly useCase: CreateProofRequestUseCase) {}

  async handle(input: {
    body: unknown;
    apiKey: string;
  }): Promise<CreatedProofRequestOutputDTO> {
    const body = CreateProofRequestSchema.parse(input.body);
    return this.useCase.execute({ apiKey: input.apiKey, body });
  }
}

export class ListProofRequestsController {
  constructor(private readonly useCase: ListProofRequestsUseCase) {}

  async handle(input: {
    companyId: string;
  }): Promise<{ items: ProofRequestOutputDTO[] }> {
    return { items: await this.useCase.execute(input) };
  }
}

export class GetProofRequestController {
  constructor(private readonly useCase: GetProofRequestUseCase) {}

  async handle(input: {
    requestId: string;
    companyId: string;
  }): Promise<ProofRequestOutputDTO> {
    return this.useCase.execute(input);
  }
}

export class GetProofSessionByTokenController {
  constructor(private readonly useCase: GetProofSessionByTokenUseCase) {}

  async handle(input: { sessionToken: string }): Promise<ProofSessionOutputDTO> {
    return this.useCase.execute(input);
  }
}

