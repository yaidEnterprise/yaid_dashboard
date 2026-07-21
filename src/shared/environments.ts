import { z } from "zod";
import type { CompanyRepository } from "@/shared/domain/interfaces/repositories/CompanyRepository";
import type { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import type { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import type { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import type { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import type { OcrProvider } from "@/shared/domain/interfaces/OcrProvider";

export enum Stage {
  DOTENV = "DOTENV",
  DEV = "DEV",
  HOMOLOG = "HOMOLOG",
  PROD = "PROD",
  TEST = "TEST",
}

const productionRequiredEnvNames = [
  "ISSUER_PRIVATE_KEY",
  "WEBHOOK_SIGNING_PRIVATE_KEY",
  "BLOCKCHAIN_WALLET_PRIVATE_KEY",
  "BLOCKCHAIN_CONTRACT_ADDRESS",
] as const;

const envSchema = z
  .object({
    STAGE: z.enum(Stage).default(Stage.DOTENV),

    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    YAID_VERIFICATION_BASE_URL: z
      .string()
      .url()
      .default("http://localhost:3000/v"),

    ISSUER_PRIVATE_KEY: z.string().min(1).optional(),
    WEBHOOK_SIGNING_PRIVATE_KEY: z.string().min(1).optional(),
    BLOCKCHAIN_WALLET_PRIVATE_KEY: z.string().min(1).optional(),
    BLOCKCHAIN_CONTRACT_ADDRESS: z.string().min(1).optional(),
    BLOCKCHAIN_RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
    OCR_API_URL: z.string().url().optional(),
    OCR_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.STAGE !== Stage.PROD && values.STAGE !== Stage.HOMOLOG) {
      return;
    }

    for (const envName of productionRequiredEnvNames) {
      if (!values[envName]) {
        ctx.addIssue({
          code: "custom",
          path: [envName],
          message: `${envName} is required for ${values.STAGE}`,
        });
      }
    }
  });

export type EnvValues = z.infer<typeof envSchema>;

const TEST_ENV: EnvValues = {
  STAGE: Stage.TEST,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
  YAID_VERIFICATION_BASE_URL: "http://localhost:3000/v",
  ISSUER_PRIVATE_KEY: "test-issuer-private-key",
  WEBHOOK_SIGNING_PRIVATE_KEY: "test-webhook-signing-private-key",
  BLOCKCHAIN_WALLET_PRIVATE_KEY: "test-blockchain-wallet-private-key",
  BLOCKCHAIN_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
  BLOCKCHAIN_RPC_URL: "http://127.0.0.1:8545",
};

let cachedEnvironments: Environments | null = null;

function configureLocalEnv() {
  process.env.STAGE ||= Stage.DOTENV;
}

function readProcessEnv() {
  return {
    STAGE: process.env.STAGE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY:
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    YAID_VERIFICATION_BASE_URL: process.env.YAID_VERIFICATION_BASE_URL,
    ISSUER_PRIVATE_KEY: process.env.ISSUER_PRIVATE_KEY,
    WEBHOOK_SIGNING_PRIVATE_KEY: process.env.WEBHOOK_SIGNING_PRIVATE_KEY,
    BLOCKCHAIN_WALLET_PRIVATE_KEY: process.env.BLOCKCHAIN_WALLET_PRIVATE_KEY,
    BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
    BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL,
    OCR_API_URL: process.env.OCR_API_URL,
    OCR_API_KEY: process.env.OCR_API_KEY,
  };
}

function requireConfiguredValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not configured for this environment`);
  }

  return value;
}

export class Environments {
  private values!: EnvValues;

  private configureLocal() {
    configureLocalEnv();
  }

  loadEnvs() {
    if (!process.env.STAGE || process.env.STAGE === Stage.DOTENV) {
      this.configureLocal();
    }

    const stage = (process.env.STAGE as Stage | undefined) ?? Stage.DOTENV;

    if (stage === Stage.TEST) {
      this.values = TEST_ENV;
      return;
    }

    this.values = envSchema.parse({
      ...readProcessEnv(),
      STAGE: stage,
    });
  }

  get stage() {
    return this.values.STAGE;
  }

  get NEXT_PUBLIC_APP_URL() {
    return this.values.NEXT_PUBLIC_APP_URL;
  }

  get NEXT_PUBLIC_SUPABASE_URL() {
    return this.values.NEXT_PUBLIC_SUPABASE_URL;
  }

  get NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY() {
    return this.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }

  get SUPABASE_SECRET_KEY() {
    return this.values.SUPABASE_SECRET_KEY;
  }

  get YAID_VERIFICATION_BASE_URL() {
    return this.values.YAID_VERIFICATION_BASE_URL;
  }

  get ISSUER_PRIVATE_KEY() {
    return requireConfiguredValue(
      this.values.ISSUER_PRIVATE_KEY,
      "ISSUER_PRIVATE_KEY"
    );
  }

  get WEBHOOK_SIGNING_PRIVATE_KEY() {
    return requireConfiguredValue(
      this.values.WEBHOOK_SIGNING_PRIVATE_KEY,
      "WEBHOOK_SIGNING_PRIVATE_KEY"
    );
  }

  get BLOCKCHAIN_WALLET_PRIVATE_KEY() {
    return requireConfiguredValue(
      this.values.BLOCKCHAIN_WALLET_PRIVATE_KEY,
      "BLOCKCHAIN_WALLET_PRIVATE_KEY"
    );
  }

  get BLOCKCHAIN_CONTRACT_ADDRESS() {
    return requireConfiguredValue(
      this.values.BLOCKCHAIN_CONTRACT_ADDRESS,
      "BLOCKCHAIN_CONTRACT_ADDRESS"
    );
  }

  get BLOCKCHAIN_RPC_URL() {
    return this.values.BLOCKCHAIN_RPC_URL;
  }

  get OCR_API_URL() {
    return this.values.OCR_API_URL;
  }

  get OCR_API_KEY() {
    return this.values.OCR_API_KEY;
  }

  toJSON() {
    return { ...this.values };
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  async getCompanyRepository(): Promise<CompanyRepository> {
    if (this.stage === Stage.TEST) {
      throw new Error("No company repository configured for TEST stage");
    }

    const { SupabaseCompanyRepository } = await import(
      "@/shared/infra/repositories/SupabaseCompanyRepository"
    );
    return new SupabaseCompanyRepository();
  }

  async getCompanyAppRepository(): Promise<CompanyAppRepository> {
    if (this.stage === Stage.TEST) {
      throw new Error("No company app repository configured for TEST stage");
    }

    const { SupabaseCompanyAppRepository } = await import(
      "@/shared/infra/repositories/SupabaseCompanyAppRepository"
    );
    return new SupabaseCompanyAppRepository();
  }

  async getProofRequestRepository(): Promise<ProofRequestRepository> {
    if (this.stage === Stage.TEST) {
      throw new Error("No proof request repository configured for TEST stage");
    }

    const { SupabaseProofRequestRepository } = await import(
      "@/shared/infra/repositories/SupabaseProofRequestRepository"
    );
    return new SupabaseProofRequestRepository();
  }

  async getProofSessionRepository(): Promise<ProofSessionRepository> {
    if (this.stage === Stage.TEST) {
      throw new Error("No proof session repository configured for TEST stage");
    }

    const { SupabaseProofSessionRepository } = await import(
      "@/shared/infra/repositories/SupabaseProofSessionRepository"
    );
    return new SupabaseProofSessionRepository();
  }

  async getApiKeyHasher(): Promise<ApiKeyHasher> {
    const { Sha256ApiKeyHasher } = await import(
      "@/shared/infra/providers/Sha256ApiKeyHasher"
    );
    return new Sha256ApiKeyHasher();
  }

  async getBlockchainClient(): Promise<BlockchainClient> {
    if (this.stage === Stage.TEST) {
      throw new Error("No blockchain client configured for TEST stage");
    }
    const { EthersBlockchainClient } = await import(
      "@/shared/clients/blockchain/EthersBlockchainClient"
    );
    return new EthersBlockchainClient(
      this.BLOCKCHAIN_CONTRACT_ADDRESS,
      this.BLOCKCHAIN_WALLET_PRIVATE_KEY,
      this.BLOCKCHAIN_RPC_URL
    );
  }

  async getOcrProvider(): Promise<OcrProvider> {
    const url = this.values.OCR_API_URL;
    const key = this.values.OCR_API_KEY;

    if (url && key) {
      const { ApiOcrProvider } = await import(
        "@/shared/clients/ocr/ApiOcrProvider"
      );
      return new ApiOcrProvider(url, key);
    }

    const { MockOcrProvider } = await import(
      "@/shared/clients/ocr/MockOcrProvider"
    );
    return new MockOcrProvider();
  }

  static getEnvs() {
    if (!cachedEnvironments) {
      const environments = new Environments();
      environments.loadEnvs();
      cachedEnvironments = environments;
    }

    return cachedEnvironments;
  }
}

export const publicEnv = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return readProcessEnv().NEXT_PUBLIC_SUPABASE_URL as string;
  },
  get NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY() {
    return readProcessEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
  },
};

type RuntimeEnv = Omit<EnvValues, "STAGE"> & {
  stage: Stage;
};

export const env = new Proxy({} as RuntimeEnv, {
  get(_target, prop: keyof RuntimeEnv) {
    return Environments.getEnvs()[prop];
  },
});
