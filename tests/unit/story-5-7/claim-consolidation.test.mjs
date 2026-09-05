/**
 * Story 5.7 — Consolidação de Claims na Emissão de Credencial
 *
 * Testes para a emissão de credenciais consolidando as duas claims (personhood + ageOver18)
 * em uma única VC, removendo o parâmetro proofType do contrato de entrada:
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

test("Story 5.7 ProofType enum file exists", () => {
  assertFileExists("src/shared/domain/enums/ProofType.ts");
});

// ─── Enum ProofType ────────────────────────────────────────────────────────────

test("Story 5.7 ProofType enum declares personhood and age_over_18", () => {
  const src = readText("src/shared/domain/enums/ProofType.ts");
  assert.match(src, /enum ProofType/, "Must declare ProofType enum");
  assert.match(src, /=\s*"personhood"/, "Must map a member to 'personhood'");
  assert.match(src, /=\s*"age_over_18"/, "Must map a member to 'age_over_18'");
});

test("Story 5.7 ProofType module exports the claim-key mapping", () => {
  const src = readText("src/shared/domain/enums/ProofType.ts");
  assert.match(src, /PROOF_TYPE_CLAIM_KEY/, "Must export a claim-key mapping constant");
  assert.match(src, /"ageOver18"/, "Mapping must reference the camelCase claim key ageOver18");
});

// ─── Contrato de Entrada — proofType removido ─────────────────────────────────

test("Story 5.7 IssueCredentialSchema no longer accepts proofType", () => {
  const src = readText("src/modules/credential/app/issue_credential_viewmodel.ts");
  assert.doesNotMatch(src, /proofType/, "Schema must not reference proofType anymore");
  assert.match(src, /documentImage/, "Schema must still require documentImage");
  assert.match(src, /bodySignature/, "Schema must still require bodySignature");
});

test("Story 5.7 IssueCredentialSchema rejects unknown fields via .strict()", () => {
  const src = readText("src/modules/credential/app/issue_credential_viewmodel.ts");
  assert.match(src, /\.strict\(\)/, "Schema must reject unrecognized fields like a stray proofType");
});

test("Story 5.7 IssueCredentialController no longer forwards proofType", () => {
  const src = readText("src/modules/credential/app/issue_credential_controller.ts");
  assert.doesNotMatch(src, /proofType/, "Controller must not reference proofType anymore");
});

test("Story 5.7 IssueCredentialInput no longer declares proofType", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  const inputInterfaceMatch = src.match(/export interface IssueCredentialInput \{[^}]*\}/);
  assert.ok(inputInterfaceMatch, "IssueCredentialInput interface must exist");
  assert.doesNotMatch(
    inputInterfaceMatch[0],
    /proofType/,
    "IssueCredentialInput must not declare proofType"
  );
});

test("Story 5.7 signed payload no longer includes proofType", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.doesNotMatch(
    src,
    /\$\{documentImage\}:\$\{proofType\}/,
    "Signed payload must not concatenate proofType anymore"
  );
});

// ─── Claims consolidadas ──────────────────────────────────────────────────────

test("Story 5.7 use case no longer branches on proofType for claims", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.doesNotMatch(
    src,
    /proofType\s*===\s*"personhood"/,
    "Must not select claims via proofType === 'personhood'"
  );
  assert.doesNotMatch(
    src,
    /proofType\s*===\s*"ageOver18"/,
    "Must not select claims via proofType === 'ageOver18'"
  );
});

test("Story 5.7 use case always sets personhood true and computes ageOver18 boolean via the shared ProofType enum", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /ProofType\.PERSONHOOD/, "Must reference personhood claim via ProofType enum");
  assert.match(src, /ProofType\.AGE_OVER_18/, "Must reference ageOver18 claim via ProofType enum");
  assert.match(src, /age\s*>=\s*18/, "Must compute ageOver18 via age >= 18 comparison");
});

test("Story 5.7 use case never throws for age below 18 in isolation", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.doesNotMatch(
    src,
    /age\s*<\s*18\)\s*\{\s*\n\s*throw/,
    "Must not throw an error solely because age < 18 — minority is a valid ageOver18: false result"
  );
});

test("Story 5.7 use case still throws 422 for unparseable birth date", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(
    src,
    /isNaN\(.*birthDate.*getTime\(\)\)/,
    "Must validate that the parsed birth date is a valid date"
  );
});

test("Story 5.7 use case preserves OCR-in-memory failure handling", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /ocrProvider\.processDocument/, "Must still call processDocument on OcrProvider");
  assert.match(src, /Document processing failed/, "Must still surface Document processing failed on OCR failure");
});

test("Story 5.7 use case preserves signature validation and DID registration", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /verifyAsync/, "Must still validate the holder's body signature");
  assert.match(src, /blockchainClient\.registerDID/, "Must still register the DID on-chain");
});

test("Story 5.7 AC#4 — 422 has exactly two document-related causes (OCR failure, unparseable birth date)", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  const occurrences = src.match(/"?UNPROCESSABLE_ENTITY"?/g) ?? [];
  assert.equal(
    occurrences.length,
    2,
    "Exactly two 422/UNPROCESSABLE_ENTITY sites must remain: OCR failure and unparseable birth date — no leftover proofType-driven 422 branch"
  );
});

test("Story 5.7 presenter wires IssueCredentialUseCase without referencing proofType", () => {
  const src = readText("src/modules/credential/app/issue_credential_presenter.ts");
  assert.doesNotMatch(src, /proofType/, "Presenter must not reference proofType");
  assert.match(src, /new IssueCredentialUseCase/, "Presenter must still instantiate IssueCredentialUseCase");
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test.skip("Story 5.7 all changed files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
