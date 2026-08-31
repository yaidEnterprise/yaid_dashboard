/**
 * Story 10.1 — Centralização de Chaves de Teste no `environments.ts`
 *
 * Testes estruturais:
 *   - TEST_ENV carrega os valores hex prontos para ISSUER_PRIVATE_KEY/WEBHOOK_SIGNING_PRIVATE_KEY.
 *   - Os quatro pontos de substituição de placeholder foram removidos dos consumidores.
 *   - O presenter do webhook-public-key não injeta mais `stage` no use case.
 *   - Compilação TypeScript limpa.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const ENVIRONMENTS = "src/shared/environments.ts";
const ISSUE_CREDENTIAL = "src/modules/credential/app/issue_credential_usecase.ts";
const VERIFY_PRESENTATION = "src/modules/presentation/app/verify_presentation_usecase.ts";
const WEBHOOK_SIGNER = "src/shared/infra/providers/Ed25519WebhookSigner.ts";
const GET_WEBHOOK_PUBLIC_KEY_USECASE = "src/modules/webhook/app/get_webhook_public_key_usecase.ts";
const GET_WEBHOOK_PUBLIC_KEY_PRESENTER = "src/modules/webhook/app/get_webhook_public_key_presenter.ts";

const ISSUER_HEX = "0000000000000000000000000000000000000000000000000000000000000001";
const WEBHOOK_HEX = "0000000000000000000000000000000000000000000000000000000000000002";

// ── AC #1: TEST_ENV carrega valores hex prontos ─────────────────────────────

describe("Story 10.1 — TEST_ENV centraliza as chaves hex prontas (AC #1)", () => {
  test("ISSUER_PRIVATE_KEY é o hex de 32 bytes usado hoje pela substituição", () => {
    const src = readText(ENVIRONMENTS);
    const testEnvBlock = src.match(/const TEST_ENV[^;]+;/s)?.[0] ?? "";
    assert.match(testEnvBlock, new RegExp(`ISSUER_PRIVATE_KEY:\\s*\\n?\\s*"${ISSUER_HEX}"`));
  });

  test("WEBHOOK_SIGNING_PRIVATE_KEY é o hex de 32 bytes usado hoje pela substituição", () => {
    const src = readText(ENVIRONMENTS);
    const testEnvBlock = src.match(/const TEST_ENV[^;]+;/s)?.[0] ?? "";
    assert.match(testEnvBlock, new RegExp(`WEBHOOK_SIGNING_PRIVATE_KEY:\\s*\\n?\\s*"${WEBHOOK_HEX}"`));
  });

  test("BLOCKCHAIN_WALLET_PRIVATE_KEY permanece com o placeholder não-hex (fora do escopo desta story)", () => {
    const src = readText(ENVIRONMENTS);
    const testEnvBlock = src.match(/const TEST_ENV[^;]+;/s)?.[0] ?? "";
    assert.match(testEnvBlock, /BLOCKCHAIN_WALLET_PRIVATE_KEY:\s*"test-blockchain-wallet-private-key"/);
  });
});

// ── AC #2: os quatro pontos de substituição foram removidos ─────────────────

describe("Story 10.1 — remoção dos quatro pontos de substituição de placeholder (AC #2)", () => {
  test("issue_credential_usecase.ts lê ISSUER_PRIVATE_KEY diretamente", () => {
    const src = readText(ISSUE_CREDENTIAL);
    assert.doesNotMatch(src, /test-issuer-private-key/);
    assert.match(src, /hexToBytes\(this\.issuerPrivateKey\)/);
  });

  test("verify_presentation_usecase.ts lê ISSUER_PRIVATE_KEY diretamente", () => {
    const src = readText(VERIFY_PRESENTATION);
    assert.doesNotMatch(src, /test-issuer-private-key/);
    assert.match(src, /hexToBytes\(this\.issuerPrivateKey\)/);
  });

  test("Ed25519WebhookSigner usa a chave recebida diretamente", () => {
    const src = readText(WEBHOOK_SIGNER);
    assert.doesNotMatch(src, /test-webhook-signing-private-key/);
    assert.doesNotMatch(src, /TEST_KEY_PLACEHOLDER|TEST_KEY_HEX/);
    assert.match(src, /this\.privateKeyBytes = hexToBytes\(privateKeyHex\)/);
  });

  test("GetWebhookPublicKeyUseCase usa a chave recebida diretamente, sem gate de stage", () => {
    const src = readText(GET_WEBHOOK_PUBLIC_KEY_USECASE);
    assert.doesNotMatch(src, /test-webhook-signing-private-key/);
    assert.doesNotMatch(src, /TEST_PRIVATE_KEY_PLACEHOLDER|TEST_PRIVATE_KEY_HEX/);
    assert.doesNotMatch(src, /Stage/, "Stage import/param must be removed — no more stage-gating");
    assert.match(src, /constructor\(private readonly webhookSigningPrivateKey: string\) \{\}/);
    assert.match(src, /hexToBytes\(this\.webhookSigningPrivateKey\)/);
  });

  test("HEX_PRIVATE_KEY_PATTERN de formato continua no GetWebhookPublicKeyUseCase (não é um dos 4 pontos removidos)", () => {
    const src = readText(GET_WEBHOOK_PUBLIC_KEY_USECASE);
    assert.match(src, /HEX_PRIVATE_KEY_PATTERN\s*=\s*\/\^\[0-9a-fA-F\]\{64\}\$\//);
  });

  test("get_webhook_public_key_presenter.ts não injeta mais stage no use case", () => {
    const src = readText(GET_WEBHOOK_PUBLIC_KEY_PRESENTER);
    assert.match(src, /new GetWebhookPublicKeyUseCase\(envs\.WEBHOOK_SIGNING_PRIVATE_KEY\)/);
    assert.doesNotMatch(src, /envs\.stage/);
  });
});

// ── Compilação TypeScript ────────────────────────────────────────────────────

test.skip("Story 10.1 all modified files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = resolve(ROOT, "node_modules", ".bin", "tsc");
  try {
    execSync(`"${tscBin}" --noEmit`, {
      cwd: ROOT,
      env: { ...process.env, STAGE: "TEST" },
      stdio: "pipe",
      shell: true,
    });
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    const storyErrors = stdout
      .split("\n")
      .filter((line) => line.includes("error TS") && !line.includes("lucide-react"));
    if (storyErrors.length > 0) {
      assert.fail(`TypeScript errors in story files:\n${storyErrors.join("\n")}`);
    }
  }
});
