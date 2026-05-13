import { ProofRequest } from "@/shared/domain/entities/ProofRequest";

export interface ProofRequestWithApp {
  request: ProofRequest;
  app: {
    id: string;
    name: string;
    environment: "dev" | "homol" | "prod";
    companyId: string;
  };
}

export interface ProofRequestRepository {
  create(request: ProofRequest): Promise<void>;
  findById(id: string): Promise<ProofRequestWithApp | null>;
  listByAppIds(appIds: string[]): Promise<ProofRequestWithApp[]>;
}
