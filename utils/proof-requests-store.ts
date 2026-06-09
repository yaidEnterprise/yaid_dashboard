import { fetchWithAuth } from "@/utils/fetch-with-auth";

export type ProofRequestStatus =
  | "pending_user"
  | "processing"
  | "approved"
  | "rejected"
  | "expired";

export interface ProofRequest {
  id: string;
  appId: string;
  appName: string;
  environment: "dev" | "homol" | "prod";
  proofType: string;
  status: ProofRequestStatus;
  result: boolean | null;
  externalRef: string | null;
  createdAt: string;
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
