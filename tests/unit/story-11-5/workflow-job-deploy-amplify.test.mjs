// Story 11.5 — Composite `deploy-amplify` + job encadeado (`needs: deploy-supabase`).
//
// Testes estruturais/de contrato: GitHub Actions e a AWS não rodam no sandbox,
// então parseamos os YAMLs via `js-yaml` (devDependency desde a Story 11.2) e
// afirmamos sobre a estrutura parseada — além de checar o texto bruto para
// garantir que nenhum literal de secret vaze.
//
// Focos críticos:
//  - §5.4 (sync de env por MERGE): lê as vars atuais (get-branch) e reenvia o
//    mapa MESCLADO — nunca um overwrite cego do subconjunto novo.
//  - §5.7 (AssumeRole least-privilege): configure-aws-credentials usa
//    `role-to-assume` (bootstrap creds -> deploy role).
//  - §5.8 (polling finito): wait com timeout/max attempts e falha explícita em
//    estado terminal ≠ SUCCEED.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const actionPath = resolve(repoRoot, ".github/jobs/deploy-amplify/action.yml");
const workflowPath = resolve(repoRoot, ".github/workflows/production.yml");

function readRaw(path) {
  return readFileSync(path, "utf8");
}
function loadYaml(path) {
  return yaml.load(readRaw(path));
}
function stepsOf(node) {
  return Array.isArray(node?.steps) ? node.steps : [];
}

const REQUIRED_INPUTS = [
  "aws-region",
  "aws-role-to-assume",
  "amplify-app-id",
  "amplify-branch-name",
  "github-variables-json",
  "github-secrets-json",
];

const STATIC_CREDENTIAL_INPUTS = [
  "aws-access-key-id",
  "aws-secret-access-key",
  "aws-session-token",
];

// ---------------------------------------------------------------------------
// AC #1 — composite existe, parseia, e usa `composite`
// ---------------------------------------------------------------------------

test("AC1: .github/jobs/deploy-amplify/action.yml existe", () => {
  assert.ok(existsSync(actionPath), "action.yml do composite deploy-amplify deve existir");
});

test("AC1: action.yml é YAML válido e parseável", () => {
  assert.doesNotThrow(() => loadYaml(actionPath), "action.yml deve ser YAML válido");
  const doc = loadYaml(actionPath);
  assert.ok(doc && typeof doc === "object", "action.yml deve parsear para um objeto");
});

test("AC1: action.yml é um composite action (runs.using == composite)", () => {
  const doc = loadYaml(actionPath);
  assert.ok(doc.runs, "deve ter seção runs");
  assert.equal(doc.runs.using, "composite", "runs.using deve ser 'composite'");
  assert.ok(Array.isArray(doc.runs.steps), "runs.steps deve ser uma lista");
  assert.ok(doc.runs.steps.length > 0, "runs.steps não pode estar vazio");
});

// ---------------------------------------------------------------------------
// AC #2 — inputs necessários declarados e required
// ---------------------------------------------------------------------------

test("AC2: composite declara todos os inputs necessários", () => {
  const doc = loadYaml(actionPath);
  assert.ok(doc.inputs && typeof doc.inputs === "object", "deve haver seção inputs");
  for (const key of REQUIRED_INPUTS) {
    assert.ok(doc.inputs[key], `input '${key}' deve existir`);
  }
});

test("AC2: inputs necessários são required: true", () => {
  const doc = loadYaml(actionPath);
  for (const key of REQUIRED_INPUTS) {
    assert.equal(doc.inputs[key].required, true, `input '${key}' deve ser required: true`);
  }
});

// ---------------------------------------------------------------------------
// GitHub OIDC — regressão: nenhuma credencial estática, id-token: write
// ---------------------------------------------------------------------------

test("OIDC: nenhum input de credencial estática (access-key/secret-key/session-token) existe no composite", () => {
  const doc = loadYaml(actionPath);
  for (const key of STATIC_CREDENTIAL_INPUTS) {
    assert.ok(
      !doc.inputs || doc.inputs[key] === undefined,
      `input '${key}' não pode mais existir — migração para GitHub OIDC é troca completa, sem credenciais estáticas`,
    );
  }
});

test("OIDC: nenhum with: do job deploy-amplify referencia credenciais estáticas", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-amplify"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  assert.ok(compositeStep?.with, "o step do composite deve ter bloco with:");
  for (const key of STATIC_CREDENTIAL_INPUTS) {
    assert.ok(
      compositeStep.with[key] === undefined,
      `with.${key} não pode mais existir no job deploy-amplify (sem credenciais estáticas)`,
    );
  }
});

test("OIDC: job deploy-amplify declara permissions.id-token === 'write'", () => {
  const doc = loadYaml(workflowPath);
  const job = doc.jobs["deploy-amplify"];
  assert.ok(job.permissions, "job deploy-amplify deve declarar permissions");
  assert.equal(
    job.permissions["id-token"],
    "write",
    "job deploy-amplify deve declarar permissions.id-token: write (precondição do OIDC)",
  );
});

test("OIDC: job deploy-amplify mantém permissions.contents === 'read' (permissions no nível do job substitui, não mescla, o default do workflow)", () => {
  const doc = loadYaml(workflowPath);
  const job = doc.jobs["deploy-amplify"];
  assert.equal(
    job.permissions.contents,
    "read",
    "sem isso o actions/checkout perde acesso de leitura ao repositório assim que permissions.id-token é declarado no job",
  );
});

// ---------------------------------------------------------------------------
// AC #3 — auth AWS via configure-aws-credentials com AssumeRoleWithWebIdentity (OIDC); shell em todo run
// ---------------------------------------------------------------------------

test("AC3: composite autentica via aws-actions/configure-aws-credentials", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const authStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("aws-actions/configure-aws-credentials"),
  );
  assert.ok(authStep, "deve haver um step usando aws-actions/configure-aws-credentials");
});

test("AC3: auth usa AssumeRole (role-to-assume a partir do input do ARN)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const authStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("aws-actions/configure-aws-credentials"),
  );
  assert.ok(authStep?.with, "o step de auth deve ter bloco with:");
  assert.ok(
    authStep.with["role-to-assume"] !== undefined,
    "o step de auth deve declarar role-to-assume (sts:AssumeRole)",
  );
  assert.ok(
    /inputs\.aws-role-to-assume/.test(String(authStep.with["role-to-assume"])),
    "role-to-assume deve vir de inputs.aws-role-to-assume (não literal)",
  );
});

test("AC3: todo step com `run` declara `shell` (exigência de composite)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const runSteps = steps.filter((s) => typeof s.run === "string");
  assert.ok(runSteps.length > 0, "deve haver ao menos um step run");
  for (const s of runSteps) {
    assert.ok(
      typeof s.shell === "string" && s.shell.length > 0,
      `step run '${s.name ?? s.run}' deve declarar shell`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC #4 — Story 11.8: sync de env AUTORITATIVO (replace, sem get-branch/merge)
// ---------------------------------------------------------------------------

test("AC4 (Story 11.8): o sync NÃO lê o estado atual do branch (sem get-branch)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const syncStep = steps.find(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
  assert.ok(syncStep, "deve haver um step que faz amplify update-branch");
  assert.ok(
    !/amplify get-branch/.test(syncStep.run),
    "Story 11.8: o sync é replace autoritativo — não deve chamar `amplify get-branch`",
  );
});

test("AC4 (Story 11.8): os nomes são derivados do .env.local.example", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const syncStep = steps.find(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
  assert.ok(
    /\.env\.local\.example/.test(syncStep.run),
    "o sync deve derivar os nomes de env vars a partir do .env.local.example",
  );
});

test("AC4 (Story 11.8): o valor de cada nome é resolvido por Secrets, senão Variables", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const syncStep = steps.find(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
  const envRaw = JSON.stringify(syncStep.env ?? {});
  assert.ok(
    /inputs\.github-secrets-json/.test(envRaw) && /inputs\.github-variables-json/.test(envRaw),
    "o sync deve receber tanto o JSON de Secrets quanto o de Variables via inputs",
  );
  const secretsIdx = syncStep.run.indexOf("SECRETS_JSON");
  const varsIdx = syncStep.run.indexOf("VARS_JSON");
  assert.ok(secretsIdx >= 0 && varsIdx >= 0, "o step deve referenciar SECRETS_JSON e VARS_JSON");
  assert.ok(
    secretsIdx < varsIdx,
    "a resolução deve consultar Secrets ANTES de Variables (Secrets tem prioridade)",
  );
});

test("AC4 (Story 11.8): o update-branch envia o mapa resolvido como REPLACE total", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const syncStep = steps.find(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
  assert.ok(
    /environmentVariables/.test(syncStep.run),
    "o payload do update-branch deve setar environmentVariables com o mapa resolvido",
  );
});

// ---------------------------------------------------------------------------
// AC #5 — §5.8 CRÍTICO: start-job RELEASE + polling finito com falha em ≠ SUCCEED
// ---------------------------------------------------------------------------

test("AC5: existe step `amplify start-job` com --job-type RELEASE", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const startStep = steps.find(
    (s) => typeof s.run === "string" && /amplify start-job/.test(s.run),
  );
  assert.ok(startStep, "deve haver um step com `amplify start-job`");
  assert.ok(
    /--job-type\s+RELEASE/.test(startStep.run),
    "o start-job deve usar --job-type RELEASE",
  );
});

test("AC5 (§5.8): existe polling que consulta o status (get-job) até estado terminal", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const pollStep = steps.find(
    (s) => typeof s.run === "string" && /amplify get-job/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(pollStep, "deve haver um step de polling com loop consultando `amplify get-job`");
});

test("AC5 (§5.8): o polling é FINITO (timeout / max attempts), nunca infinito", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const pollStep = steps.find(
    (s) => typeof s.run === "string" && /amplify get-job/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(pollStep, "deve existir o step de polling");
  assert.ok(
    /max_attempts|max-attempts|maxAttempts|timeout/i.test(pollStep.run),
    "§5.8: o polling deve ter timeout / número máximo de tentativas",
  );
  // guardrail: não pode haver `while true` (loop infinito).
  assert.ok(
    !/while\s+true/.test(pollStep.run) && !/while\s+:/.test(pollStep.run),
    "§5.8: o polling NÃO pode ser um loop infinito (while true)",
  );
});

test("AC5 (§5.8): o polling falha explicitamente em estado terminal ≠ SUCCEED", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const pollStep = steps.find(
    (s) => typeof s.run === "string" && /amplify get-job/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(/SUCCEED/.test(pollStep.run), "o polling deve tratar o estado SUCCEED");
  assert.ok(
    /FAILED|CANCELLED/.test(pollStep.run),
    "o polling deve tratar estados terminais de falha (FAILED/CANCELLED)",
  );
  assert.ok(
    /exit\s+1/.test(pollStep.run),
    "o polling deve falhar explicitamente (exit 1) em estado ≠ SUCCEED / timeout",
  );
});

// ---------------------------------------------------------------------------
// AC #6 — §5.4/§5.7: nenhum literal de secret; sem echo; nenhum NEXT_PUBLIC_ com secret
// ---------------------------------------------------------------------------

test("AC6: nenhum literal de credencial AWS aparece no YAML bruto do composite", () => {
  const raw = readRaw(actionPath);
  assert.ok(!/AKIA[0-9A-Z]{16}/.test(raw), "access key AWS não pode ser hardcoded");
  assert.ok(
    !/aws-secret-access-key\s*:\s*["']?[A-Za-z0-9/+=]{40}["']?/.test(raw),
    "secret access key não pode ser hardcoded",
  );
  assert.ok(
    !/arn:aws:iam::\d{12}:role\//.test(raw),
    "ARN de role não pode ser hardcoded (deve vir de input)",
  );
});

test("AC6: valores de secret vêm de ${{ inputs.* }}", () => {
  const raw = readRaw(actionPath);
  for (const key of REQUIRED_INPUTS) {
    assert.ok(
      new RegExp(`inputs\\.${key.replace(/-/g, "\\-")}`).test(raw),
      `o composite deve referenciar inputs.${key}`,
    );
  }
});

test("AC6: secrets não são ecoados nos steps run (sem echo/cat/printenv de credenciais)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  for (const s of steps) {
    if (typeof s.run !== "string") continue;
    const leaks =
      /\b(echo|printf|cat|printenv)\b[^\n]*\$?\{?\s*(AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|SECRETS_JSON|VARS_JSON|payload|inputs\.aws-secret-access-key|inputs\.aws-access-key-id|inputs\.github-secrets-json|inputs\.github-variables-json)/i.test(
        s.run,
      );
    assert.ok(!leaks, `step '${s.name ?? s.run}' não pode ecoar credenciais/env sensíveis nos logs`);
  }
});

test("AC6 (§5.4): nenhum secret server-side é transformado em NEXT_PUBLIC_*", () => {
  const raw = readRaw(actionPath);
  // não pode haver atribuição de um input/env de secret a uma chave NEXT_PUBLIC_.
  assert.ok(
    !/NEXT_PUBLIC_[A-Z0-9_]*\s*[:=]\s*\$?\{?\s*(inputs\.|AWS_|SUPABASE_SECRET|.*PRIVATE_KEY)/i.test(raw),
    "nenhum secret pode ser exposto como NEXT_PUBLIC_*",
  );
});

// ---------------------------------------------------------------------------
// AC #7 — job deploy-amplify: needs deploy-supabase, checkout, uses composite, with secrets
// ---------------------------------------------------------------------------

test("AC7: existe job `deploy-amplify` em ubuntu-latest", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs?.["deploy-amplify"], "deve existir o job `deploy-amplify`");
  assert.equal(
    doc.jobs["deploy-amplify"]["runs-on"],
    "ubuntu-latest",
    "job deploy-amplify deve rodar em ubuntu-latest",
  );
});

test("AC7: job `deploy-amplify` declara `needs: deploy-supabase`", () => {
  const doc = loadYaml(workflowPath);
  const needs = doc.jobs["deploy-amplify"].needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert.ok(
    needsList.includes("deploy-supabase"),
    "deploy-amplify deve declarar needs: deploy-supabase",
  );
});

test("AC7: job faz checkout ANTES de usar o composite deploy-amplify", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-amplify"]);
  const checkoutIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout"),
  );
  const compositeIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  assert.ok(checkoutIdx >= 0, "deve haver um step actions/checkout");
  assert.ok(compositeIdx >= 0, "deve haver um step uses: ./.github/jobs/deploy-amplify");
  assert.ok(checkoutIdx < compositeIdx, "checkout deve vir ANTES do composite local");
});

test("AC7: job passa secrets ao composite via with: referenciando ${{ secrets.* }}", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-amplify"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  assert.ok(compositeStep, "deve haver o step do composite");
  assert.ok(compositeStep.with, "o step do composite deve ter bloco with:");
  // Os dois inputs de Story 11.8 (github-variables-json/github-secrets-json)
  // usam toJSON(vars)/toJSON(secrets); amplify-branch-name usa github.ref_name
  // (não é secret) — os demais continuam secrets.* diretos.
  const toJsonInputs = new Set(["github-variables-json", "github-secrets-json"]);
  for (const key of REQUIRED_INPUTS) {
    assert.ok(compositeStep.with[key] !== undefined, `with deve passar '${key}'`);
    const value = String(compositeStep.with[key]);
    if (toJsonInputs.has(key)) {
      assert.ok(
        /\$\{\{\s*toJSON\((vars|secrets)\)\s*\}\}/.test(value),
        `with.${key} deve referenciar toJSON(vars)/toJSON(secrets) (nunca literal)`,
      );
    } else if (key === "amplify-branch-name") {
      assert.ok(
        /\$\{\{\s*github\.ref_name\s*\}\}/.test(value),
        `with.${key} deve referenciar github.ref_name (nunca literal)`,
      );
    } else {
      assert.ok(
        /\$\{\{\s*secrets\./.test(value),
        `with.${key} deve referenciar secrets.* (nunca literal)`,
      );
    }
  }
});

test("AC7: nenhum literal de secret no with: do job", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-amplify"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  const withRaw = JSON.stringify(compositeStep.with ?? {});
  assert.ok(!/AKIA[0-9A-Z]{16}/.test(withRaw), "access key não pode ser literal no with:");
  assert.ok(!/arn:aws:iam::\d{12}:/.test(withRaw), "ARN não pode ser literal no with:");
});

// ---------------------------------------------------------------------------
// AC #8 — encadeamento: tests + deploy-supabase intactos; apenas os 3 jobs
// ---------------------------------------------------------------------------

test("AC8: jobs `tests` e `deploy-supabase` permanecem intactos e encadeados", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs.tests, "job tests deve continuar existindo");
  assert.ok(doc.jobs["deploy-supabase"], "job deploy-supabase deve continuar existindo");
  assert.ok(doc.jobs.tests.needs === undefined, "tests continua sendo o gate inicial (sem needs)");
  const supNeeds = doc.jobs["deploy-supabase"].needs;
  const supNeedsList = Array.isArray(supNeeds) ? supNeeds : [supNeeds];
  assert.ok(supNeedsList.includes("tests"), "deploy-supabase continua com needs: tests");
});

test("AC8: production.yml contém os jobs tests, deploy-supabase, deploy-amplify (+ smoke-test na 11.6)", () => {
  const doc = loadYaml(workflowPath);
  const jobKeys = Object.keys(doc.jobs).sort();
  // A Story 11.6 adicionou o job final `smoke-test` à cadeia (mesmo precedente da
  // 11.5 sobre a 11.4). Este teste afirma que os jobs desta story permanecem
  // presentes; o conjunto EXATO é validado pelo teste da Story 11.6.
  for (const key of ["deploy-amplify", "deploy-supabase", "tests"]) {
    assert.ok(jobKeys.includes(key), `job '${key}' deve continuar existindo em production.yml`);
  }
});
