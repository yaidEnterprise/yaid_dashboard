import { z } from "zod";

export const CreateProofRequestSchema = z.object({
  proofType: z.literal("personhood").default("personhood"),
  externalRef: z.string().max(255).optional().nullable(),
});

export type CreateProofRequestDTO = z.infer<typeof CreateProofRequestSchema>;

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

export type CreatedProofRequestOutputDTO = ProofRequestOutputDTO & {
  session: {
    id: string;
    verificationPageUrl: string;
    deepLinkUrl: string;
    expiresAt: string;
  };
};

export type ProofSessionOutputDTO = {
  id: string;
  proofRequestId: string;
  verificationPageUrl: string;
  deepLinkUrl: string;
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  approvedAt: string | null;
};

