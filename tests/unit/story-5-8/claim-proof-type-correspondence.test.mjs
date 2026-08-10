/**
 * Story 5.8 — Correspondência entre Claim Apresentada e Proof Type Solicitado
 *
 * Testes estruturais para o verify_presentation_usecase:
 *   - Carregamento da proof_request e leitura do proof_type real.
 *   - Extensão da Regra 5 exigindo correspondência claim ↔ proof_type.
 *   - Substituição do literal "verification" hardcoded no webhook.
 *   - Preservação das demais regras (1-4, 6-11) e do gate booleano original.
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

const USECASE_PATH = "src/modules/presentation/app/verify_presentation_usecase.ts";

// ─── Existência de Arquivos ───────────────────────────────────────────────────

test("Story 5.8 VerifyPresentationUseCase file exists", () => {
  assertFileExists(USECASE_PATH);
});

test("Story 5.8 shared ProofType enum file exists (created by Story 5.7)", () => {
  assertFileExists("src/shared/domain/enums/ProofType.ts");
});

// ─── Carregamento da proof_request e proof_type real ─────────────────────────

test("Story 5.8 UseCase imports ProofType and PROOF_TYPE_CLAIM_KEY", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /import\s*\{[^}]*ProofType[^}]*\}\s*from\s*["']@\/shared\/domain\/enums\/ProofType["']/,
    "Must import ProofType and PROOF_TYPE_CLAIM_KEY from the shared enum"
  );
  assert.match(src, /PROOF_TYPE_CLAIM_KEY/, "Must reference PROOF_TYPE_CLAIM_KEY");
});

test("Story 5.8 UseCase loads the proof_request via requestRepo.findById", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /this\.requestRepo\.findById\(\s*proofRequestId\s*\)/,
    "Must call requestRepo.findById(proofRequestId) to load the associated proof_request"
  );
});

test("Story 5.8 UseCase reads proofType from the loaded proof_request", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /\.request\.proofType/,
    "Must read proofType off the ProofRequestWithApp result (result.request.proofType)"
  );
});

// ─── Extensão da Regra 5: correspondência claim ↔ proof_type ────────────────

test("Story 5.8 UseCase preserves original boolean-only claims check", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /Object\.values\(vc\.claims\)\.some\(\(v\)\s*=>\s*typeof v !== "boolean"\)/,
    "Original Rule 5 boolean check must remain unchanged"
  );
});

test("Story 5.8 UseCase maps proof_type to a claim key via PROOF_TYPE_CLAIM_KEY", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /PROOF_TYPE_CLAIM_KEY\[\s*proofType as ProofType\s*\]/,
    "Must map the loaded proofType through PROOF_TYPE_CLAIM_KEY"
  );
});

test("Story 5.8 UseCase rejects when the mapped claim is not exactly true", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /vc\.claims\[\s*claimKey\s*\]\s*!==\s*true/,
    "Must reject unless vc.claims[claimKey] === true (covers both missing and false claim)"
  );
});

test("Story 5.8 UseCase defensively guards against an unmapped proof_type", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /!claimKey/,
    "Must guard against PROOF_TYPE_CLAIM_KEY returning no key for an unexpected proof_type"
  );
});

// ─── Preservação das demais regras (1-4, 6-11) ───────────────────────────────

test("Story 5.8 UseCase still verifies VP holder signature with ed.verifyAsync (Rule 2)", () => {
  const src = readText(USECASE_PATH);
  assert.match(src, /verifyAsync/, "Rule 2 must remain intact");
});

test("Story 5.8 UseCase still verifies VC issuer signature (Rule 4)", () => {
  const src = readText(USECASE_PATH);
  assert.match(src, /vcSigValid/, "Rule 4 must remain intact");
});

test("Story 5.8 UseCase still checks holder DID in VC matches authenticated DID (Rule 6)", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /vc\.holder.*holderDid|holderDid.*vc\.holder/,
    "Rule 6 must remain intact"
  );
});

test("Story 5.8 UseCase still checks nonce against challenge_nonce_hash (Rule 7)", () => {
  const src = readText(USECASE_PATH);
  assert.match(src, /challengeNonceHash/, "Rule 7 must remain intact");
});

test("Story 5.8 UseCase still checks DID registration on-chain (Rule 9)", () => {
  const src = readText(USECASE_PATH);
  assert.match(src, /isDIDRegistered/, "Rule 9 must remain intact");
});

test("Story 5.8 UseCase still checks VC revocation on-chain (Rule 10)", () => {
  const src = readText(USECASE_PATH);
  assert.match(src, /isVCRevoked/, "Rule 10 must remain intact");
});

test("Story 5.8 UseCase still checks proof_session status is OPENED (Rule 11)", () => {
  const src = readText(USECASE_PATH);
  assert.match(src, /ProofSessionStatus\.OPENED/, "Rule 11 must remain intact");
});

// ─── Webhook: proofType real em vez de literal hardcoded ────────────────────

test("Story 5.8 UseCase no longer hardcodes 'verification' as the webhook proofType", () => {
  const src = readText(USECASE_PATH);
  assert.doesNotMatch(
    src,
    /proofType:\s*"verification"/,
    "The hardcoded 'verification' literal must be replaced by the real proof_type"
  );
});

test("Story 5.8 fireWebhook receives proofType as a parameter", () => {
  const src = readText(USECASE_PATH);
  assert.match(
    src,
    /fireWebhook\([^)]*proofRequestId:\s*string[^)]*status:\s*ProofRequestStatus[^)]*proofType:\s*string/s,
    "fireWebhook signature must accept a proofType parameter"
  );
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test("Story 5.8 all modified files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
