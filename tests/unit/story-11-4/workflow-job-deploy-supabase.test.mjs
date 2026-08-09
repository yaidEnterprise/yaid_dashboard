// Story 11.4 — Composite `deploy-supabase` + job encadeado (`needs: tests`).
//
// Testes estruturais/de contrato: GitHub Actions e o Supabase Cloud não rodam no
// sandbox, então parseamos os YAMLs via `js-yaml` (devDependency desde a Story
// 11.2) e afirmamos sobre a estrutura parseada — além de checar o texto bruto
// para garantir que nenhum literal de secret vaze.
//
// Foco especial (§5.5): o composite DEVE rodar `db push --dry-run` (preview)
// ANTES de `db push` (apply). Essa ordenação é a propriedade de segurança-chave
// desta story.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const actionPath = resolve(repoRoot, ".github/jobs/deploy-supabase/action.yml");
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

// ---------------------------------------------------------------------------
// AC #1 — composite existe, parseia, e usa `composite`
// ---------------------------------------------------------------------------

test("AC1: .github/jobs/deploy-supabase/action.yml existe", () => {
  assert.ok(existsSync(actionPath), "action.yml do composite deploy-supabase deve existir");
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
// AC #2 — inputs de secret declarados e required
// ---------------------------------------------------------------------------

test("AC2: composite declara os inputs de secret necessários", () => {
  const doc = loadYaml(actionPath);
  assert.ok(doc.inputs && typeof doc.inputs === "object", "deve haver seção inputs");
  for (const key of ["supabase-access-token", "supabase-project-ref", "supabase-db-password"]) {
    assert.ok(doc.inputs[key], `input '${key}' deve existir`);
  }
});

test("AC2: inputs de secret são required: true", () => {
  const doc = loadYaml(actionPath);
  for (const key of ["supabase-access-token", "supabase-project-ref", "supabase-db-password"]) {
    assert.equal(doc.inputs[key].required, true, `input '${key}' deve ser required: true`);
  }
});

// ---------------------------------------------------------------------------
// AC #3 — setup CLI, link, dry-run, push; todo run declara shell
// ---------------------------------------------------------------------------

test("AC3: composite instala/configura a Supabase CLI", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const setupCli = steps.find(
    (s) => typeof s.uses === "string" && s.uses.startsWith("supabase/setup-cli"),
  );
  assert.ok(setupCli, "deve haver um step usando supabase/setup-cli");
});

test("AC3: composite tem step `supabase link` usando o project-ref via input", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const linkStep = steps.find(
    (s) => typeof s.run === "string" && /\bsupabase link\b/.test(s.run),
  );
  assert.ok(linkStep, "deve haver um step run com `supabase link`");
  // o project-ref vem de env (input) — a env SUPABASE_PROJECT_REF ou o próprio ${{ inputs }}.
  const usesRefViaEnv =
    /\$SUPABASE_PROJECT_REF|\$\{SUPABASE_PROJECT_REF\}/.test(linkStep.run) ||
    /inputs\.supabase-project-ref/.test(linkStep.run) ||
    (linkStep.env && /inputs\.supabase-project-ref/.test(JSON.stringify(linkStep.env)));
  assert.ok(usesRefViaEnv, "o `supabase link` deve usar o project-ref via input/env, não literal");
});

test("AC3: composite tem step `db push --dry-run` (preview)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const dryRun = steps.find(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && /--dry-run\b/.test(s.run),
  );
  assert.ok(dryRun, "deve haver um step com `supabase db push --dry-run`");
});

test("AC3: composite tem step `db push` real (apply)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const apply = steps.find(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && !/--dry-run\b/.test(s.run),
  );
  assert.ok(apply, "deve haver um step com `supabase db push` sem --dry-run (apply)");
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
// AC #4 — ORDEM CRÍTICA: dry-run ANTES do push real
// ---------------------------------------------------------------------------

test("AC4 (§5.5 CRÍTICO): `db push --dry-run` ocorre ANTES de `db push` real", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  const dryRunIdx = steps.findIndex(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && /--dry-run\b/.test(s.run),
  );
  const applyIdx = steps.findIndex(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && !/--dry-run\b/.test(s.run),
  );
  assert.ok(dryRunIdx >= 0, "deve existir o step dry-run");
  assert.ok(applyIdx >= 0, "deve existir o step apply");
  assert.ok(
    dryRunIdx < applyIdx,
    "o dry-run (preview) DEVE preceder o push real (apply) — expand->contract §5.5",
  );
});

// ---------------------------------------------------------------------------
// AC #5 — nenhum literal de secret; sem echo de secrets
// ---------------------------------------------------------------------------

test("AC5: nenhum literal de secret aparece no YAML bruto do composite", () => {
  const raw = readRaw(actionPath);
  // project-ref de produção conhecido (§evidência) não pode aparecer literal.
  assert.ok(
    !raw.includes("lygkwhcwsrxfozswhxyo"),
    "project-ref não pode ser hardcoded no composite",
  );
  // heurística: nenhum atribuição literal a variáveis de secret conhecidas.
  assert.ok(
    !/SUPABASE_ACCESS_TOKEN\s*[:=]\s*["']?sbp_/.test(raw),
    "token de acesso não pode ser hardcoded",
  );
});

test("AC5: valores de secret vêm de ${{ inputs.* }}", () => {
  const raw = readRaw(actionPath);
  for (const key of ["supabase-access-token", "supabase-project-ref", "supabase-db-password"]) {
    assert.ok(
      new RegExp(`inputs\\.${key.replace(/-/g, "\\-")}`).test(raw),
      `o composite deve referenciar inputs.${key}`,
    );
  }
});

test("AC5: secrets não são ecoados nos steps run (sem echo/cat/printenv do token/senha)", () => {
  const doc = loadYaml(actionPath);
  const steps = stepsOf(doc.runs);
  for (const s of steps) {
    if (typeof s.run !== "string") continue;
    const leaks =
      /\b(echo|printf|cat|printenv)\b[^\n]*\$?\{?\s*(SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|inputs\.supabase-access-token|inputs\.supabase-db-password)/i.test(
        s.run,
      );
    assert.ok(!leaks, `step '${s.name ?? s.run}' não pode ecoar secrets nos logs`);
  }
});

// ---------------------------------------------------------------------------
// AC #6 — job deploy-supabase com needs: tests, checkout, uses composite, with secrets
// ---------------------------------------------------------------------------

test("AC6: existe job `deploy-supabase` em ubuntu-latest", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs?.["deploy-supabase"], "deve existir o job `deploy-supabase`");
  assert.equal(
    doc.jobs["deploy-supabase"]["runs-on"],
    "ubuntu-latest",
    "job deploy-supabase deve rodar em ubuntu-latest",
  );
});

test("AC6: job `deploy-supabase` declara `needs: tests`", () => {
  const doc = loadYaml(workflowPath);
  const needs = doc.jobs["deploy-supabase"].needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert.ok(needsList.includes("tests"), "deploy-supabase deve declarar needs: tests");
});

test("AC6: job faz checkout ANTES de usar o composite deploy-supabase", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-supabase"]);
  const checkoutIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout"),
  );
  const compositeIdx = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-supabase",
  );
  assert.ok(checkoutIdx >= 0, "deve haver um step actions/checkout");
  assert.ok(compositeIdx >= 0, "deve haver um step uses: ./.github/jobs/deploy-supabase");
  assert.ok(checkoutIdx < compositeIdx, "checkout deve vir ANTES do composite local");
});

test("AC6: job passa secrets ao composite via with: referenciando ${{ secrets.* }}", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-supabase"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-supabase",
  );
  assert.ok(compositeStep, "deve haver o step do composite");
  assert.ok(compositeStep.with, "o step do composite deve ter bloco with:");
  const withRaw = JSON.stringify(compositeStep.with);
  for (const key of ["supabase-access-token", "supabase-project-ref", "supabase-db-password"]) {
    assert.ok(compositeStep.with[key] !== undefined, `with deve passar '${key}'`);
  }
  assert.ok(/secrets\./.test(withRaw), "os valores devem referenciar ${{ secrets.* }}");
});

test("AC6: nenhum literal de secret no with: do job (usa ${{ secrets.* }})", () => {
  const doc = loadYaml(workflowPath);
  const steps = stepsOf(doc.jobs["deploy-supabase"]);
  const compositeStep = steps.find(
    (s) => typeof s.uses === "string" && s.uses === "./.github/jobs/deploy-supabase",
  );
  const withRaw = JSON.stringify(compositeStep.with ?? {});
  assert.ok(!withRaw.includes("lygkwhcwsrxfozswhxyo"), "project-ref não pode ser literal no with:");
  for (const key of ["supabase-access-token", "supabase-project-ref", "supabase-db-password"]) {
    assert.ok(
      /\$\{\{\s*secrets\./.test(String(compositeStep.with[key])),
      `with.${key} deve referenciar secrets.*`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC #7 — encadeamento: tests intacto; apenas tests + deploy-supabase
// ---------------------------------------------------------------------------

test("AC7: job `tests` (Story 11.3) permanece intacto", () => {
  const doc = loadYaml(workflowPath);
  assert.ok(doc.jobs.tests, "job tests deve continuar existindo");
  assert.equal(doc.jobs.tests["runs-on"], "ubuntu-latest", "job tests deve rodar em ubuntu-latest");
  const steps = stepsOf(doc.jobs.tests);
  assert.ok(
    steps.some((s) => typeof s.uses === "string" && s.uses === "./.github/jobs/tests"),
    "job tests deve continuar consumindo ./.github/jobs/tests",
  );
});

test("AC7: production.yml contém os jobs `tests` e `deploy-supabase` (e o `deploy-amplify` da 11.5)", () => {
  // NOTA (Story 11.5): o teste original travava a contagem exata em
  // `["deploy-supabase", "tests"]`. A Story 11.5 adicionou o job `deploy-amplify`
  // (`needs: deploy-supabase`), então este contrato foi atualizado para
  // `["deploy-amplify", "deploy-supabase", "tests"]` — análogo ao ajuste que a
  // 11.4 fez no teste AC5 da 11.3. A intenção da 11.4 permanece: `tests` e
  // `deploy-supabase` continuam existentes e encadeados (verificado abaixo e nos
  // testes AC6/AC7 dedicados). O job `smoke-test` (11.6) ainda não existe.
  const doc = loadYaml(workflowPath);
  const jobKeys = Object.keys(doc.jobs).sort();
  assert.deepEqual(
    jobKeys,
    ["deploy-amplify", "deploy-supabase", "tests"],
    "devem existir tests, deploy-supabase e deploy-amplify (sem smoke-test 11.6)",
  );
});
