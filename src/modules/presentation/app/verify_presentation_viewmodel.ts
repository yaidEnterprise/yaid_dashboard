import { z } from "zod";

export const VerifyPresentationSchema = z.object({
  vp: z.record(z.string(), z.unknown()),
  sessionToken: z.string().min(1),
});

export type VerifyPresentationInput = z.infer<typeof VerifyPresentationSchema>;

export interface VerifyPresentationOutputDTO {
  valid: boolean;
}
