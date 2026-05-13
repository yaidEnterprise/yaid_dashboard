import { z } from "zod";

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(50),
  documentNumber: z
    .string()
    .min(11)
    .max(14)
    .regex(/^\d+$/, "documentNumber must be numeric")
    .optional()
    .nullable(),
});

export type CreateCompanyDTO = z.infer<typeof CreateCompanySchema>;

export type CompanyOutputDTO = {
  id: string;
  name: string;
  documentNumber: string | null;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
};
