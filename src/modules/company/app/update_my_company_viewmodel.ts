export type UpdateMyCompanyInputDTO = {
  name?: string;
  cnpj?: string | null;
};

export type UpdateMyCompanyOutputDTO = {
  id: string;
  name: string;
  cnpj: string | null;
  status: "active" | "inactive";
  createdAt: string;
};
