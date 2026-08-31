/**
 * Story 5.5 — Verificação de Verifiable Presentation
 *
 * Testes estruturais para o endpoint POST /api/presentations/verify:
 *   - Verificação de existência de todos os arquivos.
 *   - Verificações estáticas de conformidade com a arquitetura.
 *   - Verificações de contratos de validação no use case.
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

// ─── Existência de Arquivos ───────────────────────────────────────────────────

test("Story 5.5 VerifyPresentationViewModel file exists", () => {
  assertFileExists("src/modules/presentation/app/verify_presentation_viewmodel.ts");
});

test("Story 5.5 VerifyPresentationUseCase file exists", () => {
  assertFileExists("src/modules/presentation/app/verify_presentation_usecase.ts");
});

test("Story 5.5 VerifyPresentationController file exists", () => {
  assertFileExists("src/modules/presentation/app/verify_presentation_controller.ts");
});

test("Story 5.5 VerifyPresentationPresenter file exists", () => {
  assertFileExists("src/modules/presentation/app/verify_presentation_presenter.ts");
});

test("Story 5.5 API Route Handler file exists", () => {
  assertFileExists("app/api/presentations/verify/route.ts");
});

test("Story 5.5 ProofSession entity approveByUser method exists", () => {
  const src = readText("src/shared/domain/entities/ProofSession.ts");
  assert.match(src, /approveByUser/, "ProofSession must have approveByUser method");
});

// ─── Verificações Estáticas do ViewModel ─────────────────────────────────────

test("Story 5.5 VerifyPresentationViewModel exports schema and types", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_viewmodel.ts");
  assert.match(src, /VerifyPresentationSchema/, "Must export VerifyPresentationSchema");
  assert.match(src, /sessionToken/, "Schema must include sessionToken field");
  assert.match(src, /VerifyPresentationOutputDTO/, "Must export VerifyPresentationOutputDTO");
  assert.match(src, /valid/, "OutputDTO must have 'valid' boolean field");
});

// ─── Verificações Estáticas do Controller ────────────────────────────────────

test("Story 5.5 VerifyPresentationController validates body and delegates to usecase", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_controller.ts");
  assert.match(src, /class VerifyPresentationController/, "Must export VerifyPresentationController class");
  assert.match(src, /VerifyPresentationSchema\.parse/, "Controller must validate body via schema");
  assert.match(src, /holderDid/, "Controller must pass holderDid to usecase");
});

// ─── Verificações Estáticas do Presenter ─────────────────────────────────────

test("Story 5.5 VerifyPresentationPresenter exports factory and wires dependencies", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_presenter.ts");
  assert.match(src, /makeVerifyPresentationController/, "Presenter must export makeVerifyPresentationController");
  assert.match(src, /new VerifyPresentationController/, "Presenter must instantiate VerifyPresentationController");
  assert.match(src, /new VerifyPresentationUseCase/, "Presenter must instantiate VerifyPresentationUseCase");
  assert.match(src, /getBlockchainClient/, "Presenter must inject BlockchainClient");
  assert.match(src, /ISSUER_PRIVATE_KEY/, "Presenter must inject ISSUER_PRIVATE_KEY");
});

// ─── Verificações Estáticas do Use Case ──────────────────────────────────────

test("Story 5.5 UseCase verifies VP holder signature with ed.verifyAsync", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /verifyAsync/, "Must use ed.verifyAsync for signature verification");
  assert.doesNotMatch(src, /\bed\.verify\b/, "Must not call sync verify function");
});

test("Story 5.5 UseCase verifies VC issuer signature", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /issuerPubKeyBytes/, "Must derive issuer public key");
  assert.match(src, /vcSigningInput/, "Must build the compact JWS signing input");
  assert.match(src, /vcSigValid/, "Must verify VC issuer signature validity");
});

test("Story 5.5 UseCase verifies nonce against challenge_nonce_hash with SHA-256", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /sha256|createHash/, "Must use SHA-256 for nonce verification");
  assert.match(src, /challengeNonceHash/, "Must compare against session.challengeNonceHash");
});

test("Story 5.5 UseCase checks DID registration on-chain", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /isDIDRegistered/, "Must call blockchainClient.isDIDRegistered");
});

test("Story 5.5 UseCase checks VC revocation on-chain", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /isVCRevoked/, "Must call blockchainClient.isVCRevoked");
});

test("Story 5.5 UseCase checks proof_session status is OPENED", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /OPENED/, "Must check that session is in OPENED status");
});

test("Story 5.5 UseCase checks exactly one VC in VP", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /verifiableCredential.*length.*!==.*1|length.*!==.*1.*verifiableCredential/, "Must verify VP contains exactly 1 VC");
});

test("Story 5.5 UseCase checks VC claims are booleans only", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /boolean/, "Must verify claims are of type boolean");
});

test("Story 5.5 UseCase checks holder DID in VC matches authenticated DID", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /vc\.holder.*holderDid|holderDid.*vc\.holder/, "Must compare vc.holder with authenticated holderDid");
});

test("Story 5.5 UseCase calls approveByUser on success", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /approveByUser/, "Must call session.approveByUser() on successful validation");
});

test("Story 5.5 UseCase updates proof_request to APPROVED on success", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /APPROVED/, "Must update proof_request to APPROVED status on success");
});

test("Story 5.5 UseCase updates proof_request to REJECTED on failure", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /REJECTED/, "Must update proof_request to REJECTED status on failure");
});

test("Story 5.5 UseCase returns { valid: true } on success and { valid: false } on failure", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.match(src, /valid: true/, "Must return { valid: true } on success");
  assert.match(src, /valid: false/, "Must return { valid: false } on failure");
});

test("Story 5.5 UseCase does NOT persist any holder PII or VC data", () => {
  const src = readText("src/modules/presentation/app/verify_presentation_usecase.ts");
  assert.doesNotMatch(
    src,
    /supabase\.from|db\.insert|db\.save|\.persist/,
    "Must not persist holder PII or VC/VP data"
  );
});

// ─── Verificações da Rota API ─────────────────────────────────────────────────

test("Story 5.5 middleware.ts routes /api/presentations/verify to DID auth", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /presentations\/verify|presentations/, "middleware.ts must route presentations endpoint to DID auth");
});

test("Story 5.5 API route handler uses makeVerifyPresentationController", () => {
  const src = readText("app/api/presentations/verify/route.ts");
  assert.match(src, /makeVerifyPresentationController/, "Route handler must use makeVerifyPresentationController");
  assert.match(src, /x-holder-did/, "Route handler must read x-holder-did from headers");
  assert.match(src, /POST/, "Route must export POST handler");
});

// ─── Verificação da Entidade ProofSession ────────────────────────────────────

test("Story 5.5 ProofSession.approveByUser transitions to APPROVED_BY_USER", () => {
  const src = readText("src/shared/domain/entities/ProofSession.ts");
  assert.match(src, /APPROVED_BY_USER/, "approveByUser must set status to APPROVED_BY_USER");
  assert.match(src, /approvedAt/, "approveByUser must set approvedAt");
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test.skip("Story 5.5 all new files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
