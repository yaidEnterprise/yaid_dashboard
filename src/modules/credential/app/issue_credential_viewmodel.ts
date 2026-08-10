import { z } from "zod";

export const IssueCredentialSchema = z
  .object({
    documentImage: z.string().min(1),
    bodySignature: z.string().min(1),
  })
  .strict();

export type IssueCredentialDTO = z.infer<typeof IssueCredentialSchema>;
