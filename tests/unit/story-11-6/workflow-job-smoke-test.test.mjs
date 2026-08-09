// Story 11.6 — Composite `smoke-test` + job encadeado (`needs: deploy-amplify`).
//
// Testes estruturais/de contrato: GitHub Actions e HTTP contra produção não rodam
// no sandbox, então parseamos os YAMLs via `js-yaml` (devDependency desde a Story
// 11.2) e afirmamos sobre a estrutura parseada — além de checar o texto bruto para
// garantir que nenhuma URL de produção seja hardcoded.
//
// Focos críticos:
//  - §5.8 (retries finitos): loop com timeout/max attempts (sem `while true`) e
//    falha explícita (exit 1) ao esgotar as tentativas.
//  - §6 (critério de sucesso): sucesso = HTTP 200 no GET /api/health.
//  - §4-D (sem hardcode): a URL de produção vem do input, nunca literal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const actionPath = resolve(repoRoot, ".github/jobs/smoke-test/action.yml");
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

const REQUIRED_INPUTS = ["production-url"];

// ---------------------------------------------------------------------------
// AC #1 — composite existe, parseia, e usa `composite`
// ---------------------------------------------------------------------------

test("AC1: .github/jobs/smoke-test/action.yml existe", () => {
  assert.ok(existsSync(actionPath), "action.yml do composite smoke-test deve existir");
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
// AC #2 — input production-url declarado e required
// ---------------------------------------------------------------------------

test("AC2: composite declara o input production-url", () => {
  const doc = loadYaml(actionPath);
  assert.ok(doc.inputs && typeof doc.inputs === "object", "deve haver seção inputs");
  for (const key of REQUIRED_INPUTS) {
    assert.ok(doc.inputs[key], `input '${key}' deve existir`);
  }
});

test("AC2: input production-url é required: true", () => {
  const doc = loadYaml(actionPath);
  for (const key of REQUIRED_INPUTS) {
    assert.equal(doc.inputs[key].required, true, `input '${key}' deve ser required: true`);
  }
});

// ---------------------------------------------------------------------------
// AC #3 — GET .../api/health via input; shell em todo run
// ---------------------------------------------------------------------------

test("AC3: existe step que faz GET contra /api/health", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const httpStep = steps.find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run) && /\bcurl\b/.test(s.run),
  );
  assert.ok(httpStep, "deve haver um step que usa curl contra /api/health");
});

test("AC3: a URL do health check deriva do input (não literal)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const httpStep = steps.find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run) && /\bcurl\b/.test(s.run),
  );
  const envRaw = JSON.stringify(httpStep.env ?? {});
  assert.ok(
    /inputs\.production-url/.test(envRaw),
    "a URL base deve vir de inputs.production-url (via env), não hardcoded",
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
// AC #4 — §5.8 CRÍTICO: retries FINITOS + falha explícita ao esgotar
// ---------------------------------------------------------------------------

test("AC4 (§5.8): o smoke-test tem retries em loop", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const httpStep = steps.find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(httpStep, "deve haver um step de smoke-test com loop de retry");
});

test("AC4 (§5.8): o loop é FINITO (timeout / max attempts), nunca infinito", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const httpStep = steps.find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(httpStep, "deve existir o step de smoke-test com loop");
  assert.ok(
    /max_attempts|max-attempts|maxAttempts|timeout/i.test(httpStep.run),
    "§5.8: o retry deve ter timeout / número máximo de tentativas",
  );
  // guardrail: não pode haver `while true` (loop infinito).
  assert.ok(
    !/while\s+true/.test(httpStep.run) && !/while\s+:/.test(httpStep.run),
    "§5.8: o retry NÃO pode ser um loop infinito (while true)",
  );
});

test("AC4 (§5.8): falha explicitamente (exit 1) ao esgotar as tentativas", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const httpStep = steps.find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(
    /exit\s+1/.test(httpStep.run),
    "o smoke-test deve falhar explicitamente (exit 1) ao esgotar os retries",
  );
});

// ---------------------------------------------------------------------------
// AC #5 — critério de sucesso: HTTP 200
// ---------------------------------------------------------------------------

test("AC5 (§6): sucesso é definido por HTTP 200", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const httpStep = steps.find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(
    /200/.test(httpStep.run),
    "o smoke-test deve tratar o status HTTP 200 como sucesso",
  );
  // evidência de que o status code é efetivamente lido (curl -w %{http_code} ou --fail).
  assert.ok(
    /%\{http_code\}/.test(httpStep.run) || /--fail\b/.test(httpStep.run),
    "o smoke-test deve inspecionar o status code (curl -w '%{http_code}' ou --fail)",
  );
});

// ---------------------------------------------------------------------------
// AC #6 — §4-D: nenhuma URL de produção hardcoded
// ---------------------------------------------------------------------------

test("AC6: nenhuma URL de produção literal aparece no YAML bruto do composite", () => {
  const raw = readRaw(actionPath);
  // não pode haver um alvo http(s):// hardcoded como valor executável.
  // Toleramos ocorrências dentro de comentários/descrições (ex.: "https://app.exemplo.com")
  // apenas como documentação — mas não em linhas de `run:` de comando.
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  for (const s of steps) {
    if (typeof s.run !== "string") continue;
    assert.ok(
      !/curl[^\n]*https?:\/\/[a-z0-9.-]+/i.test(s.run),
      "a URL de produção não pode ser hardcoded num curl (deve vir do input)",
    );
  }
  // sanity: raw ainda referencia o input.
  assert.ok(
    /inputs\.production-url/.test(raw),
    "o composite deve referenciar inputs.production-url",
  );
});

// ---------------------------------------------------------------------------
// AC #7 — job smoke-test: needs deploy-amplify, checkout, uses composite, with url
// ---------------------------------------------------------------------------

test("AC7: existe job `smoke-test` em ubuntu-latest", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs?.["smoke-test"], "deve existir o job `smoke-test`");
  assert.equal(
    doc.jobs["smoke-test"]["runs-on"],
    "ubuntu-latest",
    "job smoke-test deve rodar em ubuntu-latest",
  );
});

test("AC7: job `smoke-test` declara `needs: deploy-amplify`", () => {
  const doc = loadYaml(workflowPath);
  const needs = doc.jobs["smoke-test"].needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert.ok(
    needsList.includes("deploy-amplify"),
    "smoke-test deve declarar needs: deploy-amplify",
  );
});

test("AC7: job faz checkout ANTES de usar o composite smoke-test", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["smoke-test"]);
  const checkoutIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout"),
  );
  const compositeIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/smoke-test",
  );
  assert.ok(checkoutIdx >= 0, "deve haver um step actions/checkout");
  assert.ok(compositeIdx >= 0, "deve haver um step uses: ./.github/jobs/smoke-test");
  assert.ok(checkoutIdx < compositeIdx, "checkout deve vir ANTES do composite local");
});

test("AC7: job passa production-url ao composite via with: referenciando secrets/vars", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["smoke-test"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/smoke-test",
  );
  assert.ok(compositeStep, "deve haver o step do composite");
  assert.ok(compositeStep.with, "o step do composite deve ter bloco with:");
  assert.ok(
    compositeStep.with["production-url"] !== undefined,
    "with deve passar 'production-url'",
  );
  assert.ok(
    /\$\{\{\s*(secrets|vars)\./.test(String(compositeStep.with["production-url"])),
    "with.production-url deve referenciar secrets.* ou vars.* (nunca literal)",
  );
});

test("AC7: nenhuma URL literal no with: do job", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["smoke-test"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/smoke-test",
  );
  const withRaw = JSON.stringify(compositeStep.with ?? {});
  assert.ok(!/https?:\/\/[a-z0-9.-]+/i.test(withRaw), "URL não pode ser literal no with:");
});

// ---------------------------------------------------------------------------
// AC #8 — encadeamento: cadeia completa e conjunto exato de 4 jobs
// ---------------------------------------------------------------------------

test("AC8: jobs anteriores permanecem intactos e encadeados", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs.tests, "job tests deve continuar existindo");
  assert.ok(doc.jobs["deploy-supabase"], "job deploy-supabase deve continuar existindo");
  assert.ok(doc.jobs["deploy-amplify"], "job deploy-amplify deve continuar existindo");
  assert.ok(doc.jobs.tests.needs === undefined, "tests continua sendo o gate inicial (sem needs)");
  const supNeeds = doc.jobs["deploy-supabase"].needs;
  assert.ok(
    (Array.isArray(supNeeds) ? supNeeds : [supNeeds]).includes("tests"),
    "deploy-supabase continua com needs: tests",
  );
  const ampNeeds = doc.jobs["deploy-amplify"].needs;
  assert.ok(
    (Array.isArray(ampNeeds) ? ampNeeds : [ampNeeds]).includes("deploy-supabase"),
    "deploy-amplify continua com needs: deploy-supabase",
  );
});

test("AC8: production.yml contém EXATAMENTE os 4 jobs da cadeia completa", () => {
  const doc = loadYaml(workflowPath);
  const jobKeys = Object.keys(doc.jobs).sort();
  assert.deepEqual(
    jobKeys,
    ["deploy-amplify", "deploy-supabase", "smoke-test", "tests"],
    "com a Story 11.6 a cadeia fica completa: tests, deploy-supabase, deploy-amplify e smoke-test",
  );
});
