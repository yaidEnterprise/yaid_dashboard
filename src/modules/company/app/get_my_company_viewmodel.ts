export type CompanyOutputDTO = {
  id: string;
  name: string;
  documentNumber: string | null;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
};
