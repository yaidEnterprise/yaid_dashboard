import { z } from "zod";

export const IssueCredentialSchema = z.object({
  documentImage: z.string().min(1),
  proofType: z.string().min(1),
  bodySignature: z.string().min(1),
});

export type IssueCredentialDTO = z.infer<typeof IssueCredentialSchema>;
