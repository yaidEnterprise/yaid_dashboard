import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofSession } from "@/shared/domain/entities/ProofSession";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";

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
  createAtomic(request: ProofRequest, session: ProofSession): Promise<void>;
  findById(id: string): Promise<ProofRequestWithApp | null>;
  listByAppIds(appIds: string[]): Promise<ProofRequestWithApp[]>;
  updateStatus(id: string, status: ProofRequestStatus): Promise<void>;
}

