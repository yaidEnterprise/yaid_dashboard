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
  /** Latest update timestamp; mapped from validatedAt (no dedicated column yet). */
  updatedAt: string | null;
};
