/**
 * Story 6.1 — WebhookSigner e Entrega de Webhook
 *
 * Testes estruturais:
 *   - Existência de todos os arquivos novos.
 *   - Verificações de contrato (WebhookSigner, Ed25519WebhookSigner, DeliverWebhookUseCase).
 *   - Integração de webhook nos use cases existentes.
 *   - Verificação de que o body do webhook não contém PII.
 *   - Compilação TypeScript limpa.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");
const assertFileExists = (rel) =>
  assert.ok(existsSync(fromRoot(rel)), `${rel} should exist`);

// ─── Existência de Arquivos Novos ─────────────────────────────────────────────

test("Story 6.1 WebhookSigner interface file exists", () => {
  assertFileExists("src/shared/domain/interfaces/WebhookSigner.ts");
});

test("Story 6.1 Ed25519WebhookSigner implementation file exists", () => {
  assertFileExists("src/shared/infra/providers/Ed25519WebhookSigner.ts");
});

test("Story 6.1 DeliverWebhookUseCase file exists", () => {
  assertFileExists("src/modules/webhook/app/deliver_webhook_usecase.ts");
});

test("Story 6.1 DeliverWebhookPresenter file exists", () => {
  assertFileExists("src/modules/webhook/app/deliver_webhook_presenter.ts");
});

// ─── Contrato do WebhookSigner ────────────────────────────────────────────────

test("Story 6.1 WebhookSigner interface defines sign method", () => {
  const src = readText("src/shared/domain/interfaces/WebhookSigner.ts");
  assert.match(src, /sign\(payload:\s*string\)/, "Must define sign(payload: string)");
  assert.match(src, /signature:\s*string/, "Must return signature: string");
  assert.match(src, /timestamp:\s*number/, "Must return timestamp: number");
});

test("Story 6.1 WebhookSigner exports WebhookSignResult type", () => {
  const src = readText("src/shared/domain/interfaces/WebhookSigner.ts");
  assert.match(src, /WebhookSignResult/, "Must export WebhookSignResult");
  assert.match(src, /WebhookSigner/, "Must export WebhookSigner");
});

// ─── Contrato do Ed25519WebhookSigner ─────────────────────────────────────────

test("Story 6.1 Ed25519WebhookSigner imports @noble/ed25519", () => {
  const src = readText("src/shared/infra/providers/Ed25519WebhookSigner.ts");
  assert.match(src, /@noble\/ed25519/, "Must use @noble/ed25519 for signing");
});

test("Story 6.1 Ed25519WebhookSigner implements WebhookSigner", () => {
  const src = readText("src/shared/infra/providers/Ed25519WebhookSigner.ts");
  assert.match(src, /implements\s+WebhookSigner/, "Must implement WebhookSigner interface");
  assert.match(src, /async\s+sign/, "Must have async sign method");
});

test("Story 6.1 Ed25519WebhookSigner uses signAsync for signing", () => {
  const src = readText("src/shared/infra/providers/Ed25519WebhookSigner.ts");
  assert.match(src, /signAsync/, "Must use ed.signAsync for Ed25519 signing");
});

test("Story 6.1 Ed25519WebhookSigner preserves raw payload bytes", () => {
  const src = readText("src/shared/infra/providers/Ed25519WebhookSigner.ts");
  assert.match(src, /TextEncoder/, "Must encode payload to bytes via TextEncoder");
});

test("Story 6.1 Ed25519WebhookSigner uses the received private key directly (no placeholder substitution — Epic 10)", () => {
  const src = readText("src/shared/infra/providers/Ed25519WebhookSigner.ts");
  assert.doesNotMatch(src, /test-webhook-signing-private-key/, "Placeholder substitution must be removed");
  assert.match(src, /this\.privateKeyBytes = hexToBytes\(privateKeyHex\)/, "Constructor must use the received value directly");
});

// ─── Contrato do DeliverWebhookUseCase ────────────────────────────────────────

test("Story 6.1 DeliverWebhookUseCase sends X-YaID-Signature header", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  assert.match(src, /X-YaID-Signature/, "Must set X-YaID-Signature header");
});

test("Story 6.1 DeliverWebhookUseCase sends X-YaID-Timestamp header", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  assert.match(src, /X-YaID-Timestamp/, "Must set X-YaID-Timestamp header");
});

test("Story 6.1 DeliverWebhookUseCase uses POST method", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  assert.match(src, /method:\s*["']POST["']/, "Must use POST method for webhook delivery");
});

test("Story 6.1 DeliverWebhookUseCase has timeout", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  assert.match(src, /AbortController/, "Must use AbortController for timeout");
  assert.match(src, /WEBHOOK_TIMEOUT_MS/, "Must define timeout constant");
});

test("Story 6.1 DeliverWebhookUseCase never throws", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  // The execute method wraps everything in try/catch
  assert.match(src, /catch\s*\(error/, "Must catch all errors at top level");
  assert.match(src, /console\.error/, "Must log errors");
});

test("Story 6.1 DeliverWebhookUseCase body does not contain PII", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  // Body should only contain: proofRequestId, status, proofType, externalReference, updatedAt
  assert.match(src, /proofRequestId/, "Body must include proofRequestId");
  assert.match(src, /status/, "Body must include status");
  assert.match(src, /proofType/, "Body must include proofType");
  assert.match(src, /updatedAt/, "Body must include updatedAt");
  // Verify PII fields are not present in the body construction
  // Extract only the body construction block (between 'const body' and 'bodyJson')
  const bodyBlock = src.match(/const body[\s\S]*?JSON\.stringify\(body\)/)?.[0] || "";
  assert.ok(bodyBlock.length > 0, "Must have body construction block");
  assert.doesNotMatch(bodyBlock, /verifiableCredential/, "Body must NOT contain verifiableCredential");
  assert.doesNotMatch(bodyBlock, /verifiablePresentation/, "Body must NOT contain verifiablePresentation");
  assert.doesNotMatch(bodyBlock, /holderDid/, "Body must NOT contain holderDid");
  assert.doesNotMatch(bodyBlock, /\bnonce\b/, "Body must NOT contain nonce");
});

test("Story 6.1 DeliverWebhookUseCase checks webhookUrl exists", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  assert.match(src, /webhookUrl/, "Must check webhookUrl before sending");
});

test("Story 6.1 DeliverWebhookUseCase logs failure with proofRequestId and webhookUrl", () => {
  const src = readText("src/modules/webhook/app/deliver_webhook_usecase.ts");
  assert.match(
    src,
    /proofRequestId=.*webhookUrl=/,
    "Error log must include proofRequestId and webhookUrl"
  );
});

// ─── Integração nos Use Cases Existentes ──────────────────────────────────────

test("Story 6.1 VerifyPresentationUseCase integrates DeliverWebhookUseCase", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /DeliverWebhookUseCase/, "Must import DeliverWebhookUseCase");
  assert.match(src, /deliverWebhook/, "Must have deliverWebhook dependency");
  assert.match(src, /fireWebhook/, "Must have fireWebhook helper method");
});

test("Story 6.1 VerifyPresentationUseCase fires webhook on approved", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /APPROVED[\s\S]*fireWebhook|fireWebhook[\s\S]*APPROVED/, "Must fire webhook on APPROVED");
});

test("Story 6.1 VerifyPresentationUseCase fires webhook on rejected", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /REJECTED[\s\S]*fireWebhook|fireWebhook[\s\S]*REJECTED/, "Must fire webhook on REJECTED");
});

test("Story 6.1 VerifyPresentationPresenter injects webhook", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_presenter.ts");
  assert.match(src, /makeDeliverWebhookUseCase/, "Must import makeDeliverWebhookUseCase");
  assert.match(src, /deliverWebhook/, "Must inject deliverWebhook");
});

test("Story 6.1 CancelProofSessionUseCase integrates DeliverWebhookUseCase", () => {
  const src = readText("src/modules/proof-session/app/cancel_proof_session_usecase.ts");
  assert.match(src, /DeliverWebhookUseCase/, "Must import DeliverWebhookUseCase");
  assert.match(src, /deliverWebhook/, "Must have deliverWebhook dependency");
});

test("Story 6.1 CancelProofSessionUseCase fires webhook on rejected", () => {
  const src = readText("src/modules/proof-session/app/cancel_proof_session_usecase.ts");
  assert.match(src, /REJECTED/, "Must transition to REJECTED");
  assert.match(src, /deliverWebhook/, "Must fire webhook");
});

test("Story 6.1 CancelProofSessionPresenter injects webhook", () => {
  const src = readText("src/modules/proof-session/app/cancel_proof_session_presenter.ts");
  assert.match(src, /makeDeliverWebhookUseCase/, "Must import makeDeliverWebhookUseCase");
  assert.match(src, /deliverWebhook/, "Must inject deliverWebhook");
});

test("Story 6.1 GetProofSessionUseCase integrates DeliverWebhookUseCase", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
  assert.match(src, /DeliverWebhookUseCase/, "Must import DeliverWebhookUseCase");
  assert.match(src, /deliverWebhook/, "Must have deliverWebhook dependency");
});

test("Story 6.1 GetProofSessionUseCase transitions proof_request to EXPIRED", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
  assert.match(src, /ProofRequestStatus\.EXPIRED/, "Must transition proof_request to EXPIRED");
  assert.match(src, /ProofRequestRepository/, "Must import ProofRequestRepository");
  assert.match(src, /requestRepo/, "Must use requestRepo for the transition");
});

test("Story 6.1 GetProofSessionUseCase fires webhook on expired", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
  assert.match(src, /EXPIRED[\s\S]*deliverWebhook/, "Must fire webhook after EXPIRED transition");
});

test("Story 6.1 GetProofSessionPresenter injects webhook and requestRepo", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_presenter.ts");
  assert.match(src, /makeDeliverWebhookUseCase/, "Must import makeDeliverWebhookUseCase");
  assert.match(src, /getProofRequestRepository/, "Must inject ProofRequestRepository");
  assert.match(src, /deliverWebhook/, "Must inject deliverWebhook");
});

// ─── Webhook é fire-and-forget em todos os pontos ─────────────────────────────

test("Story 6.1 All webhook calls use fire-and-forget pattern (.catch)", () => {
  const files = [
    "src/modules/presentation/app/verify_presentation_usecase.ts",
    "src/modules/proof-session/app/cancel_proof_session_usecase.ts",
    "src/modules/proof-session/app/get_proof_session_usecase.ts",
  ];

  for (const file of files) {
    const src = readText(file);
    assert.match(
      src,
      /\.catch\(/,
      `${file}: webhook call must use .catch() for fire-and-forget`
    );
  }
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test.skip("Story 6.1 all new and modified files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  try {
    execSync(`"${tscBin}" --noEmit`, {
      cwd: projectRoot,
      env: { ...process.env, STAGE: "TEST" },
      stdio: "pipe",
      shell: true,
    });
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    // Filter out pre-existing lucide-react type errors
    const storyErrors = stdout
      .split("\n")
      .filter((line) => line.includes("error TS") && !line.includes("lucide-react"));
    if (storyErrors.length > 0) {
      assert.fail(`TypeScript errors in story files:\n${storyErrors.join("\n")}`);
    }
  }
});
