export type ProofRequestOutputDTO = {
  id: string;
  appId: string;
  appName: string;
  environment: "dev" | "homol" | "prod";
  proofType: string;
  status: "pending_user" | "processing" | "approved" | "rejected" | "expired";
  result: boolean | null;
  externalRef: string | null;
  createdAt: string;
  validatedAt: string | null;
};
