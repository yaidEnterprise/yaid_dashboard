import { z } from "zod";

const ENV_VALUES = ["dev", "homol", "prod"] as const;
const STATUS_VALUES = ["enabled", "disabled"] as const;

export const CreateCompanyAppSchema = z.object({
  name: z.string().min(1).max(50),
  environment: z.enum(ENV_VALUES),
  webhookUrl: z.string().url().startsWith("https://", {
    message: "webhookUrl must use HTTPS",
  }),
});

export type CreateCompanyAppDTO = z.infer<typeof CreateCompanyAppSchema>;

export const UpdateCompanyAppSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    webhookUrl: z
      .string()
      .url()
      .startsWith("https://", { message: "webhookUrl must use HTTPS" })
      .optional(),
    status: z.enum(STATUS_VALUES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export type UpdateCompanyAppDTO = z.infer<typeof UpdateCompanyAppSchema>;

export type CompanyAppOutputDTO = {
  id: string;
  companyId: string;
  name: string;
  webhookUrl: string;
  environment: (typeof ENV_VALUES)[number];
  status: (typeof STATUS_VALUES)[number];
  createdAt: string;
};

export type CompanyAppWithApiKeyDTO = CompanyAppOutputDTO & {
  apiKey: string;
};
