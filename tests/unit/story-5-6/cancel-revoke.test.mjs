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
const assertFileExists = (rel) => assert.ok(existsSync(fromRoot(rel)), `${rel} should exist`);

test("Story 5.6 cancel route and revoke route files exist", () => {
  assertFileExists("app/api/proof-sessions/[sessionToken]/cancel/route.ts");
  assertFileExists("app/api/credentials/revoke/route.ts");
});

test("Story 5.6 cancel use case and viewmodel exist", () => {
  assertFileExists("src/modules/proof-session/app/cancel_proof_session_usecase.ts");
  assertFileExists("src/modules/proof-session/app/cancel_proof_session_viewmodel.ts");
  assertFileExists("src/modules/proof-session/app/cancel_proof_session_controller.ts");
  assertFileExists("src/modules/proof-session/app/cancel_proof_session_presenter.ts");
});

test("Story 5.6 revoke use case and viewmodel exist", () => {
  assertFileExists("src/modules/credential/app/revoke_credential_usecase.ts");
  assertFileExists("src/modules/credential/app/revoke_credential_viewmodel.ts");
  assertFileExists("src/modules/credential/app/revoke_credential_controller.ts");
  assertFileExists("src/modules/credential/app/revoke_credential_presenter.ts");
});

test("Story 5.6 cancel flow transitions session and request status", () => {
  const src = readText("src/modules/proof-session/app/cancel_proof_session_usecase.ts");
  assert.match(src, /CANCELLED/, "Use case must transition session to CANCELLED");
  assert.match(src, /REJECTED/, "Use case must transition proof request to REJECTED");
  assert.match(src, /Session already in terminal state/, "Use case must reject terminal-state sessions");
});

test("Story 5.6 revoke flow validates holder signature before blockchain call", () => {
  const src = readText("src/modules/credential/app/revoke_credential_usecase.ts");
  assert.match(src, /verifyAsync/, "Use case must verify the holder signature");
  assert.match(src, /revokeVC/, "Use case must call BlockchainClient.revokeVC");
  assert.match(src, /revoked: true/, "Use case must return a revoked=true response payload");
});

test("Story 5.6 routes use the right presenter and auth context", () => {
  const cancelRoute = readText("app/api/proof-sessions/[sessionToken]/cancel/route.ts");
  const revokeRoute = readText("app/api/credentials/revoke/route.ts");
  assert.match(cancelRoute, /makeCancelProofSessionController/, "Cancel route must use the cancel presenter");
  assert.match(cancelRoute, /x-holder-did/, "Cancel route must read x-holder-did from headers");
  assert.match(revokeRoute, /makeRevokeCredentialController/, "Revoke route must use the revoke presenter");
  assert.match(revokeRoute, /x-holder-did/, "Revoke route must read x-holder-did from headers");
});

test("Story 5.6 all new files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc"
  );
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
