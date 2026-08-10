// Story 11.6 — Testes de CONTRATO complementares (QA) do composite `smoke-test`.
//
// Complementam os testes por-AC (`workflow-job-smoke-test.test.mjs`) com
// invariantes de contrato mais fortes:
//  - o composite NÃO consome secrets diretamente (só inputs.*)
//  - alinhamento exato `with:` (orquestrador) <-> `inputs` (composite)
//  - `needs` exatamente `[deploy-amplify]` (gate final, um único predecessor)
//  - o alvo é exatamente `/api/health` (não outra rota)
//  - há `sleep` entre as tentativas (backoff simples, não busy-loop)
//  - a cadeia completa de `needs` forma tests -> deploy-supabase ->
//    deploy-amplify -> smoke-test
//  - o job smoke-test é uma FOLHA (nenhum outro job depende dele)
//
// Parse real via `js-yaml`; GitHub Actions e HTTP contra produção não rodam no sandbox.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
function healthStep(actionDoc) {
  return stepsOf(actionDoc.runs).find(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run),
  );
}

// ---------------------------------------------------------------------------
// Fronteira de secrets: composite só usa inputs.*, nunca secrets.*
// ---------------------------------------------------------------------------

test("contract: os steps do composite NUNCA referenciam secrets.* (só inputs.*)", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  const stepsRaw = JSON.stringify(steps);
  assert.ok(
    !/\bsecrets\.[A-Za-z_]+/.test(stepsRaw),
    "os steps do composite devem usar `inputs.*`, nunca ler `secrets.*` diretamente",
  );
});

// ---------------------------------------------------------------------------
// Alinhamento exato `with:` (orquestrador) <-> `inputs` (composite)
// ---------------------------------------------------------------------------

test("contract: todo `with:` do job corresponde a um `input` declarado, e vice-versa", () => {
  const action = loadYaml(actionPath);
  const workflow = loadYaml(workflowPath);
  const declaredInputs = Object.keys(action.inputs ?? {}).sort();
  const compositeStep = stepsOf(workflow.jobs["smoke-test"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/smoke-test",
  );
  const passedWith = Object.keys(compositeStep.with ?? {}).sort();
  assert.deepEqual(
    passedWith,
    declaredInputs,
    "o `with:` do job deve corresponder exatamente aos `inputs` do composite",
  );
});

test("contract: todo input required é efetivamente passado pelo orquestrador", () => {
  const action = loadYaml(actionPath);
  const workflow = loadYaml(workflowPath);
  const compositeStep = stepsOf(workflow.jobs["smoke-test"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/smoke-test",
  );
  for (const [key, spec] of Object.entries(action.inputs ?? {})) {
    if (spec.required === true) {
      assert.ok(
        compositeStep.with?.[key] !== undefined,
        `input required '${key}' deve ser passado no with: do job`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Encadeamento exato do job (gate final)
// ---------------------------------------------------------------------------

test("contract: job smoke-test tem needs EXATAMENTE [deploy-amplify]", () => {
  const workflow = loadYaml(workflowPath);
  const needs = workflow.jobs["smoke-test"].needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert.deepEqual(needsList, ["deploy-amplify"], "needs deve ser exatamente [deploy-amplify]");
});

test("contract: a cadeia de needs é tests -> deploy-supabase -> deploy-amplify -> smoke-test", () => {
  const workflow = loadYaml(workflowPath);
  const needsOf = (job) => {
    const n = workflow.jobs[job].needs;
    return Array.isArray(n) ? n : n === undefined ? [] : [n];
  };
  assert.deepEqual(needsOf("tests"), [], "tests é o gate inicial (sem needs)");
  assert.deepEqual(needsOf("deploy-supabase"), ["tests"], "deploy-supabase depende de tests");
  assert.deepEqual(needsOf("deploy-amplify"), ["deploy-supabase"], "deploy-amplify depende de deploy-supabase");
  assert.deepEqual(needsOf("smoke-test"), ["deploy-amplify"], "smoke-test depende de deploy-amplify");
});

test("contract: smoke-test é uma FOLHA (nenhum outro job depende dele)", () => {
  const workflow = loadYaml(workflowPath);
  for (const [name, job] of Object.entries(workflow.jobs)) {
    const n = job.needs;
    const list = Array.isArray(n) ? n : n === undefined ? [] : [n];
    assert.ok(
      !list.includes("smoke-test"),
      `nenhum job pode depender de smoke-test (gate final); '${name}' o declara em needs`,
    );
  }
});

// ---------------------------------------------------------------------------
// Alvo exato e mecânica do retry
// ---------------------------------------------------------------------------

test("contract: o alvo do health check é exatamente /api/health", () => {
  const step = healthStep(loadYaml(actionPath));
  assert.ok(step, "deve existir o step de smoke-test");
  assert.ok(/\/api\/health/.test(step.run), "o alvo deve conter /api/health");
  // não pode mirar outra rota de health equivocada.
  assert.ok(!/\/health\b(?!\/)/.test(step.run.replace(/\/api\/health/g, "")), "não deve mirar /health fora de /api/health");
});

test("contract: o step de smoke-test roda em bash", () => {
  const step = healthStep(loadYaml(actionPath));
  assert.equal(step.shell, "bash", "o step de smoke-test deve declarar shell: bash");
});

test("contract: há um único step que consulta /api/health (sem duplicação)", () => {
  const steps = stepsOf(loadYaml(actionPath).runs).filter(
    (s) => typeof s.run === "string" && /\/api\/health/.test(s.run),
  );
  assert.equal(steps.length, 1, "deve haver exatamente um step de smoke-test");
});

test("contract: há sleep entre as tentativas (backoff, não busy-loop)", () => {
  const step = healthStep(loadYaml(actionPath));
  assert.ok(/\bsleep\b/.test(step.run), "o retry deve dormir entre tentativas (evita busy-loop)");
});

test("contract: o número máximo de tentativas é um inteiro positivo finito", () => {
  const step = healthStep(loadYaml(actionPath));
  const m = step.run.match(/max_attempts\s*=\s*(\d+)/);
  assert.ok(m, "deve haver max_attempts definido");
  const n = Number(m[1]);
  assert.ok(Number.isInteger(n) && n > 0, "max_attempts deve ser um inteiro positivo finito");
});

// ---------------------------------------------------------------------------
// Sem hardcode de URL / permissions do orquestrador
// ---------------------------------------------------------------------------

test("contract: a URL de produção não é hardcoded (vem de inputs.production-url)", () => {
  const step = healthStep(loadYaml(actionPath));
  const envRaw = JSON.stringify(step.env ?? {});
  assert.ok(/inputs\.production-url/.test(envRaw), "a URL deve vir de inputs.production-url via env");
  assert.ok(
    !/https?:\/\/[a-z0-9.-]+/i.test(step.run),
    "nenhuma URL http(s) hardcoded no comando do smoke-test",
  );
});

test("contract: o orquestrador mantém permissions least-privilege (contents: read)", () => {
  const workflow = loadYaml(workflowPath);
  assert.deepEqual(
    workflow.permissions,
    { contents: "read" },
    "o workflow deve manter permissions: contents: read",
  );
});
