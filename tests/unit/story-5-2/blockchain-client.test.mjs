/**
 * Story 5.2 — Wrapper BlockchainClient
 *
 * Testes de contrato para a infraestrutura de integração blockchain:
 *   - Existência e shape dos novos arquivos
 *   - Interface BlockchainClient define os 4 métodos corretos
 *   - ABI YaIDRegistry tem as 4 assinaturas corretas
 *   - environments.ts expõe as novas variáveis e o factory method
 *   - Compilação TypeScript limpa
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);

function readText(...segments) {
  return readFileSync(fromRoot(...segments), "utf8");
}

function assertFileExists(relativePath) {
  assert.ok(existsSync(fromRoot(relativePath)), `${relativePath} should exist`);
}

// ─── Existência de arquivos ────────────────────────────────────────────────────

test("Story 5.2 creates BlockchainClient interface file", () => {
  assertFileExists("src/shared/domain/interfaces/BlockchainClient.ts");
});

test("Story 5.2 creates ABI file for YaIDRegistry contract", () => {
  assertFileExists("src/shared/clients/blockchain/abi.ts");
});

test("Story 5.2 creates EthersBlockchainClient implementation", () => {
  assertFileExists("src/shared/clients/blockchain/EthersBlockchainClient.ts");
});

test("Story 5.2 creates barrel export index.ts for blockchain client", () => {
  assertFileExists("src/shared/clients/blockchain/index.ts");
});

// ─── Interface BlockchainClient ────────────────────────────────────────────────

test("Story 5.2 BlockchainClient interface defines registerDID method", () => {
  const src = readText("src/shared/domain/interfaces/BlockchainClient.ts");
  assert.ok(
    /registerDID\s*\(\s*did\s*:\s*string\s*\)\s*:\s*Promise<void>/.test(src),
    "BlockchainClient must declare registerDID(did: string): Promise<void>"
  );
});

test("Story 5.2 BlockchainClient interface defines revokeVC method", () => {
  const src = readText("src/shared/domain/interfaces/BlockchainClient.ts");
  assert.ok(
    /revokeVC\s*\(\s*vcId\s*:\s*string\s*\)\s*:\s*Promise<void>/.test(src),
    "BlockchainClient must declare revokeVC(vcId: string): Promise<void>"
  );
});

test("Story 5.2 BlockchainClient interface defines isDIDRegistered method", () => {
  const src = readText("src/shared/domain/interfaces/BlockchainClient.ts");
  assert.ok(
    /isDIDRegistered\s*\(\s*did\s*:\s*string\s*\)\s*:\s*Promise<boolean>/.test(src),
    "BlockchainClient must declare isDIDRegistered(did: string): Promise<boolean>"
  );
});

test("Story 5.2 BlockchainClient interface defines isVCRevoked method", () => {
  const src = readText("src/shared/domain/interfaces/BlockchainClient.ts");
  assert.ok(
    /isVCRevoked\s*\(\s*vcId\s*:\s*string\s*\)\s*:\s*Promise<boolean>/.test(src),
    "BlockchainClient must declare isVCRevoked(vcId: string): Promise<boolean>"
  );
});

// ─── ABI do contrato YaIDRegistry ─────────────────────────────────────────────

test("Story 5.2 ABI includes registerDID function signature with bytes32 didHash", () => {
  const src = readText("src/shared/clients/blockchain/abi.ts");
  assert.ok(
    src.includes("function registerDID(bytes32 didHash)"),
    "ABI must include registerDID(bytes32 didHash) — contrato armazena hash, não string"
  );
});

test("Story 5.2 ABI includes revokeCredential function signature (nome real no contrato)", () => {
  const src = readText("src/shared/clients/blockchain/abi.ts");
  assert.ok(
    src.includes("function revokeCredential(bytes32 credentialId)"),
    "ABI must include revokeCredential(bytes32 credentialId) — nome real da função no contrato"
  );
});

test("Story 5.2 ABI includes activeDIDs view mapping accessor (isDIDRegistered)", () => {
  const src = readText("src/shared/clients/blockchain/abi.ts");
  assert.ok(
    src.includes("function activeDIDs(bytes32)") &&
      src.includes("view") &&
      src.includes("returns (bool)"),
    "ABI must include activeDIDs(bytes32) view returns (bool) — mapping público do contrato"
  );
});

test("Story 5.2 ABI includes revokedCredentials view mapping accessor (isVCRevoked)", () => {
  const src = readText("src/shared/clients/blockchain/abi.ts");
  assert.ok(
    src.includes("function revokedCredentials(bytes32)") &&
      src.includes("view") &&
      src.includes("returns (bool)"),
    "ABI must include revokedCredentials(bytes32) view returns (bool) — mapping público do contrato"
  );
});

// ─── EthersBlockchainClient ────────────────────────────────────────────────────

test("Story 5.2 EthersBlockchainClient implements BlockchainClient interface", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    /class EthersBlockchainClient implements BlockchainClient/.test(src),
    "EthersBlockchainClient must implement BlockchainClient"
  );
});

test("Story 5.2 EthersBlockchainClient imports ethers from ethers package", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    /import\s*\{[^}]*ethers[^}]*\}\s*from\s*['"]ethers['"]/.test(src),
    "EthersBlockchainClient must import from 'ethers'"
  );
});

test("Story 5.2 EthersBlockchainClient uses JsonRpcProvider for reads (no gas)", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    src.includes("JsonRpcProvider"),
    "EthersBlockchainClient must use ethers.JsonRpcProvider"
  );
  assert.ok(
    src.includes("readContract"),
    "EthersBlockchainClient must expose a separate readContract"
  );
});

test("Story 5.2 EthersBlockchainClient uses Wallet for signed writes (pays gas)", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    /ethers\.Wallet/.test(src) || /new Wallet/.test(src),
    "EthersBlockchainClient must use ethers.Wallet for signed writes"
  );
  assert.ok(
    src.includes("writeContract"),
    "EthersBlockchainClient must expose a separate writeContract"
  );
});

test("Story 5.2 EthersBlockchainClient validates contractAddress in constructor (review patch)", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    src.includes("ethers.isAddress(contractAddress)"),
    "EthersBlockchainClient constructor must validate contractAddress with ethers.isAddress()"
  );
});

test("Story 5.2 EthersBlockchainClient checks tx receipt for null and status=0 (review patch)", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  // Both registerDID and revokeVC should check the receipt
  const receiptChecks = (src.match(/receipt\.status/g) || []).length;
  assert.ok(
    receiptChecks >= 2,
    "Both registerDID and revokeVC must check receipt.status for EVM reverts"
  );
  const nullChecks = (src.match(/!receipt/g) || []).length;
  assert.ok(
    nullChecks >= 2,
    "Both registerDID and revokeVC must check for null receipt (dropped tx)"
  );
});

test("Story 5.2 EthersBlockchainClient does not access process.env directly", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    !src.includes("process.env"),
    "EthersBlockchainClient must not read process.env — all config comes from Environments"
  );
});

test("Story 5.2 EthersBlockchainClient converts all string args to bytes32 via ethers.id()", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  // registerDID hashes the DID, revokeVC hashes the vcId, isVCRevoked hashes too
  const idCalls = (src.match(/ethers\.id\(/g) || []).length;
  assert.ok(
    idCalls >= 4,
    "All 4 methods must convert string inputs to bytes32 via ethers.id() — contrato só aceita bytes32"
  );
});

test("Story 5.2 EthersBlockchainClient calls revokeCredential (nome real no contrato)", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    src.includes("revokeCredential("),
    "revokeVC must call contract.revokeCredential — nome real da função no contrato"
  );
});

test("Story 5.2 EthersBlockchainClient calls activeDIDs for isDIDRegistered", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    src.includes("activeDIDs("),
    "isDIDRegistered must call contract.activeDIDs — mapping público do contrato"
  );
});

test("Story 5.2 EthersBlockchainClient calls revokedCredentials for isVCRevoked", () => {
  const src = readText("src/shared/clients/blockchain/EthersBlockchainClient.ts");
  assert.ok(
    src.includes("revokedCredentials("),
    "isVCRevoked must call contract.revokedCredentials — mapping público do contrato"
  );
});

test("Story 5.2 barrel export index.ts exports EthersBlockchainClient", () => {
  const src = readText("src/shared/clients/blockchain/index.ts");
  assert.ok(
    src.includes("EthersBlockchainClient"),
    "index.ts must export EthersBlockchainClient"
  );
});

// ─── environments.ts — novas variáveis e factory method ───────────────────────

test("Story 5.2 environments.ts schema includes BLOCKCHAIN_CONTRACT_ADDRESS", () => {
  const src = readText("src/shared/environments.ts");
  assert.ok(
    src.includes("BLOCKCHAIN_CONTRACT_ADDRESS"),
    "environments.ts Zod schema must include BLOCKCHAIN_CONTRACT_ADDRESS"
  );
});

test("Story 5.2 environments.ts schema includes BLOCKCHAIN_RPC_URL with default", () => {
  const src = readText("src/shared/environments.ts");
  assert.ok(
    src.includes("BLOCKCHAIN_RPC_URL"),
    "environments.ts must include BLOCKCHAIN_RPC_URL"
  );
  assert.ok(
    src.includes("127.0.0.1:8545"),
    "BLOCKCHAIN_RPC_URL must default to Hardhat local node"
  );
});

test("Story 5.2 environments.ts TEST_ENV has BLOCKCHAIN_CONTRACT_ADDRESS", () => {
  const src = readText("src/shared/environments.ts");
  // TEST_ENV block must include BLOCKCHAIN_CONTRACT_ADDRESS
  const testEnvBlock = src.match(/const TEST_ENV[^;]+;/s)?.[0] ?? "";
  assert.ok(
    testEnvBlock.includes("BLOCKCHAIN_CONTRACT_ADDRESS"),
    "TEST_ENV must define BLOCKCHAIN_CONTRACT_ADDRESS"
  );
});

test("Story 5.2 environments.ts TEST_ENV has BLOCKCHAIN_RPC_URL", () => {
  const src = readText("src/shared/environments.ts");
  const testEnvBlock = src.match(/const TEST_ENV[^;]+;/s)?.[0] ?? "";
  assert.ok(
    testEnvBlock.includes("BLOCKCHAIN_RPC_URL"),
    "TEST_ENV must define BLOCKCHAIN_RPC_URL"
  );
});

test("Story 5.2 environments.ts exposes BLOCKCHAIN_CONTRACT_ADDRESS getter", () => {
  const src = readText("src/shared/environments.ts");
  assert.ok(
    /get BLOCKCHAIN_CONTRACT_ADDRESS\(\)/.test(src),
    "Environments class must expose BLOCKCHAIN_CONTRACT_ADDRESS getter"
  );
});

test("Story 5.2 environments.ts exposes BLOCKCHAIN_RPC_URL getter", () => {
  const src = readText("src/shared/environments.ts");
  assert.ok(
    /get BLOCKCHAIN_RPC_URL\(\)/.test(src),
    "Environments class must expose BLOCKCHAIN_RPC_URL getter"
  );
});

test("Story 5.2 environments.ts has getBlockchainClient factory method", () => {
  const src = readText("src/shared/environments.ts");
  assert.ok(
    /async getBlockchainClient\(\)\s*:\s*Promise<BlockchainClient>/.test(src),
    "Environments class must have async getBlockchainClient(): Promise<BlockchainClient>"
  );
});

test("Story 5.2 getBlockchainClient throws for TEST stage", () => {
  const src = readText("src/shared/environments.ts");
  const method = src.match(/async getBlockchainClient[\s\S]+?(?=\n  async|\n  static|\n})/)?.[0] ?? "";
  assert.ok(
    method.includes("Stage.TEST") && method.includes("throw new Error"),
    "getBlockchainClient must throw for TEST stage"
  );
});

test("Story 5.2 getBlockchainClient does not access process.env directly", () => {
  const src = readText("src/shared/environments.ts");
  // The getBlockchainClient method should use this.BLOCKCHAIN_CONTRACT_ADDRESS,
  // not process.env directly
  const method = src.match(/async getBlockchainClient[\s\S]+?(?=\n  async|\n  static|\n})/)?.[0] ?? "";
  assert.ok(
    !method.includes("process.env"),
    "getBlockchainClient must not read process.env directly — use this.* getters"
  );
});

test("Story 5.2 environments.ts imports BlockchainClient interface type", () => {
  const src = readText("src/shared/environments.ts");
  assert.ok(
    /import type \{[^}]*BlockchainClient[^}]*\}/.test(src),
    "environments.ts must import BlockchainClient type from the interface"
  );
});

// ─── TypeScript compilation ────────────────────────────────────────────────────

test(
  "Story 5.2 all new files compile without TypeScript errors",
  { timeout: 120_000 },
  () => {
    execFileSync("npx", ["tsc", "--noEmit"], {
      cwd: projectRoot,
      env: { ...process.env, STAGE: "TEST" },
    });
  }
);
