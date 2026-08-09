// Story 11.8 — QA contract tests: EXECUÇÃO REAL dos 4 guards adicionados pelo
// code review ao step "Sincroniza env vars no Amplify (replace autoritativo)"
// de `.github/jobs/deploy-amplify/action.yml`.
//
// Os testes estruturais do dev (`env-var-sync-authoritative.test.mjs`) só
// fazem regex/asserção sobre o texto do `run:` — o code review apontou isso
// como o gap central da suíte da 11.8 (deferred-work: "testes só fazem
// assertion sobre o texto/YAML do step, nunca executam de fato o pipeline
// grep/sed/jq com fixtures"). Este arquivo fecha esse gap: extrai o corpo
// bash real do step via `js-yaml` e o EXECUTA de verdade (`bash -c`) contra
// fixtures controladas (`.env.local.example` temporário + `SECRETS_JSON`/
// `VARS_JSON`), asserindo no exit code / mensagens de erro reais.
//
// `aws` (CLI real) não está disponível/autenticado no sandbox — o mesmo
// racional estrutural-apenas já aplicado aos steps start-job/polling nas
// Stories 11.2–11.7. Para os testes que atravessam o guard e chegam à
// chamada `aws amplify update-branch`, um stub `aws` fake é injetado no
// início do PATH (grava os argumentos recebidos em arquivo, sempre retorna
// 0) — isso permite executar o script de ponta a ponta, incluindo o caminho
// de sucesso, sem depender da AWS real.
//
// Cobre:
//  - Patch #2: guard de payload vazio (recusa o replace, exit 1, ::error::)
//  - Patch #3: guard de `.env.local.example` ausente/vazio/sem linhas válidas
//    (duas pré-condições distintas, sob `set -euo pipefail`)
//  - Patch #4: denylist de defesa em profundidade (AWS_*/AMPLIFY_*/
//    SUPABASE_ACCESS_TOKEN/GITHUB_TOKEN) — aborta antes de resolver o valor
//  - Caminho de sucesso: payload não-vazio chega ao `aws amplify update-branch`
//    real (via stub) com o mapa esperado

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const actionPath = resolve(repoRoot, ".github/jobs/deploy-amplify/action.yml");

function loadYaml(path) {
  return yaml.load(readFileSync(path, "utf8"));
}
function stepsOf(node) {
  return Array.isArray(node?.steps) ? node.steps : [];
}
function syncStepScript() {
  const action = loadYaml(actionPath);
  const steps = stepsOf(action.runs);
  const syncStep = steps.find(
    (s) => typeof s.run === "string" && /amplify update-branch/.test(s.run),
  );
  assert.ok(syncStep, "deve haver um step que roda amplify update-branch");
  assert.equal(syncStep.shell, "bash", "o step deve declarar shell: bash");
  return syncStep.run;
}

const SCRIPT = syncStepScript();

// ---------------------------------------------------------------------------
// Fixture harness: PATH com stub `aws`, workspace temporário com
// `.env.local.example`, execução real do script via `bash -c`.
// ---------------------------------------------------------------------------

// Each call to `runSyncStep` gets its OWN isolated fake-bin dir + aws-calls
// log (rather than a shared global one) so tests remain correct regardless
// of the test runner's scheduling/concurrency — no shared mutable state
// between test cases.
const tmpDirsToClean = [];

after(() => {
  for (const dir of tmpDirsToClean) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspace(envExampleContent) {
  const dir = mkdtempSync(join(tmpdir(), "story-11-8-workspace-"));
  tmpDirsToClean.push(dir);
  if (envExampleContent !== null) {
    writeFileSync(join(dir, ".env.local.example"), envExampleContent);
  }
  return dir;
}

/**
 * Executa o corpo real do step de sync via `bash -c`, com PATH apontando
 * primeiro para um stub `aws` NOVO e ISOLADO (para que resoluções
 * bem-sucedidas não toquem a AWS real, e cada teste tenha seu próprio log de
 * chamadas) e `GITHUB_WORKSPACE` apontando para um workspace fixture.
 * Retorna também `awsCalls`: as chamadas reais que o script fez ao stub.
 */
function runSyncStep({ workspace, secretsJson = "{}", varsJson = "{}" }) {
  const fakeBinDir = mkdtempSync(join(tmpdir(), "story-11-8-fakebin-"));
  tmpDirsToClean.push(fakeBinDir);
  const awsCallsLog = join(fakeBinDir, "aws-calls.log");
  const awsStub = join(fakeBinDir, "aws");
  writeFileSync(awsCallsLog, "");
  // Stub `aws`: registra os argumentos recebidos (um "registro" por
  // invocação, delimitado por um separador exclusivo — o payload
  // `--cli-input-json` é JSON pretty-printed com newlines internos, então
  // NÃO se pode contar invocações por linha) em `awsCallsLog` e sempre
  // retorna sucesso (exit 0) — permite executar o script real de ponta a
  // ponta sem depender de credenciais/rede.
  const CALL_SEPARATOR = "\n---story-11-8-aws-call-boundary---\n";
  writeFileSync(
    awsStub,
    `#!/usr/bin/env bash\nprintf '%s${CALL_SEPARATOR}' "$*" >> "${awsCallsLog}"\nexit 0\n`,
  );
  chmodSync(awsStub, 0o755);

  const env = {
    ...process.env,
    PATH: `${fakeBinDir}:${process.env.PATH}`,
    GITHUB_WORKSPACE: workspace,
    AWS_REGION: "us-east-1",
    AMPLIFY_APP_ID: "app-fake-id",
    AMPLIFY_BRANCH_NAME: "prod",
    VARS_JSON: varsJson,
    SECRETS_JSON: secretsJson,
  };

  function readAwsCalls() {
    try {
      return readFileSync(awsCallsLog, "utf8")
        .split(CALL_SEPARATOR)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  try {
    const stdout = execFileSync("bash", ["-c", SCRIPT], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "", awsCalls: readAwsCalls() };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
      awsCalls: readAwsCalls(),
    };
  }
}

// ---------------------------------------------------------------------------
// Patch #3 — `.env.local.example` ausente/vazio/sem linhas válidas
// ---------------------------------------------------------------------------

describe("Patch #3 (real bash): .env.local.example ausente/vazio/sem nomes válidos", () => {
  test("arquivo AUSENTE: exit 1 com mensagem clara antes do grep", () => {
    const workspace = makeWorkspace(null); // não cria o arquivo
    const result = runSyncStep({ workspace });
    assert.equal(result.code, 1, "deve abortar com exit 1");
    assert.match(
      result.stderr + result.stdout,
      /::error::\.env\.local\.example ausente ou vazio/,
      "mensagem de erro explícita esperada (não stderr cru de grep)",
    );
  });

  test("arquivo VAZIO (0 bytes): exit 1 com a mesma mensagem (guarda -s)", () => {
    const workspace = makeWorkspace("");
    const result = runSyncStep({ workspace });
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /::error::\.env\.local\.example ausente ou vazio/);
  });

  test("arquivo com bytes mas SEM linhas válidas (só comentários/blank): exit 1, guard #2 distinto do guard #1, script NÃO aborta cru sob pipefail", () => {
    const workspace = makeWorkspace("# só comentário\n\n   \n# outro comentário\n");
    const result = runSyncStep({ workspace });
    assert.equal(result.code, 1, "deve abortar com exit 1 explícito, não com falha crua do grep sob pipefail");
    assert.match(
      result.stderr + result.stdout,
      /::error::Nenhum nome de env var derivado/,
      "deve atingir o segundo guard (nomes vazios), distinto da pré-condição de arquivo ausente/vazio",
    );
  });

  test("caminho feliz: arquivo com 1 nome válido passa pelas duas pré-condições do patch #3", () => {
    const workspace = makeWorkspace("# comentário\nSTAGE=PROD\n\n");
    const result = runSyncStep({
      workspace,
      secretsJson: JSON.stringify({}),
      varsJson: JSON.stringify({ STAGE: "PROD" }),
    });
    assert.equal(result.code, 0, `esperado sucesso, obtido stderr: ${result.stderr}`);
    assert.equal(result.awsCalls.length, 1, "deve ter chegado até a chamada real do aws update-branch (stub)");
  });
});

// ---------------------------------------------------------------------------
// Patch #4 — denylist de defesa em profundidade (AC5)
// ---------------------------------------------------------------------------

describe("Patch #4 (real bash): denylist AWS_*/AMPLIFY_*/SUPABASE_ACCESS_TOKEN/GITHUB_TOKEN", () => {
  const denylistCases = [
    ["AWS_SECRET_ACCESS_KEY", "prefixo AWS_"],
    ["AWS_ACCESS_KEY_ID", "prefixo AWS_"],
    ["AMPLIFY_APP_ID", "prefixo AMPLIFY_"],
    ["AMPLIFY_BRANCH_NAME", "prefixo AMPLIFY_"],
    ["SUPABASE_ACCESS_TOKEN", "nome exato SUPABASE_ACCESS_TOKEN"],
    ["GITHUB_TOKEN", "nome exato GITHUB_TOKEN"],
  ];

  for (const [name, why] of denylistCases) {
    test(`nome '${name}' (${why}) em .env.local.example aborta o step ANTES de resolver o valor`, () => {
      const workspace = makeWorkspace(`${name}=placeholder\n`);
      const result = runSyncStep({
        workspace,
        secretsJson: JSON.stringify({ [name]: "should-never-be-read" }),
        varsJson: JSON.stringify({}),
      });
      assert.equal(result.code, 1, `deve abortar para ${name}`);
      assert.match(
        result.stderr + result.stdout,
        new RegExp(`::error::'${name}' parece um secret de infra`),
      );
      assert.equal(result.awsCalls.length, 0, "aws update-branch NUNCA deve ser chamado quando o denylist dispara");
    });
  }

  test("nomes legítimos que SÓ contêm o substring 'SUPABASE' (não o denylist exato) NÃO disparam o guard", () => {
    // SUPABASE_SECRET_KEY é uma env var legítima do .env.local.example (não é
    // SUPABASE_ACCESS_TOKEN) — garante que o denylist usa match exato/prefixo
    // correto e não um substring genérico "SUPABASE".
    const workspace = makeWorkspace("SUPABASE_SECRET_KEY=x\n");
    const result = runSyncStep({
      workspace,
      secretsJson: JSON.stringify({ SUPABASE_SECRET_KEY: "real-value" }),
      varsJson: JSON.stringify({}),
    });
    assert.equal(result.code, 0, `SUPABASE_SECRET_KEY não deve disparar o denylist; stderr: ${result.stderr}`);
    assert.equal(result.awsCalls.length, 1);
  });

  test("denylist é verificado ANTES da resolução Secrets->Variables (nome no meio de uma lista maior ainda aborta o replace inteiro)", () => {
    const workspace = makeWorkspace("STAGE=PROD\nGITHUB_TOKEN=x\nNEXT_PUBLIC_APP_URL=https://a.example\n");
    const result = runSyncStep({
      workspace,
      secretsJson: JSON.stringify({}),
      varsJson: JSON.stringify({ STAGE: "PROD", NEXT_PUBLIC_APP_URL: "https://a.example" }),
    });
    assert.equal(result.code, 1);
    assert.equal(result.awsCalls.length, 0, "um único nome no denylist deve abortar o replace inteiro, mesmo com outros nomes válidos na lista");
  });
});

// ---------------------------------------------------------------------------
// Patch #2 — guard de payload vazio (recusa o replace autoritativo)
// ---------------------------------------------------------------------------

describe("Patch #2 (real bash): guard de payload vazio antes do update-branch autoritativo", () => {
  test("todos os nomes SEM valor em Secrets/Variables: payload {} -> exit 1, aws NUNCA chamado", () => {
    const workspace = makeWorkspace("STAGE=PROD\nNEXT_PUBLIC_APP_URL=https://a.example\n");
    const result = runSyncStep({
      workspace,
      secretsJson: JSON.stringify({}),
      varsJson: JSON.stringify({}), // nenhum valor resolvido para nenhum nome
    });
    assert.equal(result.code, 1);
    assert.match(
      result.stderr + result.stdout,
      /::error::Nenhuma env var resolvida — recusando o replace autoritativo/,
    );
    assert.equal(result.awsCalls.length, 0, "não pode chamar update-branch com payload vazio (wipe silencioso do branch)");
  });

  test("VARS_JSON/SECRETS_JSON vazios ({}) simulando checkout/payload incorreto: mesmo guard dispara", () => {
    const workspace = makeWorkspace("STAGE=PROD\n");
    const result = runSyncStep({ workspace, secretsJson: "{}", varsJson: "{}" });
    assert.equal(result.code, 1);
    assert.equal(result.awsCalls.length, 0);
  });

  test("caminho de sucesso: ao menos 1 nome resolvido -> payload não-vazio -> update-branch REAL (stub) é chamado com o mapa esperado", () => {
    const workspace = makeWorkspace(
      "STAGE=PROD\nNEXT_PUBLIC_APP_URL=https://a.example\nSUPABASE_SECRET_KEY=unused\n",
    );
    const result = runSyncStep({
      workspace,
      secretsJson: JSON.stringify({ SUPABASE_SECRET_KEY: "the-secret" }),
      varsJson: JSON.stringify({ STAGE: "PROD", NEXT_PUBLIC_APP_URL: "https://a.example" }),
    });
    assert.equal(result.code, 0, `esperado sucesso; stderr: ${result.stderr}`);
    const calls = result.awsCalls;
    assert.equal(calls.length, 1, "deve chamar aws exatamente 1 vez");
    assert.match(calls[0], /amplify update-branch/);
    assert.match(calls[0], /--cli-input-json/);
    // O payload real (jq) deve conter os 3 nomes resolvidos com os valores certos.
    const cliInputMatch = calls[0].match(/--cli-input-json\s+(\{[\s\S]*\})$/);
    assert.ok(cliInputMatch, "deve haver um --cli-input-json com JSON ao final da chamada");
    const cliInput = JSON.parse(cliInputMatch[1]);
    assert.deepEqual(cliInput.environmentVariables, {
      STAGE: "PROD",
      NEXT_PUBLIC_APP_URL: "https://a.example",
      SUPABASE_SECRET_KEY: "the-secret",
    });
    assert.equal(cliInput.appId, "app-fake-id");
    assert.equal(cliInput.branchName, "prod");
  });

  test("nome resolvido para valor VAZIO (\"\") em Secrets e Variables é omitido do payload (AC2), não conta para o guard de payload não-vazio", () => {
    const workspace = makeWorkspace("STAGE=PROD\nOCR_API_URL=\n");
    const result = runSyncStep({
      workspace,
      secretsJson: JSON.stringify({}),
      varsJson: JSON.stringify({ STAGE: "PROD", OCR_API_URL: "" }),
    });
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    const calls = result.awsCalls;
    const cliInputMatch = calls[0].match(/--cli-input-json\s+(\{[\s\S]*\})$/);
    const cliInput = JSON.parse(cliInputMatch[1]);
    assert.deepEqual(cliInput.environmentVariables, { STAGE: "PROD" }, "OCR_API_URL vazio não deve entrar no payload");
  });
});

// ---------------------------------------------------------------------------
// Nota de escopo: os steps `start-job`/`get-job` (polling) do mesmo composite
// dependem da CLI `aws` real/autenticada e não são executados aqui — mesma
// abordagem estrutural-apenas já usada para eles nas Stories 11.2–11.7. Este
// arquivo executa apenas o step de sync (guards 2-4), que é 100% bash/jq/grep
// puro e não depende de rede real (o `aws` do caminho de sucesso é o stub).
