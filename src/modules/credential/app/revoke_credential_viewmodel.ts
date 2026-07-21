import { z } from "zod";

export const RevokeCredentialSchema = z.object({
  vcId: z.string().min(1),
  bodySignature: z.string().min(1),
});

export type RevokeCredentialDTO = z.infer<typeof RevokeCredentialSchema>;
