export type CompanyOutputDTO = {
  id: string;
  name: string;
  cnpj: string | null;
  status: "active" | "inactive";
  createdAt: string;
  canCreateApps: boolean;
};

