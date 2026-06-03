import { z } from "zod";

export const CreateProofRequestSchema = z.object({
  proofType: z.enum(["personhood", "age_over_18"]),
  externalReference: z.string().max(255).optional().nullable(),
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
  externalReference: string | null;
  createdAt: string;
  validatedAt: string | null;
};

export type CreatedProofRequestOutputDTO = ProofRequestOutputDTO & {
  session: {
    id: string;
    verificationUrl: string;
    deepLinkUrl: string;
    expiresAt: string;
  };
};
