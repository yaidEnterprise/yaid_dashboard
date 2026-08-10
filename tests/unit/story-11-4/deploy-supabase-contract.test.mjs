// Story 11.4 (QA) — Testes de contrato complementares para o composite
// `deploy-supabase` e seu encadeamento no orquestrador.
//
// Estes testes reforçam o que os testes de dev cobrem, focando em:
//  - ordenação COMPLETA dos steps (setup-cli -> link -> dry-run -> push);
//  - alinhamento de contrato orquestrador<->composite (as chaves do `with:`
//    batem exatamente com os `inputs` declarados);
//  - fronteira de secrets (secrets vivem no orquestrador como `${{ secrets.* }}`
//    e no composite apenas como `${{ inputs.* }}` — nunca o contrário).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const actionPath = resolve(repoRoot, ".github/jobs/deploy-supabase/action.yml");
const workflowPath = resolve(repoRoot, ".github/workflows/production.yml");

const readRaw = (p) => readFileSync(p, "utf8");
const loadYaml = (p) => yaml.load(readRaw(p));
const stepsOf = (n) => (Array.isArray(n?.steps) ? n.steps : []);

// ---------------------------------------------------------------------------
// Ordenação completa: setup-cli -> link -> dry-run -> push
// ---------------------------------------------------------------------------

test("QA: steps do composite seguem a ordem setup-cli -> link -> dry-run -> push", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  const idxSetup = steps.findIndex(
    (s) => typeof s.uses === "string" && s.uses.startsWith("supabase/setup-cli"),
  );
  const idxLink = steps.findIndex((s) => typeof s.run === "string" && /\bsupabase link\b/.test(s.run));
  const idxDry = steps.findIndex(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && /--dry-run\b/.test(s.run),
  );
  const idxPush = steps.findIndex(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && !/--dry-run\b/.test(s.run),
  );
  assert.ok(idxSetup >= 0 && idxLink >= 0 && idxDry >= 0 && idxPush >= 0, "todos os 4 steps devem existir");
  assert.ok(idxSetup < idxLink, "setup-cli deve preceder o link");
  assert.ok(idxLink < idxDry, "link deve preceder o dry-run");
  assert.ok(idxDry < idxPush, "dry-run deve preceder o push (apply)");
});

test("QA: existe exatamente UM step de apply `db push` sem --dry-run", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  const applySteps = steps.filter(
    (s) => typeof s.run === "string" && /\bsupabase db push\b/.test(s.run) && !/--dry-run\b/.test(s.run),
  );
  assert.equal(applySteps.length, 1, "deve haver exatamente um apply (evita push duplicado)");
});

// ---------------------------------------------------------------------------
// Alinhamento de contrato orquestrador <-> composite
// ---------------------------------------------------------------------------

test("QA: as chaves do `with:` do job batem EXATAMENTE com os inputs do composite", () => {
  const action = loadYaml(actionPath);
  const workflow = loadYaml(workflowPath);
  const declaredInputs = Object.keys(action.inputs ?? {}).sort();
  const compositeStep = stepsOf(workflow.jobs["deploy-supabase"]).find(
    (s) => s.uses === "./.github/jobs/deploy-supabase",
  );
  const passedWith = Object.keys(compositeStep?.with ?? {}).sort();
  assert.deepEqual(
    passedWith,
    declaredInputs,
    "toda input required deve ser passada pelo orquestrador, e nada além disso",
  );
});

test("QA: todo input required do composite é fornecido pelo `with:` do job", () => {
  const action = loadYaml(actionPath);
  const workflow = loadYaml(workflowPath);
  const compositeStep = stepsOf(workflow.jobs["deploy-supabase"]).find(
    (s) => s.uses === "./.github/jobs/deploy-supabase",
  );
  const withKeys = new Set(Object.keys(compositeStep?.with ?? {}));
  for (const [name, spec] of Object.entries(action.inputs ?? {})) {
    if (spec?.required === true) {
      assert.ok(withKeys.has(name), `input required '${name}' precisa ser passado no with:`);
    }
  }
});

// ---------------------------------------------------------------------------
// Fronteira de secrets
// ---------------------------------------------------------------------------

test("QA: os steps do composite NÃO referenciam `secrets.*` (secrets pertencem ao orquestrador)", () => {
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

test("QA: cada step run que usa a senha a expõe via env a partir de input (não literal)", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  for (const s of steps) {
    if (typeof s.run !== "string") continue;
    if (/\$SUPABASE_DB_PASSWORD|\$\{SUPABASE_DB_PASSWORD\}/.test(s.run)) {
      const envRaw = JSON.stringify(s.env ?? {});
      assert.ok(
        /inputs\.supabase-db-password/.test(envRaw),
        `step '${s.name ?? s.run}' deve definir SUPABASE_DB_PASSWORD via inputs.supabase-db-password`,
      );
    }
  }
});

test("QA: todo step run que fala com o Supabase expõe SUPABASE_ACCESS_TOKEN via input", () => {
  const steps = stepsOf(loadYaml(actionPath).runs);
  const supabaseRunSteps = steps.filter(
    (s) => typeof s.run === "string" && /\bsupabase\b/.test(s.run),
  );
  assert.ok(supabaseRunSteps.length >= 3, "deve haver link + dry-run + push");
  for (const s of supabaseRunSteps) {
    const envRaw = JSON.stringify(s.env ?? {});
    assert.ok(
      /inputs\.supabase-access-token/.test(envRaw),
      `step '${s.name ?? s.run}' deve expor SUPABASE_ACCESS_TOKEN via input (auth da CLI)`,
    );
  }
});

// ---------------------------------------------------------------------------
// Encadeamento sequencial: deploy-supabase depende de tests (gate)
// ---------------------------------------------------------------------------

test("QA: deploy-supabase é o segundo gate — depende só de `tests`", () => {
  const doc = loadYaml(workflowPath);
  const needs = doc.jobs["deploy-supabase"].needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert.deepEqual(needsList, ["tests"], "deploy-supabase deve depender exatamente de [tests]");
});
