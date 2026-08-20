/**
 * Story 9.1 — Emissão da VC como VC-JWT (EdDSA)
 *
 * Testes para a migração da emissão de JSON-LD (proof.Ed25519Signature2020) para
 * VC-JWT compacto assinado com EdDSA via @noble/ed25519:
 *   - Verificação de arquivos existentes.
 *   - Verificações estáticas de conformidade com o formato JWT prescrito.
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

test("Story 9.1 IssueCredentialUseCase file exists", () => {
  assertFileExists("src/modules/credential/app/issue_credential_usecase.ts");
});

test("Story 9.1 IssueCredentialController file exists", () => {
  assertFileExists("src/modules/credential/app/issue_credential_controller.ts");
});

test("Story 9.1 API Route Handler file exists", () => {
  assertFileExists("app/api/credentials/issue/route.ts");
});

// ─── Verificações Estáticas — Formato do JWT ──────────────────────────────────

test("Story 9.1 IssueCredentialUseCase no longer builds the old JSON-LD proof", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.doesNotMatch(src, /Ed25519Signature2020/, "Must not reference the old Ed25519Signature2020 proof type");
  assert.doesNotMatch(src, /proofPurpose/, "Must not build the old JSON-LD proof object");
  assert.doesNotMatch(src, /type\s*=\s*\["VerifiableCredential"\]/, "Must not build the old top-level type array");
});

test("Story 9.1 IssueCredentialUseCase builds a JWT header with EdDSA/JWT/kid", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /alg:\s*"EdDSA"/, "Header must declare alg: EdDSA");
  assert.match(src, /typ:\s*"JWT"/, "Header must declare typ: JWT");
  assert.match(src, /kid:\s*`\$\{issuerDid\}#key-1`/, "Header kid must be <issuerDid>#key-1");
});

test("Story 9.1 IssueCredentialUseCase builds a JWT payload with iss/sub/jti/iat/nbf/vc", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /iss:\s*issuerDid/, "Payload must carry iss as the issuer DID");
  assert.match(src, /sub:\s*holderDid/, "Payload must carry sub as the holder DID");
  assert.match(src, /jti:\s*id/, "Payload must carry jti");
  assert.match(src, /iat:\s*now/, "Payload must carry iat");
  assert.match(src, /nbf:\s*now/, "Payload must carry nbf");
  assert.match(src, /vc:\s*claims/, "Payload must carry the boolean claims under vc");
});

test("Story 9.1 IssueCredentialUseCase signs the compact JWS with ed.signAsync over base64url(header).base64url(payload)", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /signingInput/, "Must build a signingInput string (header.payload)");
  assert.match(src, /ed\.signAsync\(new TextEncoder\(\)\.encode\(signingInput\), privateKeyBytes\)/, "Must sign the signingInput with ed.signAsync");
  assert.match(src, /`\$\{signingInput\}\.\$\{bytesToBase64url\(/, "Must append the base64url signature as the third JWT segment");
});

test("Story 9.1 IssueCredentialUseCase execute() returns a string (the VC-JWT), not an object", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /execute\(input: IssueCredentialInput\): Promise<string>/, "execute() must return Promise<string>");
  assert.match(src, /return vcJwt;/, "Must return the vcJwt string");
});

test("Story 9.1 IssueCredentialUseCase preserves OCR-in-memory, claims consolidation, and on-chain DID registration", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /ocrProvider\.processDocument/, "Must still call processDocument on OcrProvider");
  assert.match(src, /PROOF_TYPE_CLAIM_KEY\[ProofType\.PERSONHOOD\]/, "Must still consolidate the personhood claim");
  assert.match(src, /PROOF_TYPE_CLAIM_KEY\[ProofType\.AGE_OVER_18\]/, "Must still consolidate the ageOver18 claim");
  assert.match(src, /blockchainClient\.registerDID/, "Must still call registerDID on BlockchainClient");
  assert.match(src, /401/, "Must still throw 401 on signature failure");
  assert.match(src, /422/, "Must still throw 422 on OCR/age validation failure");
  assert.match(src, /502|BAD_GATEWAY/, "Must still throw 502/BAD_GATEWAY on blockchain failure");
});

test("Story 9.1 IssueCredentialUseCase does not touch the ISSUER_PRIVATE_KEY test-placeholder substitution (Epic 10 scope)", () => {
  const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
  assert.match(src, /test-issuer-private-key/, "Must keep the existing test-placeholder substitution untouched");
});

// ─── Verificações Estáticas — Controller/Rota ────────────────────────────────

test("Story 9.1 IssueCredentialController propagates a string (JWT) return type", () => {
  const src = readText("src/modules/credential/app/issue_credential_controller.ts");
  assert.match(src, /handle\(input: \{[\s\S]*?\}\): Promise<string>/, "Controller handle() must return Promise<string>");
  assert.doesNotMatch(src, /VerifiableCredential/, "Controller must no longer reference the old VerifiableCredential type");
});

test("Story 9.1 API route handler returns the VC-JWT with status 201", () => {
  const src = readText("app/api/credentials/issue/route.ts");
  assert.match(src, /makeIssueCredentialController/, "Route handler must still use the presenter");
  // NextResponse.json(vcJwt, ...) would JSON-encode the compact JWT string,
  // wrapping it in literal quote characters the client never expects — the
  // response must be the raw compact JWT text (see MOBILE-API-CONTRACT.md §4.1).
  assert.doesNotMatch(src, /NextResponse\.json\(vcJwt/, "Route must not JSON-encode the JWT string");
  assert.match(src, /new NextResponse\(vcJwt, \{[\s\S]*?status: 201/, "Route must return the raw JWT string with status 201");
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test("Story 9.1 all changed files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
