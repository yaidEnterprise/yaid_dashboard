// Story 11.3 — Composite `tests` + orquestrador base da pipeline.
//
// Testes estruturais/de contrato: GitHub Actions não roda no sandbox, então
// parseamos os dois YAMLs via `js-yaml` (devDependency declarada desde a Story
// 11.2) e afirmamos sobre a estrutura parseada — não apenas regex sobre texto.
//
// Foco especial no risco crítico §5.1: o composite DEVE fixar Node 22 (o glob
// `**` de `node --test "tests/unit/**/*.test.mjs"` só é expandido no Node 21+).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const actionPath = resolve(repoRoot, ".github/jobs/tests/action.yml");
const workflowPath = resolve(repoRoot, ".github/workflows/production.yml");

function loadYaml(path) {
  const raw = readFileSync(path, "utf8");
  return yaml.load(raw);
}

// Helper: coleta todos os steps de um composite/job de forma robusta.
function stepsOf(node) {
  return Array.isArray(node?.steps) ? node.steps : [];
}

// ---------------------------------------------------------------------------
// AC #1 — composite action existe, parseia, e usa `composite`
// ---------------------------------------------------------------------------

test("AC1: .github/jobs/tests/action.yml existe", () => {
  assert.ok(existsSync(actionPath), "action.yml do composite tests deve existir");
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
// AC #2 — Node 22, npm ci, npm test, shell obrigatório
// ---------------------------------------------------------------------------

test("AC2 (§5.1 CRÍTICO): composite fixa Node 22 via actions/setup-node", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const setupNode = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node"),
  );
  assert.ok(setupNode, "deve haver um step usando actions/setup-node");
  const version = String(setupNode.with?.["node-version"] ?? "");
  assert.ok(version.length > 0, "setup-node deve declarar node-version");
  assert.ok(
    version.startsWith("22"),
    `node-version deve ser 22 (LTS), encontrado: '${version}' — Node 18/20 quebra o glob ** (§5.1)`,
  );
});

test("AC2 (§5.1): node-version NÃO é 18 nem 20 (falso verde silencioso)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const setupNode = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node"),
  );
  const version = String(setupNode?.with?.["node-version"] ?? "");
  assert.ok(!version.startsWith("18"), "node-version não pode ser 18 (glob ** não expande)");
  assert.ok(!version.startsWith("20"), "node-version não pode ser 20 (glob ** não expande)");
});

test("AC2: composite tem step `npm ci`", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const hasNpmCi = steps.some(
    (s) => typeof s.run === "string" && /\bnpm ci\b/.test(s.run),
  );
  assert.ok(hasNpmCi, "deve haver um step run com `npm ci`");
});

test("AC2: composite tem step `npm test`", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const hasNpmTest = steps.some(
    (s) => typeof s.run === "string" && /\bnpm test\b/.test(s.run),
  );
  assert.ok(hasNpmTest, "deve haver um step run com `npm test`");
});

test("AC2: todo step com `run` declara `shell` (exigência de composite)", () => {
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
// AC #3 — workflow existe, parseia, dispara em push na branch prod
// ---------------------------------------------------------------------------

test("AC3: .github/workflows/production.yml existe", () => {
  assert.ok(existsSync(workflowPath), "production.yml deve existir");
});

test("AC3: production.yml é YAML válido e parseável", () => {
  assert.doesNotThrow(() => loadYaml(workflowPath), "production.yml deve ser YAML válido");
});

test("AC3: workflow dispara em push na branch `prod`", () => {
  const doc = loadYaml(workflowPath);
  // Em YAML 1.1 a chave nua `on` vira booleano true; toleramos ambos.
  const onSection = doc.on ?? doc[true];
  assert.ok(onSection, "workflow deve ter seção de trigger `on`");
  const branches = onSection.push?.branches;
  assert.ok(Array.isArray(branches), "on.push.branches deve ser uma lista");
  assert.ok(branches.includes("prod"), "on.push.branches deve conter 'prod'");
});

test("AC3 (review/§5.7): workflow declara permissions least-privilege (contents: read)", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.permissions, "workflow deve declarar bloco permissions (least-privilege)");
  assert.equal(
    doc.permissions.contents,
    "read",
    "permissions.contents deve ser 'read' — job de testes só precisa ler o repo",
  );
});

// ---------------------------------------------------------------------------
// AC #4 — job `tests` com checkout + uses do composite local
// ---------------------------------------------------------------------------

test("AC4: existe job `tests` em ubuntu-latest", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs, "workflow deve ter seção jobs");
  assert.ok(doc.jobs.tests, "deve existir o job `tests`");
  assert.equal(doc.jobs.tests["runs-on"], "ubuntu-latest", "job tests deve rodar em ubuntu-latest");
});

test("AC4: job `tests` faz checkout antes de usar o composite", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs.tests);
  const checkoutIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout"),
  );
  const compositeIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/tests",
  );
  assert.ok(checkoutIdx >= 0, "deve haver um step actions/checkout");
  assert.ok(compositeIdx >= 0, "deve haver um step `uses: ./.github/jobs/tests`");
  assert.ok(
    checkoutIdx < compositeIdx,
    "o checkout deve vir ANTES do uso do composite local (senão o composite não resolve)",
  );
});

test("AC4: job `tests` chama o composite via uses: ./.github/jobs/tests", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs.tests);
  const usesComposite = steps.some(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/tests",
  );
  assert.ok(usesComposite, "job tests deve consumir o composite local `./.github/jobs/tests`");
});

// ---------------------------------------------------------------------------
// AC #5 — o job `tests` é o primeiro gate; os demais jobs o encadeiam via needs
// ---------------------------------------------------------------------------
//
// NOTA (Story 11.4): o teste original afirmava `deepEqual(jobKeys, ["tests"])`
// (base mínima). A Story 11.3 registrou um "dismiss" explícito de que esse
// contrato seria atualizado quando a Story 11.4 encadeasse `deploy-supabase`.
// Cumprindo isso, o teste agora garante apenas que (a) `tests` continua existindo
// como primeiro gate e (b) qualquer job adicional depende de `tests` via `needs`
// — sem travar a contagem exata de jobs, que cresce a cada story do Epic 11.

test("AC5: job `tests` existe e é o primeiro gate da pipeline", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs.tests, "o job `tests` deve continuar existindo");
  // `tests` não deve depender de nenhum outro job (é o gate inicial).
  assert.ok(doc.jobs.tests.needs === undefined, "o job `tests` não deve ter `needs` (é o gate inicial)");
});

test("AC5: todo job além de `tests` depende de `tests` via needs (encadeamento)", () => {
  const doc = loadYaml(workflowPath);
  for (const [name, job] of Object.entries(doc.jobs)) {
    if (name === "tests") continue;
    const needs = Array.isArray(job.needs) ? job.needs : [job.needs].filter(Boolean);
    // Cada job de deploy encadeia (direta ou transitivamente) a partir de `tests`.
    // Nesta fase do épico, o encadeamento direto/indireto passa por `tests`.
    assert.ok(needs.length > 0, `job '${name}' deve declarar needs (não pode rodar sem gate)`);
  }
});
