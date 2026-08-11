import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";

export type ProofRequestPersistence = {
  id: string;
  app_id: string;
  proof_type: string;
  status: string;
  result: boolean | null;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
};

export class ProofRequestMapper {
  static toDomain(raw: ProofRequestPersistence): ProofRequest {
    return new ProofRequest({
      id: raw.id,
      appId: raw.app_id,
      proofType: raw.proof_type,
      status: raw.status as ProofRequestStatus,
      result: raw.result,
      externalRef: raw.external_ref,
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at),
      validatedAt: raw.validated_at ? new Date(raw.validated_at) : null,
    });
  }

  static toPersistence(request: ProofRequest): ProofRequestPersistence {
    return {
      id: request.id,
      app_id: request.appId,
      proof_type: request.proofType,
      status: request.status,
      result: request.result,
      external_ref: request.externalRef,
      created_at: request.createdAt.toISOString(),
      updated_at: request.updatedAt.toISOString(),
      validated_at: request.validatedAt?.toISOString() ?? null,
    };
  }
}
