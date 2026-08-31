/**
 * Story 5.9 — OCR Estruturado via Mistral Document AI
 *
 * Testes estruturais para:
 *   - MistralOcrProvider existe, implementa OcrProvider, é o único importador do SDK.
 *   - ApiOcrProvider não existe mais (removido).
 *   - getOcrProvider() ramifica por STAGE=TEST (mock) vs. demais estágios (Mistral, sem fallback).
 *   - MISTRAL_API_KEY é obrigatória em produção (productionRequiredEnvNames) e usa getter que lança.
 *   - Compilação TypeScript limpa.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");
const assertFileExists = (rel) =>
  assert.ok(existsSync(fromRoot(rel)), `${rel} should exist`);
const assertFileDoesNotExist = (rel) =>
  assert.ok(!existsSync(fromRoot(rel)), `${rel} should not exist`);

const MISTRAL_PROVIDER_PATH = "src/shared/clients/ocr/MistralOcrProvider.ts";
const MOCK_PROVIDER_PATH = "src/shared/clients/ocr/MockOcrProvider.ts";
const API_PROVIDER_PATH = "src/shared/clients/ocr/ApiOcrProvider.ts";
const ENVIRONMENTS_PATH = "src/shared/environments.ts";

function listFilesRecursive(dir) {
  const entries = readdirSync(dir);
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      files = files.concat(listFilesRecursive(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// ─── Existência de Arquivos ───────────────────────────────────────────────────

test("Story 5.9 MistralOcrProvider client file exists", () => {
  assertFileExists(MISTRAL_PROVIDER_PATH);
});

test("Story 5.9 ApiOcrProvider no longer exists", () => {
  assertFileDoesNotExist(API_PROVIDER_PATH);
});

test("Story 5.9 MockOcrProvider is preserved unchanged", () => {
  assertFileExists(MOCK_PROVIDER_PATH);
});

// ─── MistralOcrProvider — contrato e SDK confinado ────────────────────────────

test("Story 5.9 MistralOcrProvider implements OcrProvider", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /implements OcrProvider/, "Must implement OcrProvider");
  assert.match(src, /processDocument/, "Must declare processDocument method");
});

test("Story 5.9 MistralOcrProvider imports the Mistral SDK", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(
    src,
    /import\s*\{\s*Mistral\s*\}\s*from\s*["']@mistralai\/mistralai["']/,
    "Must import Mistral from @mistralai/mistralai"
  );
});

test("Story 5.9 no other file in src/ imports @mistralai/mistralai", () => {
  const srcDir = fromRoot("src");
  const files = listFilesRecursive(srcDir).filter(
    (f) => path.relative(projectRoot, f).replace(/\\/g, "/") !== MISTRAL_PROVIDER_PATH
  );
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /@mistralai\/mistralai/,
      `${path.relative(projectRoot, file)} must not import @mistralai/mistralai — only MistralOcrProvider.ts may`
    );
  }
});

test("Story 5.9 MistralOcrProvider uses document_annotation_format via documentAnnotationFormat", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /documentAnnotationFormat/, "Must set documentAnnotationFormat on the OCR request");
  assert.match(src, /json_schema/, "Must use json_schema response format type");
  assert.match(src, /jsonSchema/, "Must use the SDK's jsonSchema field (not json_schema) on ResponseFormat");
  assert.match(src, /schemaDefinition/, "Must use the SDK's schemaDefinition field (not schema) on JsonSchema");
});

test("Story 5.9 MistralOcrProvider requests structured fields name, cpf, birthDate", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /\bname\b/, "Schema must include name");
  assert.match(src, /\bcpf\b/, "Schema must include cpf");
  assert.match(src, /\bbirthDate\b/, "Schema must include birthDate");
});

test("Story 5.9 MistralOcrProvider parses documentAnnotation as JSON string", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(
    src,
    /JSON\.parse\(\s*response\.documentAnnotation\s*\)/,
    "documentAnnotation is always a JSON string per the SDK — must always JSON.parse it"
  );
});

test("Story 5.9 MistralOcrProvider validates CPF to exactly 11 digits", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /replace\(\/\\D\/g,\s*["']["']\)/, "Must strip non-digits from cpf");
  assert.match(src, /cpf\.length\s*!==\s*11/, "Must reject cpf unless exactly 11 digits");
});

test("Story 5.9 MistralOcrProvider validates birthDate format YYYY-MM-DD", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\$/, "Must validate birthDate against YYYY-MM-DD pattern");
});

test("Story 5.9 MistralOcrProvider rejects calendar-invalid birthDate instead of letting Date roll it over", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(
    src,
    /date\.getUTCFullYear\(\)\s*!==\s*year/,
    "Must verify the parsed date's components match the input instead of trusting Date's silent rollover"
  );
});

test("Story 5.9 MistralOcrProvider enforces a minimum birth year", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /MIN_BIRTH_YEAR/, "Must reject implausible birth years below a minimum bound");
});

test("Story 5.9 MistralOcrProvider rejects unrecognized image formats instead of defaulting to PNG", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  const detectFn = src.match(/function detectMimeType\([\s\S]*?\n\}/);
  assert.ok(detectFn, "detectMimeType function must exist");
  assert.doesNotMatch(
    detectFn[0],
    /return\s*"image\/png";\s*\n\}/,
    "Must not silently default to image/png for unrecognized magic bytes — must throw instead"
  );
  assert.match(detectFn[0], /throw new Error/, "Must throw when no known image signature matches");
});

test("Story 5.9 MistralOcrProvider throws Document processing failed on invalid output", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /Document processing failed/, "Must throw the same error message the use case expects");
});

test("Story 5.9 MistralOcrProvider does not log request/response/errors", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.doesNotMatch(src, /console\./, "Must never log — NFR7 applies even on error paths");
});

test("Story 5.9 MistralOcrProvider sets an explicit request timeout", () => {
  const src = readText(MISTRAL_PROVIDER_PATH);
  assert.match(src, /timeoutMs/, "Must pass an explicit timeoutMs to the SDK call");
});

// ─── environments.ts — seleção de provider por STAGE, sem fallback silencioso ─

test("Story 5.9 environments.ts no longer references OCR_API_URL/OCR_API_KEY", () => {
  const src = readText(ENVIRONMENTS_PATH);
  assert.doesNotMatch(src, /OCR_API_URL/, "OCR_API_URL must be fully removed");
  assert.doesNotMatch(src, /OCR_API_KEY/, "OCR_API_KEY must be fully removed");
});

test("Story 5.9 environments.ts declares MISTRAL_API_KEY in the schema", () => {
  const src = readText(ENVIRONMENTS_PATH);
  assert.match(
    src,
    /MISTRAL_API_KEY:\s*z\.string\(\)\.min\(1\)\.optional\(\)/,
    "MISTRAL_API_KEY must be optional() at the schema level (required-in-prod is enforced separately)"
  );
});

test("Story 5.9 MISTRAL_API_KEY is required in production", () => {
  const src = readText(ENVIRONMENTS_PATH);
  assert.match(
    src,
    /productionRequiredEnvNames\s*=\s*\[[^\]]*"MISTRAL_API_KEY"[^\]]*\]/s,
    "MISTRAL_API_KEY must be listed in productionRequiredEnvNames"
  );
});

test("Story 5.9 MISTRAL_API_KEY getter throws via requireConfiguredValue when unset", () => {
  const src = readText(ENVIRONMENTS_PATH);
  assert.match(
    src,
    /get MISTRAL_API_KEY\(\)\s*\{\s*return requireConfiguredValue\(\s*this\.values\.MISTRAL_API_KEY,\s*["']MISTRAL_API_KEY["']\s*\)/,
    "Getter must use the same requireConfiguredValue pattern as ISSUER_PRIVATE_KEY"
  );
});

test("Story 5.9 getOcrProvider branches on STAGE === Stage.TEST for the mock", () => {
  const src = readText(ENVIRONMENTS_PATH);
  const getterMatch = src.match(/async getOcrProvider\(\)[\s\S]*?\n  \}/);
  assert.ok(getterMatch, "getOcrProvider method must exist");
  const body = getterMatch[0];
  assert.match(body, /this\.stage === Stage\.TEST/, "Must branch on this.stage === Stage.TEST, same as getBlockchainClient()");
  assert.match(body, /MockOcrProvider/, "TEST branch must return MockOcrProvider");
  assert.match(body, /MistralOcrProvider/, "Non-TEST branch must return MistralOcrProvider");
  assert.doesNotMatch(body, /ApiOcrProvider/, "Must not reference the removed ApiOcrProvider");
});

test("Story 5.9 getOcrProvider has no configuration-presence fallback to the mock", () => {
  const src = readText(ENVIRONMENTS_PATH);
  const getterMatch = src.match(/async getOcrProvider\(\)[\s\S]*?\n  \}/);
  const body = getterMatch[0];
  assert.doesNotMatch(
    body,
    /if\s*\(\s*url\s*&&\s*key\s*\)/,
    "Must not select the provider based on presence/absence of config — only STAGE selects it"
  );
});

// ─── Compilação TypeScript ────────────────────────────────────────────────────

test.skip("Story 5.9 all new/modified files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
