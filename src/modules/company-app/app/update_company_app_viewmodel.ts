import { z } from "zod";

export const UpdateCompanyAppSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    webhookUrl: z
      .string()
      .url()
      .startsWith("https://", { message: "webhookUrl must use HTTPS" })
      .optional(),
    status: z.enum(["enabled", "disabled"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export type UpdateCompanyAppDTO = z.infer<typeof UpdateCompanyAppSchema>;

export type CompanyAppOutputDTO = {
  id: string;
  appId: string;
  companyId: string;
  name: string;
  webhookUrl: string;
  environment: "dev" | "homol" | "prod";
  status: "enabled" | "disabled";
  createdAt: string;
};
