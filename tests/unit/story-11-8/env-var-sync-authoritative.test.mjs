// Story 11.8 — Sync AUTORITATIVO de env vars no Amplify (derivado do
// `.env.local.example`), em substituição ao modelo de MERGE da Story 11.5.
//
// Cobre explicitamente:
//  - AC1: nomes derivados do `.env.local.example` (ignora comentários/linhas vazias)
//  - AC2: valor resolvido por colocação — Secrets primeiro, senão Variables;
//         nome sem valor em nenhum dos dois é omitido do payload
//  - AC3: replace autoritativo via `update-branch` — sem `get-branch`/merge
//  - AC4: orquestrador passa `github-variables-json`/`github-secrets-json`
//         via `toJSON(vars)`/`toJSON(secrets)`; input antigo removido
//  - AC5: secrets de infra (AWS_*, AMPLIFY_*, etc.) não vazam para o Amplify
//         por não constarem no `.env.local.example`; nada é ecoado nos logs
//  - AC6: `.env.local.example` não lista mais `YAID_VERIFICATION_BASE_URL`
//
// Parse real via `js-yaml`; GitHub Actions/AWS não rodam no sandbox — mesmo
// padrão estrutural/de contrato das Stories 11.2–11.7.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const actionPath = resolve(repoRoot, ".github/jobs/deploy-amplify/action.yml");
const workflowPath = resolve(repoRoot, ".github/workflows/production.yml");
const envExamplePath = resolve(repoRoot, ".env.local.example");

function readRaw(path) {
  return readFileSync(path, "utf8");
}
function loadYaml(path) {
  return yaml.load(readRaw(path));
}
function stepsOf(node) {
  return Array.isArray(node?.steps) ? node.steps : [];
}
function syncStepOf(action) {
  const steps = stepsOf(action.runs);
  return steps.find(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
}
function namesFromEnvExample() {
  return readRaw(envExamplePath)
    .split("\n")
    .filter((line) => !/^\s*#/.test(line) && line.trim() !== "")
    .map((line) => line.replace(/=.*/, "").trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// AC1 — nomes derivados do .env.local.example
// ---------------------------------------------------------------------------

test("AC1: o step de sync referencia .env.local.example para derivar os nomes", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  assert.ok(syncStep, "deve haver um step que roda amplify update-branch");
  assert.ok(
    /\.env\.local\.example/.test(syncStep.run),
    "o step deve ler .env.local.example para obter os nomes",
  );
});

test("AC1: o step ignora comentários e linhas vazias ao extrair os nomes (grep -v)", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  assert.ok(
    /grep\s+-v/.test(syncStep.run),
    "deve haver filtragem de comentários/linhas vazias (grep -v) antes de extrair os nomes",
  );
});

test("AC1: .env.local.example NÃO lista YAID_VERIFICATION_BASE_URL (AC6)", () => {
  const names = namesFromEnvExample();
  assert.ok(
    !names.includes("YAID_VERIFICATION_BASE_URL"),
    ".env.local.example não deve mais listar YAID_VERIFICATION_BASE_URL (é derivada)",
  );
});

test("AC1: .env.local.example lista exatamente os 13 nomes canônicos", () => {
  const expected = [
    "STAGE",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_DB_PASSWORD",
    "BLOCKCHAIN_RPC_URL",
    "BLOCKCHAIN_WALLET_PRIVATE_KEY",
    "BLOCKCHAIN_CONTRACT_ADDRESS",
    "ISSUER_PRIVATE_KEY",
    "WEBHOOK_SIGNING_PRIVATE_KEY",
    "OCR_API_URL",
    "OCR_API_KEY",
  ].sort();
  const actual = namesFromEnvExample().sort();
  assert.deepEqual(actual, expected);
});

// ---------------------------------------------------------------------------
// AC2 — resolução de valor por colocação: Secrets antes de Variables
// ---------------------------------------------------------------------------

test("AC2: o step resolve o valor primeiro em SECRETS_JSON, com fallback para VARS_JSON", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  const secretsIdx = syncStep.run.indexOf("SECRETS_JSON");
  const varsIdx = syncStep.run.indexOf("VARS_JSON");
  assert.ok(secretsIdx >= 0, "o step deve referenciar SECRETS_JSON");
  assert.ok(varsIdx >= 0, "o step deve referenciar VARS_JSON");
  assert.ok(
    secretsIdx < varsIdx,
    "SECRETS_JSON deve ser consultado antes de VARS_JSON (Secrets tem prioridade)",
  );
});

test("AC2: nomes sem valor em Secrets nem Variables são omitidos do payload (continue)", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  assert.ok(
    /\[\s*-z\s+"\$value"\s*\]\s*&&\s*continue/.test(syncStep.run),
    "um valor vazio (ausente em Secrets e Variables) deve pular a inclusão no payload",
  );
});

test("AC2: o input github-secrets-json e github-variables-json são required no composite", () => {
  const action = loadYaml(actionPath);
  assert.equal(action.inputs["github-secrets-json"].required, true);
  assert.equal(action.inputs["github-variables-json"].required, true);
});

// ---------------------------------------------------------------------------
// AC3 — replace autoritativo, sem get-branch/merge
// ---------------------------------------------------------------------------

test("AC3: o step NÃO chama amplify get-branch (sem leitura prévia do estado)", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  assert.ok(!/amplify get-branch/.test(syncStep.run));
});

test("AC3: o step NÃO faz merge via jq (sem operador `*` de precedência de objetos)", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  assert.ok(
    !/--argjson\s+current/.test(syncStep.run),
    "não deve haver variável `current` (estado lido do branch) no payload jq",
  );
});

test("AC3: o update-branch envia environmentVariables via --cli-input-json", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  assert.ok(/amplify update-branch/.test(syncStep.run));
  assert.ok(/--cli-input-json/.test(syncStep.run));
  assert.ok(/environmentVariables/.test(syncStep.run));
});

// ---------------------------------------------------------------------------
// AC4 — orquestrador passa toJSON(vars)/toJSON(secrets); input antigo removido
// ---------------------------------------------------------------------------

test("AC4: production.yml passa github-variables-json via toJSON(vars)", () => {
  const workflow = loadYaml(workflowPath);
  const compositeStep = stepsOf(workflow.jobs["deploy-amplify"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  assert.equal(
    compositeStep.with["github-variables-json"],
    "${{ toJSON(vars) }}",
  );
});

test("AC4: production.yml passa github-secrets-json via toJSON(secrets)", () => {
  const workflow = loadYaml(workflowPath);
  const compositeStep = stepsOf(workflow.jobs["deploy-amplify"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  assert.equal(
    compositeStep.with["github-secrets-json"],
    "${{ toJSON(secrets) }}",
  );
});

test("AC4: o input amplify-environment-variables foi removido do composite e do orquestrador", () => {
  const action = loadYaml(actionPath);
  const workflow = loadYaml(workflowPath);
  const compositeStep = stepsOf(workflow.jobs["deploy-amplify"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  assert.equal(action.inputs["amplify-environment-variables"], undefined);
  assert.equal(compositeStep.with["amplify-environment-variables"], undefined);
});

// ---------------------------------------------------------------------------
// AC5 — secrets de infra não vazam; nada ecoado nos logs
// ---------------------------------------------------------------------------

test("AC5: secrets de infra (AWS_*, AMPLIFY_*, SUPABASE_ACCESS_TOKEN, GITHUB_TOKEN) não constam no .env.local.example", () => {
  const names = namesFromEnvExample();
  const infraNames = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_DEPLOY_ROLE_ARN",
    "AMPLIFY_APP_ID",
    "AMPLIFY_BRANCH_NAME",
    "SUPABASE_ACCESS_TOKEN",
    "GITHUB_TOKEN",
  ];
  for (const n of infraNames) {
    assert.ok(!names.includes(n), `${n} não deve constar no .env.local.example`);
  }
});

test("AC5: o step de sync não ecoa SECRETS_JSON/VARS_JSON/payload nos logs", () => {
  const action = loadYaml(actionPath);
  const syncStep = syncStepOf(action);
  const leaks =
    /\b(echo|printf|cat|printenv)\b[^\n]*\$?\{?\s*(SECRETS_JSON|VARS_JSON|payload)/i.test(
      syncStep.run,
    );
  assert.ok(!leaks, "o step não pode ecoar SECRETS_JSON/VARS_JSON/payload nos logs");
});
