import { z } from "zod";

export const CancelProofSessionResponseSchema = z.object({
  cancelled: z.boolean(),
});

export type CancelProofSessionResponseDTO = z.infer<typeof CancelProofSessionResponseSchema>;
