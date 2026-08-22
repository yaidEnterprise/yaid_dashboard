import { z } from "zod";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";

export const ReviewProofRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export type ReviewProofRequestDTO = z.infer<typeof ReviewProofRequestSchema>;

export type ReviewProofRequestOutputDTO = {
  id: string;
  status: ProofRequestStatus;
  updatedAt: string;
};
