// Story 11.3 (QA) — Testes de contrato adicionais ligando a escolha de Node 22
// no CI ao motivo real (§5.1) e verificando a ordem/robustez dos steps.
//
// Estes testes complementam workflow-job-tests.test.mjs: em vez de só afirmar
// "node-version começa com 22", eles provam POR QUE isso importa (o script de
// teste do projeto depende do glob `**`, que só expande no Node 21+) e afirmam
// a ordem de execução do composite.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const actionPath = resolve(repoRoot, ".github/jobs/tests/action.yml");
const workflowPath = resolve(repoRoot, ".github/workflows/production.yml");
const pkgPath = resolve(repoRoot, "package.json");

const action = yaml.load(readFileSync(actionPath, "utf8"));
const workflow = yaml.load(readFileSync(workflowPath, "utf8"));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const compositeSteps = action.runs.steps;

function setupNodeStep() {
  return compositeSteps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node"),
  );
}

// ---------------------------------------------------------------------------
// §5.1 — o risco é real: o comando de teste do projeto usa o glob `**`
// ---------------------------------------------------------------------------

test("§5.1: o script `npm test` do projeto usa o glob globstar `**` (motivo do Node 22)", () => {
  const testScript = pkg.scripts?.test ?? "";
  assert.match(
    testScript,
    /tests\/unit\/\*\*\/\*\.test\.mjs/,
    "package.json test script deve usar o padrão `tests/unit/**/*.test.mjs` — é este glob que exige Node 21+",
  );
});

test("§5.1: a versão de Node fixada no CI é numericamente >= 21 (expande o glob **)", () => {
  const version = String(setupNodeStep()?.with?.["node-version"] ?? "");
  const major = parseInt(version, 10);
  assert.ok(!Number.isNaN(major), `node-version deve começar com um número, encontrado: '${version}'`);
  assert.ok(
    major >= 21,
    `node-version major (${major}) deve ser >= 21 para o glob ** expandir; ideal 22 (LTS)`,
  );
});

// ---------------------------------------------------------------------------
// Ordem e robustez dos steps do composite
// ---------------------------------------------------------------------------

test("composite: ordem correta setup-node -> npm ci -> npm test", () => {
  const idxSetup = compositeSteps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node"),
  );
  const idxCi = compositeSteps.findIndex(
    (s) => typeof s.run === "string" && /\bnpm ci\b/.test(s.run),
  );
  const idxTest = compositeSteps.findIndex(
    (s) => typeof s.run === "string" && /\bnpm test\b/.test(s.run),
  );
  assert.ok(idxSetup >= 0 && idxCi >= 0 && idxTest >= 0, "os três steps devem existir");
  assert.ok(idxSetup < idxCi, "setup-node deve vir antes de npm ci");
  assert.ok(idxCi < idxTest, "npm ci deve vir antes de npm test");
});

test("composite: actions/setup-node está pinado a uma versão (contém @)", () => {
  const uses = setupNodeStep()?.uses ?? "";
  assert.match(uses, /@/, "actions/setup-node deve referenciar uma versão via @ (ex.: @v4)");
});

test("composite: usa `npm ci` (determinístico), nunca `npm install` no CI", () => {
  const hasInstall = compositeSteps.some(
    (s) => typeof s.run === "string" && /\bnpm install\b/.test(s.run),
  );
  assert.ok(!hasInstall, "CI deve usar `npm ci`, não `npm install` (evita drift do lockfile)");
});

// ---------------------------------------------------------------------------
// Consistência do orquestrador
// ---------------------------------------------------------------------------

test("orquestrador: job `tests` referencia o composite pelo caminho exato do arquivo criado", () => {
  const steps = workflow.jobs.tests.steps;
  const usesPath = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("./.github/jobs/"),
  )?.uses;
  assert.equal(
    usesPath,
    "./.github/jobs/tests",
    "o `uses:` local deve apontar para o diretório do composite tests que existe no repo",
  );
});

test("orquestrador: checkout está pinado a uma versão (contém @)", () => {
  const steps = workflow.jobs.tests.steps;
  const checkout = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout"),
  )?.uses;
  assert.match(checkout ?? "", /@/, "actions/checkout deve referenciar uma versão via @");
});
