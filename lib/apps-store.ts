export type AppEnv = "production" | "sandbox";
export type AppStatus = "active" | "inactive";

export interface YaidApp {
  id: string;
  name: string;
  description: string;
  env: AppEnv;
  status: AppStatus;
  webhook: string;
  created: string;
}

const STORAGE_KEY = "yaid:apps";

const SEED_APPS: YaidApp[] = [
  {
    id: "seed-1",
    name: "Onboarding Produção",
    description: "Fluxo principal de cadastro de novos clientes.",
    env: "production",
    status: "active",
    webhook: "https://api.acme.com/yaid/hooks/onboarding",
    created: "12 mar 2025",
  },
  {
    id: "seed-2",
    name: "Backoffice KYC",
    description: "Reverificação periódica de clientes ativos.",
    env: "production",
    status: "active",
    webhook: "https://api.acme.com/yaid/hooks/kyc",
    created: "04 fev 2025",
  },
  {
    id: "seed-3",
    name: "Portal Sandbox",
    description: "Ambiente de homologação do time de produto.",
    env: "sandbox",
    status: "active",
    webhook: "https://staging.acme.com/yaid/hook",
    created: "21 jan 2025",
  },
  {
    id: "seed-4",
    name: "App descontinuado",
    description: "Integração legada do app mobile v1.",
    env: "production",
    status: "inactive",
    webhook: "—",
    created: "08 ago 2024",
  },
];

function readStored(): YaidApp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as YaidApp[]) : [];
  } catch {
    return [];
  }
}

function writeStored(apps: YaidApp[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  window.dispatchEvent(new CustomEvent("yaid:apps-changed"));
}

export function getApps(): YaidApp[] {
  return [...readStored(), ...SEED_APPS];
}

function generateApiKey(env: AppEnv): string {
  const prefix = env === "production" ? "yaid_live" : "yaid_test";
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";
  const bytes = new Uint8Array(40);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < bytes.length; i++) body += alphabet[bytes[i] % alphabet.length];
  return `${prefix}_${body}`;
}

export function createApp(input: {
  name: string;
  description: string;
  env: AppEnv;
  webhook: string;
}): { app: YaidApp; apiKey: string } {
  const now = new Date();
  const created = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const app: YaidApp = {
    id: `app_${now.getTime().toString(36)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    env: input.env,
    status: "active",
    webhook: input.webhook.trim() || "—",
    created,
  };
  const stored = readStored();
  writeStored([app, ...stored]);
  const apiKey = generateApiKey(input.env);
  return { app, apiKey };
}

export function subscribeApps(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener("yaid:apps-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("yaid:apps-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
