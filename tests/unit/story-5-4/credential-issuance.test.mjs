/**
 * Story 5.4 — Emissão de Verifiable Credential
 *
 * Testes para a emissão de credenciais com OCR em memória, assinatura Ed25519 e registro DID:
 *   - Verificação de arquivos existentes.
 *   - Verificações estáticas de conformidade com a arquitetura.
 *   - Compilação do TypeScript limpa.
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

test("Story 5.4 OcrProvider interface file exists", () => {
  assertFileExists("src/shared/domain/interfaces/OcrProvider.ts");
});

test("Story 5.4 MockOcrProvider client file exists", () => {
  assertFileExists("src/shared/clients/ocr/MockOcrProvider.ts");
});

test("Story 5.4 IssueCredentialUseCase file exists", () => {
  assertFileExists("src/modules/credential/app/issue_credential_usecase.ts");
});

test("Story 5.4 IssueCredentialViewModel file exists", () => {
  assertFileExists("src/modules/credential/app/issue_credential_viewmodel.ts");
});

test("Story 5.4 IssueCredentialController file exists", () => {
  assertFileExists("src/modules/credential/app/issue_credential_controller.ts");
});

test("Story 5.4 IssueCredentialPresenter file exists", () => {
  assertFileExists("src/modules/credential/app/issue_credential_presenter.ts");
});

test("Story 5.4 API Route Handler file exists", () => {
  assertFileExists("app/api/credentials/issue/route.ts");
});

// ─── Verificações Estáticas de Interface e Mock OCR ───────────────────────────

test("Story 5.4 OcrProvider interface is defined properly", () => {
  const src = readText("src/shared/domain/interfaces/OcrProvider.ts");
  assert.match(src, /interface OcrProvider/, "Must declare OcrProvider interface");
  assert.match(src, /processDocument/, "Must declare processDocument method");
});

test("Story 5.4 MockOcrProvider client implements OcrProvider and simulates errors", () => {
  const src = readText("src/shared/clients/ocr/MockOcrProvider.ts");
  assert.match(src, /implements OcrProvider/, "MockOcrProvider must implement OcrProvider");
  assert.match(src, /Document processing failed/, "MockOcrProvider must throw error on 'fail' or 'invalid'");
});

// ─── Verificações Estáticas de Arquitetura de Camadas ─────────────────────────

test("Story 5.4 IssueCredentialViewModel exposes validation schema", () => {
  const src = readText("src/modules/credential/app/issue_credential_viewmodel.ts");
  assert.match(src, /IssueCredentialSchema/, "ViewModel must export IssueCredentialSchema");
});

test("Story 5.4 IssueCredentialController parses body using validation schema", () => {
  const src = readText("src/modules/credential/app/issue_credential_controller.ts");
  assert.match(src, /class IssueCredentialController/, "Must export IssueCredentialController class");
  assert.match(src, /IssueCredentialSchema\.parse/, "Controller must validate request body via ViewModel schema");
});

test("Story 5.4 IssueCredentialPresenter builds controller injecting usecase", () => {
  const src = readText("src/modules/credential/app/issue_credential_presenter.ts");
  assert.match(src, /makeIssueCredentialController/, "Presenter must export makeIssueCredentialController factory");
  assert.match(src, /new IssueCredentialController/, "Presenter must instantiate IssueCredentialController");
  assert.match(src, /new IssueCredentialUseCase/, "Presenter must instantiate IssueCredentialUseCase");
});

// ─── Verificações Estáticas do Use Case ──────────────────────────────────────

test("Story 5.4 IssueCredentialUseCase signature validation uses verifyAsync", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /verifyAsync/, "Must call verifyAsync to validate signature");
  assert.doesNotMatch(src, /\bed\.verify\b/, "Must not call sync verify function");
});

test("Story 5.4 IssueCredentialUseCase processes OCR document in-memory", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /ocrProvider\.processDocument/, "Must call processDocument on OcrProvider");
  assert.doesNotMatch(
    src,
    /supabase|db\.insert|db\.save|persist/,
    "Must not persist PII or OCR results to a database"
  );
});

test("Story 5.4 IssueCredentialUseCase computes ageOver18 from birth date (superseded by Story 5.7 — claims are consolidated, minority no longer throws)", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /ageOver18/, "Must handle the ageOver18 claim");
  assert.match(src, /age\s*>=\s*18/, "Must compute age requirement as a boolean, not a rejection");
});

test("Story 5.4 IssueCredentialUseCase registers DID on-chain", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /blockchainClient\.registerDID/, "Must call registerDID on BlockchainClient");
});

test("Story 5.4 IssueCredentialUseCase signs VC as a compact VC-JWT (superseded by Story 9.1 — EdDSA JWS, not Ed25519Signature2020)", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /ed\.signAsync/, "Must sign VC using ed.signAsync");
  assert.match(src, /alg:\s*"EdDSA"/, "Must build a JWT header with alg: EdDSA");
  assert.match(src, /typ:\s*"JWT"/, "Must build a JWT header with typ: JWT");
});

test("Story 5.4 IssueCredentialUseCase propagates expected API error status codes", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /401/, "Must throw 401 on signature failure");
  assert.match(src, /422/, "Must throw 422 on OCR/age validation failure");
  assert.match(src, /502|BAD_GATEWAY/, "Must throw 502/BAD_GATEWAY on blockchain failure");
});

// ─── Verificações Estáticas da Rota API ───────────────────────────────────────

test("Story 5.4 middleware.ts routes credentials API matching pattern to DID auth", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /credentials/, "middleware.ts must route credential endpoints to DID auth");
});

test("Story 5.4 api route handler is implemented with IssueCredentialPresenter", () => {
  const src = readText("app/api/credentials/issue/route.ts");
  assert.match(src, /makeIssueCredentialController/, "Route handler must use makeIssueCredentialController presenter");
  assert.match(src, /x-holder-did/, "Route handler must read x-holder-did from headers");
  assert.match(src, /422/, "Route handler must map OCR failure to 422");
  assert.match(src, /502/, "Route handler must map blockchain failure to 502");
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test("Story 5.4 all new files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});

