// Thin client-side wrapper over the company-app HTTP API.
// Matches the shape returned by /api/company-apps endpoints.
import { fetchWithAuth } from "@/utils/fetch-with-auth";

export type AppEnv = "dev" | "homol" | "prod";
export type AppStatus = "enabled" | "disabled";

export interface YaidApp {
  id: string;
  appId: string;
  companyId: string;
  name: string;
  environment: AppEnv;
  status: AppStatus;
  webhookUrl: string;
  createdAt: string;
}

export interface YaidAppWithKey extends YaidApp {
  apiKey: string;
}

export type CreateAppInput = {
  name: string;
  webhookUrl?: string;
  environment?: "homol" | "prod";
};

export type UpdateAppInput = {
  name?: string;
  webhookUrl?: string;
  status?: AppStatus;
};

async function asJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && json.error?.message) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export async function listApps(): Promise<YaidApp[]> {
  const res = await fetchWithAuth("/api/company-apps", { cache: "no-store" });
  const json = await asJson(res);
  return (json.items ?? []) as YaidApp[];
}

export async function getApp(appId: string): Promise<YaidApp> {
  const res = await fetchWithAuth(`/api/company-apps/${appId}`, { cache: "no-store" });
  return (await asJson(res)) as YaidApp;
}

export async function createApp(input: CreateAppInput): Promise<YaidAppWithKey> {
  const res = await fetchWithAuth("/api/company-apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await asJson(res)) as YaidAppWithKey;
}

export async function updateApp(
  appId: string,
  input: UpdateAppInput
): Promise<YaidApp> {
  const res = await fetchWithAuth(`/api/company-apps/${appId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await asJson(res)) as YaidApp;
}

export const ENV_LABELS: Record<AppEnv, string> = {
  dev: "Dev",
  homol: "Homologação",
  prod: "Produção",
};

export const STATUS_LABELS: Record<AppStatus, string> = {
  enabled: "Habilitado",
  disabled: "Desabilitado",
};
