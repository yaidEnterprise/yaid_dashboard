import { z } from "zod";
import { ethers } from "ethers";
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
  "MISTRAL_API_KEY",
] as const;

const envSchema = z
  .object({
    STAGE: z.enum(Stage).default(Stage.DOTENV),

    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),

    ISSUER_PRIVATE_KEY: z.string().optional(),
    WEBHOOK_SIGNING_PRIVATE_KEY: z.string().optional(),
    BLOCKCHAIN_WALLET_PRIVATE_KEY: z.string().optional(),
    BLOCKCHAIN_CONTRACT_ADDRESS: z.string().optional(),
    BLOCKCHAIN_RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
    MISTRAL_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((values, ctx) => {
    // Formato — roda sempre que o schema é avaliado (todo stage exceto TEST, que
    // nunca chama envSchema.parse(); ver loadEnvs()). Não gated por stage.
    // Checa "!== undefined" (não truthy) para que uma string vazia definida
    // explicitamente seja tratada como valor inválido, não como ausência.
    if (
      values.BLOCKCHAIN_CONTRACT_ADDRESS !== undefined &&
      !ethers.isAddress(values.BLOCKCHAIN_CONTRACT_ADDRESS)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["BLOCKCHAIN_CONTRACT_ADDRESS"],
        message: "BLOCKCHAIN_CONTRACT_ADDRESS must be a valid Ethereum address",
      });
    }

    // Placeholder de TEST_ENV nunca pode vazar para fora do stage TEST — também
    // não gated por stage (roda em DOTENV/DEV/PROD/HOMOLOG igualmente). Compara
    // contra o conjunto inteiro de valores conhecidos do TEST_ENV, não só o campo
    // de mesmo nome — um valor de teste vazado sob o nome errado (ex.: a chave do
    // issuer copiada para WEBHOOK_SIGNING_PRIVATE_KEY) também deve ser rejeitado.
    const knownTestValues = new Set(
      productionRequiredEnvNames.map((envName) => TEST_ENV[envName])
    );
    for (const envName of productionRequiredEnvNames) {
      const value = values[envName];
      if (value !== undefined && knownTestValues.has(value)) {
        ctx.addIssue({
          code: "custom",
          path: [envName],
          message: `${envName} is set to a known TEST_ENV placeholder value, which must never be used outside the TEST stage`,
        });
      }
    }

    // Presença — só obrigatório em PROD/HOMOLOG (inalterado desta story em diante).
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
  ISSUER_PRIVATE_KEY:
    "0000000000000000000000000000000000000000000000000000000000000001",
  WEBHOOK_SIGNING_PRIVATE_KEY:
    "0000000000000000000000000000000000000000000000000000000000000002",
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
    ISSUER_PRIVATE_KEY: process.env.ISSUER_PRIVATE_KEY,
    WEBHOOK_SIGNING_PRIVATE_KEY: process.env.WEBHOOK_SIGNING_PRIVATE_KEY,
    BLOCKCHAIN_WALLET_PRIVATE_KEY: process.env.BLOCKCHAIN_WALLET_PRIVATE_KEY,
    BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
    BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
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

  get MISTRAL_API_KEY() {
    return requireConfiguredValue(this.values.MISTRAL_API_KEY, "MISTRAL_API_KEY");
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
    if (this.stage === Stage.TEST) {
      const { MockOcrProvider } = await import(
        "@/shared/clients/ocr/MockOcrProvider"
      );
      return new MockOcrProvider();
    }

    const { MistralOcrProvider } = await import(
      "@/shared/clients/ocr/MistralOcrProvider"
    );
    return new MistralOcrProvider(this.MISTRAL_API_KEY);
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
