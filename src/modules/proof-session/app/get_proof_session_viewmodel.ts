export type ProofSessionOutputDTO = {
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  proofType: string;
  companyName: string;
  expiresAt: string;
  returnUrl: string | null;
};
