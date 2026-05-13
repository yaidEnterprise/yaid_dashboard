export type ProofSessionOutputDTO = {
  id: string;
  proofRequestId: string;
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  approvedAt: string | null;
};
