/**
 * Story 9.2 — verificação estrutural da VC-JWT em presentations/verify.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const useCasePath = path.join(
  projectRoot,
  "src/modules/presentation/app/verify_presentation_usecase.ts"
);
const source = readFileSync(useCasePath, "utf8");

test("Story 9.2 accepts exactly one compact VC-JWT string", () => {
  assert.match(source, /verifiableCredential:\s*string\[\]/);
  assert.match(source, /verifiableCredential\[0\]/);
  assert.match(source, /split\(["']\.['"]\)/);
});

test("Story 9.2 allow-lists EdDSA, JWT and the configured issuer key id", () => {
  assert.match(source, /alg\s*!==\s*["']EdDSA["']/);
  assert.match(source, /typ\s*!==\s*["']JWT["']/);
  assert.match(source, /kid\s*!==/);
  assert.match(source, /iss\s*!==/);
});

test("Story 9.2 verifies the original compact JWS signing input", () => {
  assert.match(source, /headerSegment/);
  assert.match(source, /payloadSegment/);
  assert.match(source, /verifyAsync/);
});

test("Story 9.2 maps JWT jti, sub and vc to the existing validation rules", () => {
  assert.match(source, /jti/);
  assert.match(source, /sub/);
  assert.match(source, /isVCRevoked\(vc\.id\)/);
  assert.match(source, /vc\.holder.*holderDid|holderDid.*vc\.holder/);
  assert.match(source, /vc\.claims\[\s*claimKey\s*\]\s*!==\s*true/);
});

test("Story 9.2 no longer reads the legacy embedded VC proof", () => {
  assert.doesNotMatch(source, /vc\.proof\.signatureValue/);
  assert.doesNotMatch(source, /interface VcProof/);
});

test("Story 9.2 compiles without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
