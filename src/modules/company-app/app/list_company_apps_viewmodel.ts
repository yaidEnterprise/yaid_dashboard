export type CompanyAppOutputDTO = {
  id: string;
  companyId: string;
  name: string;
  webhookUrl: string;
  environment: "dev" | "homol" | "prod";
  status: "enabled" | "disabled";
  createdAt: string;
};
