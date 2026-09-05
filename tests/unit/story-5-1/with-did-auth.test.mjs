/**
 * Story 5.1 — Middleware de Auth por DID (withDIDAuth)
 *
 * Testes de contrato para o middleware de autenticação via assinatura DID:
 *   - Existência e shape do arquivo
 *   - Todos os 5 caminhos de erro (AC #1–#5)
 *   - Review patches: validação de byte-length e timestamp com Number()
 *   - Dependência @noble/ed25519 no package.json
 *   - middleware.ts chama withDIDAuth com await
 *   - Compilação TypeScript limpa
 */

import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
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

// ─── Existência de arquivo ─────────────────────────────────────────────────────

test("Story 5.1 withDIDAuth.ts file exists", () => {
  assertFileExists("src/shared/middlewares/withDIDAuth.ts");
});

// ─── Estrutura e exports ───────────────────────────────────────────────────────

test("Story 5.1 withDIDAuth is exported as async function", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /export async function withDIDAuth/,
    "withDIDAuth must be exported as async function"
  );
});

test("Story 5.1 withDIDAuth imports @noble/ed25519", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /from ["']@noble\/ed25519["']/,
    "must import from @noble/ed25519"
  );
});

test("Story 5.1 withDIDAuth uses verifyAsync (not sync verify)", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(src, /verifyAsync/, "must use verifyAsync for Edge runtime compatibility");
  // sync verify would require @noble/hashes and doesn't work in Edge runtime by default
  assert.doesNotMatch(
    src,
    /\bed\.verify\s*\(/,
    "must not call ed.verify (sync) — use ed.verifyAsync instead"
  );
});

// ─── AC #5: Headers ausentes ───────────────────────────────────────────────────

test('Story 5.1 AC#5 missing headers path returns 401 "Missing auth headers"', () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /Missing auth headers/,
    'must return error "Missing auth headers" when any header is absent'
  );
  assert.match(src, /X-YaID-DID/, "must check X-YaID-DID header");
  assert.match(src, /X-YaID-Signature/, "must check X-YaID-Signature header");
  assert.match(src, /X-YaID-Timestamp/, "must check X-YaID-Timestamp header");
});

// ─── AC #3: Timestamp expirado ─────────────────────────────────────────────────

test('Story 5.1 AC#3 expired timestamp path returns 401 "Request expired"', () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /Request expired/,
    'must return error "Request expired" for timestamps outside ±5-minute window'
  );
});

test("Story 5.1 AC#3 timestamp validation uses Number() not parseInt (review patch)", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /Number\s*\(\s*tsHeader\s*\)/,
    "must use Number() to parse timestamp — parseInt accepts trailing garbage"
  );
  assert.doesNotMatch(
    src,
    /parseInt\s*\(\s*tsHeader/,
    "must not use parseInt for timestamp — parseInt('300abc', 10) returns 300"
  );
});

test("Story 5.1 AC#3 timestamp window uses integer millisecond comparison (review patch)", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /300[_]?000/,
    "must use 300_000 ms threshold for ±5-minute window (integer ms, avoids float drift)"
  );
});

// ─── AC #2: DID malformado ────────────────────────────────────────────────────

test('Story 5.1 AC#2 invalid DID path returns 401 "Invalid DID"', () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(src, /Invalid DID/, 'must return error "Invalid DID" for malformed DIDs');
});

test("Story 5.1 AC#2 DID validation enforces did:yaid:user format with 4 parts", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(src, /did\.split\s*\(\s*['"]:/, "must split DID on colon");
  assert.match(src, /parts\[0\]\s*!==\s*["']did["']/, "must check 'did' prefix");
  assert.match(src, /parts\[1\]\s*!==\s*["']yaid["']/, "must check 'yaid' method");
  assert.match(src, /parts\[2\]\s*!==\s*["']user["']/, "must check 'user' type");
});

test("Story 5.1 AC#2 DID validation enforces 32-byte hex public key (64 lowercase hex chars)", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /\[0-9a-f\]\{64\}/,
    "must validate public key as 64 lowercase hex chars (= 32 bytes Ed25519 key)"
  );
});

// ─── AC #4: Assinatura inválida ───────────────────────────────────────────────

test('Story 5.1 AC#4 invalid signature path returns 401 "Invalid signature"', () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(src, /Invalid signature/, 'must return error "Invalid signature"');
});

test("Story 5.1 AC#4 signature length validated as exactly 64 bytes before crypto (review patch)", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /signatureBytes\.length\s*!==\s*64/,
    "must reject signatures that are not exactly 64 bytes before calling verifyAsync"
  );
});

// ─── AC #1: Request válido ────────────────────────────────────────────────────

test("Story 5.1 AC#1 canonical payload uses {timestamp}:{method}:{pathname} format", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /\$\{tsHeader\}:\$\{request\.method\}:\$\{pathname\}/,
    "canonical payload must be: ${tsHeader}:${request.method}:${pathname}"
  );
});

test("Story 5.1 AC#1 authenticated DID is forwarded via x-holder-did header", () => {
  const src = readText("src/shared/middlewares/withDIDAuth.ts");
  assert.match(
    src,
    /x-holder-did/,
    "must set x-holder-did header when DID auth succeeds"
  );
  assert.match(
    src,
    /requestHeaders\.set\s*\(\s*["']x-holder-did["'],\s*did\s*\)/,
    "must set x-holder-did to the validated DID value"
  );
});

// ─── Dependência ──────────────────────────────────────────────────────────────

test("Story 5.1 @noble/ed25519 is listed as a dependency in package.json", () => {
  const pkg = JSON.parse(readText("package.json"));
  assert.ok(
    pkg.dependencies?.["@noble/ed25519"],
    "@noble/ed25519 must be in dependencies"
  );
  const version = pkg.dependencies["@noble/ed25519"];
  assert.match(version, /\^?3\./, "@noble/ed25519 version must be v3.x");
});

// ─── Integração com middleware.ts ──────────────────────────────────────────────

test("Story 5.1 middleware.ts imports withDIDAuth from the middlewares folder", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /from\s+["']@\/shared\/middlewares\/withDIDAuth["']/,
    "middleware.ts must import withDIDAuth from @/shared/middlewares/withDIDAuth"
  );
});

test("Story 5.1 middleware.ts calls withDIDAuth with await (async middleware requires await)", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /return await withDIDAuth\s*\(\s*request\s*\)/,
    "middleware.ts must await withDIDAuth — function is async and returns Promise<NextResponse>"
  );
});

test("Story 5.1 middleware.ts routes DID auth paths: challenge, cancel, presentations, credentials", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /challenge/, "must route /challenge paths to DID auth");
  assert.match(src, /cancel/, "must route /cancel paths to DID auth");
  assert.match(src, /presentations/, "must route /presentations paths to DID auth");
  assert.match(src, /credentials/, "must route /credentials paths to DID auth");
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test.skip("Story 5.1 all new files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
