export type ProofRequestOutputDTO = {
  id: string;
  appId: string;
  appName: string;
  environment: "dev" | "homol" | "prod";
  proofType: string;
  status: "pending_user" | "processing" | "approved" | "rejected" | "expired";
  result: boolean | null;
  externalRef: string | null;
  /** camelCase alias of externalRef (epics naming). */
  externalReference: string | null;
  createdAt: string;
  validatedAt: string | null;
  /** Latest status-transition timestamp, from the proof_request.updated_at column. Equal to createdAt until the first transition. */
  updatedAt: string;
};
