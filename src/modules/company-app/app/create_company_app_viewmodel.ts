import { z } from "zod";

const ENV_VALUES = ["dev", "homol", "prod"] as const;
const STATUS_VALUES = ["enabled", "disabled"] as const;

export const CreateCompanyAppSchema = z.object({
  name: z.string().min(1).max(50),
  webhookUrl: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? "")
    .refine((v) => v === "" || /^https:\/\//i.test(v), {
      message: "webhookUrl must use HTTPS",
    }),
  environment: z.enum(ENV_VALUES).optional().default("dev"),
});

export type CreateCompanyAppDTO = z.infer<typeof CreateCompanyAppSchema>;

export type CompanyAppOutputDTO = {
  id: string;
  appId: string;
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
