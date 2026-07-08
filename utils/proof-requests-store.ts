// Thin client-side wrapper over the proof-request HTTP API.
// Matches the shape returned by GET /api/proof-requests/{requestId}.
import { fetchWithAuth } from "@/utils/fetch-with-auth";

export type ProofRequestStatus =
  | "pending_user"
  | "processing"
  | "approved"
  | "rejected"
  | "expired";

export interface ProofRequestDetail {
  id: string;
  appId: string;
  appName: string;
  environment: "dev" | "homol" | "prod";
  proofType: string;
  status: ProofRequestStatus;
  result: boolean | null;
  externalReference: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string | null;
  validatedAt: string | null;
}

async function asJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && json.error?.message) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export async function listProofRequests(): Promise<ProofRequest[]> {
  const res = await fetchWithAuth("/api/proof-requests", { cache: "no-store" });
  const json = await asJson(res);
  return (json.items ?? []) as ProofRequest[];
}

export const PROOF_TYPE_LABELS: Record<string, string> = {
  personhood: "Personhood",
  age_over_18: "Maior de 18 anos",
};

export function formatProofType(proofType: string): string {
  return PROOF_TYPE_LABELS[proofType] ?? proofType;
}

export function truncateId(id: string, visible = 8): string {
  if (id.length <= visible + 1) return id;
  return `${id.slice(0, visible)}…`;
}

export function countByStatus(items: ProofRequest[]) {
  return {
    total: items.length,
    approved: items.filter((r) => r.status === "approved").length,
    pending: items.filter(
      (r) => r.status === "pending_user" || r.status === "processing",
    ).length,
    rejected: items.filter(
      (r) => r.status === "rejected" || r.status === "expired",
    ).length,
  };
}
export async function getProofRequest(
  requestId: string
): Promise<ProofRequestDetail> {
  const res = await fetchWithAuth(`/api/proof-requests/${requestId}`, {
    cache: "no-store",
  });
  return (await asJson(res)) as ProofRequestDetail;
}

/** PT-BR label for each backend status. */
export const PROOF_REQUEST_STATUS_LABELS: Record<ProofRequestStatus, string> = {
  pending_user: "Aguardando usuário",
  processing: "Em processamento",
  approved: "Aprovada",
  rejected: "Rejeitada",
  expired: "Expirada",
};

/** Human-readable proof type labels (PT-BR). */
export const PROOF_TYPE_LABELS: Record<string, string> = {
  personhood: "Prova de humanidade",
  age_over_18: "Maior de 18 anos",
};

export function proofTypeLabel(proofType: string): string {
  return PROOF_TYPE_LABELS[proofType] ?? proofType;
}

export type ConfirmedClaim = { key: string; label: string; value: true };

/**
 * Derives the confirmed boolean claim(s) for an approved request from its
 * proofType. The schema stores only `result` + `proofType` (no per-claim
 * table) and never any PII, so we surface only the confirmed boolean.
 */
export function confirmedClaims(proofType: string): ConfirmedClaim[] {
  switch (proofType) {
    case "personhood":
      return [{ key: "personhood", label: "Prova de humanidade (personhood)", value: true }];
    case "age_over_18":
      return [{ key: "ageOver18", label: "Maior de 18 anos (ageOver18)", value: true }];
    default:
      return [];
  }
}

/** Message shown in the attributes card for non-approved statuses. */
export const NON_APPROVED_MESSAGES: Record<
  Exclude<ProofRequestStatus, "approved">,
  string
> = {
  pending_user: "Aguardando verificação do usuário.",
  processing: "Validação em processamento.",
  rejected: "Validação rejeitada.",
  expired: "Solicitação expirada.",
};
