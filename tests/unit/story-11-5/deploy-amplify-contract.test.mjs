// Story 11.5 — Testes de CONTRATO complementares (QA) do composite `deploy-amplify`.
//
// Complementam os testes por-AC (`workflow-job-deploy-amplify.test.mjs`) com
// invariantes de contrato mais fortes:
//  - ordem COMPLETA dos steps: auth -> sync(env) -> start-job -> polling
//  - exatamente UM start-job RELEASE (sem deploy duplicado)
//  - alinhamento exato `with:` (orquestrador) <-> `inputs` (composite)
//  - fronteira de secrets: o composite só usa `inputs.*`, nunca `secrets.*`
//  - encadeamento exato do job: `needs: [deploy-supabase]`
//  - jobId capturado em GITHUB_OUTPUT e consumido pelo polling
//
// Parse real via `js-yaml`; GitHub Actions/AWS não rodam no sandbox.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

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
function runStepsText(steps) {
  return steps.filter((s) => typeof s.run === "string");
}

// ---------------------------------------------------------------------------
// Ordem COMPLETA dos steps do composite
// ---------------------------------------------------------------------------

test("contract: ordem dos steps é auth -> sync(env) -> start-job -> polling", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  const authIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("aws-actions/configure-aws-credentials"),
  );
  const syncIdx = steps.findIndex(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
  const startIdx = steps.findIndex(
    (s) => typeof s.run === "string" && /amplify start-job/.test(s.run),
  );
  const pollIdx = steps.findIndex(
    (s) => typeof s.run === "string" && /amplify get-job/.test(s.run) && /while\b/.test(s.run),
  );
  assert.ok(authIdx >= 0 && syncIdx >= 0 && startIdx >= 0 && pollIdx >= 0, "todos os steps devem existir");
  assert.ok(authIdx < syncIdx, "auth deve preceder o sync de env");
  assert.ok(syncIdx < startIdx, "sync de env deve preceder o start-job");
  assert.ok(startIdx < pollIdx, "start-job deve preceder o polling");
});

// ---------------------------------------------------------------------------
// Exatamente UM deploy (start-job RELEASE)
// ---------------------------------------------------------------------------

test("contract: existe exatamente UM start-job RELEASE (sem deploy duplicado)", () => {
  const steps = runStepsText(stepsOf(loadYaml(actionPath).runs));
  const starts = steps.filter((s) => /amplify start-job/.test(s.run));
  assert.equal(starts.length, 1, "deve haver exatamente um step start-job");
  const releaseCount = (starts[0].run.match(/--job-type\s+RELEASE/g) ?? []).length;
  assert.equal(releaseCount, 1, "o start-job deve disparar exatamente um RELEASE");
});

// ---------------------------------------------------------------------------
// jobId: capturado em GITHUB_OUTPUT e consumido pelo polling
// ---------------------------------------------------------------------------

test("contract: start-job captura jobId em GITHUB_OUTPUT e o polling o consome", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  const startStep = steps.find((s) => typeof s.run === "string" && /amplify start-job/.test(s.run));
  assert.ok(startStep.id, "o step start-job deve ter um `id` para expor outputs");
  assert.ok(
    /GITHUB_OUTPUT/.test(startStep.run),
    "o start-job deve escrever o jobId em $GITHUB_OUTPUT",
  );
  const pollStep = steps.find(
    (s) => typeof s.run === "string" && /amplify get-job/.test(s.run) && /while\b/.test(s.run),
  );
  const pollEnv = JSON.stringify(pollStep.env ?? {});
  assert.ok(
    new RegExp(`steps\\.${startStep.id}\\.outputs`).test(pollEnv),
    "o polling deve consumir o jobId via steps.<id>.outputs",
  );
});

// ---------------------------------------------------------------------------
// Alinhamento exato `with:` (orquestrador) <-> `inputs` (composite)
// ---------------------------------------------------------------------------

test("contract: todo `with:` do job corresponde a um `input` declarado, e vice-versa", () => {
  const action = loadYaml(actionPath);
  const workflow = loadYaml(workflowPath);
  const declaredInputs = Object.keys(action.inputs ?? {}).sort();
  const steps = stepsOf(workflow.jobs["deploy-amplify"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
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
  const compositeStep = stepsOf(workflow.jobs["deploy-amplify"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
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
// Fronteira de secrets: composite só usa inputs.*, nunca secrets.*
// ---------------------------------------------------------------------------

test("contract: os steps do composite NUNCA referenciam secrets.* (só inputs.*)", () => {
  // Inspecionamos a seção `runs` parseada (run/env/with/uses reais), ignorando as
  // strings de `description` dos inputs — que citam `${{ secrets.* }}` apenas como
  // documentação de qual secret o orquestrador deve passar.
  const steps = stepsOf(loadYaml(actionPath).runs);
  const stepsRaw = JSON.stringify(steps);
  assert.ok(
    !/\bsecrets\.[A-Za-z_]+/.test(stepsRaw),
    "os steps do composite devem usar `inputs.*`, nunca ler `secrets.*` diretamente",
  );
});

test("contract: o orquestrador só passa valores ${{ secrets.* }} ao composite (nunca literais)", () => {
  const workflow = loadYaml(workflowPath);
  const compositeStep = stepsOf(workflow.jobs["deploy-amplify"]).find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-amplify",
  );
  for (const [key, val] of Object.entries(compositeStep.with ?? {})) {
    assert.ok(
      /^\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}$/.test(String(val)),
      `with.${key} deve ser exatamente uma referência a secrets.* (foi: ${val})`,
    );
  }
});

// ---------------------------------------------------------------------------
// Encadeamento exato do job
// ---------------------------------------------------------------------------

test("contract: job deploy-amplify tem needs EXATAMENTE [deploy-supabase]", () => {
  const workflow = loadYaml(workflowPath);
  const needs = workflow.jobs["deploy-amplify"].needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert.deepEqual(needsList, ["deploy-supabase"], "needs deve ser exatamente [deploy-supabase]");
});

// ---------------------------------------------------------------------------
// Região AWS disponível para os steps de CLI
// ---------------------------------------------------------------------------

test("contract: todo step de CLI AWS recebe a região via env (a partir do input)", () => {
  const steps = runStepsText(stepsOf(loadYaml(actionPath).runs));
  const awsSteps = steps.filter((s) => /\baws amplify\b/.test(s.run));
  assert.ok(awsSteps.length >= 3, "deve haver ao menos 3 steps chamando o aws CLI (sync/start/poll)");
  for (const s of awsSteps) {
    const envRaw = JSON.stringify(s.env ?? {});
    assert.ok(
      /AWS_REGION/.test(envRaw) && /inputs\.aws-region/.test(envRaw),
      `step '${s.name ?? "run"}' deve expor AWS_REGION a partir de inputs.aws-region`,
    );
  }
});

// ---------------------------------------------------------------------------
// Merge de env: o mapa reenviado inclui as vars atuais (não é overwrite cego)
// ---------------------------------------------------------------------------

test("contract: o update-branch reenvia o mapa MESCLADO (current + incoming)", () => {
  const steps = runStepsText(stepsOf(loadYaml(actionPath).runs));
  const syncStep = steps.find((s) => /amplify update-branch/.test(s.run));
  // a variável mesclada deve ser derivada tanto do current (get-branch) quanto do incoming (input).
  assert.ok(/current=/.test(syncStep.run), "deve capturar as vars atuais em uma variável `current`");
  assert.ok(
    /--argjson\s+current/.test(syncStep.run) && /--argjson\s+incoming/.test(syncStep.run),
    "o merge deve combinar `current` e `incoming` via jq",
  );
  assert.ok(
    /environmentVariables/.test(syncStep.run),
    "o payload do update-branch deve setar environmentVariables com o mapa mesclado",
  );
});
