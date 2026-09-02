/**
 * Story 11.7 — QA contract tests (complementam os testes estruturais do dev).
 *
 * Foco em invariantes de CONTRATO que o teste do dev não cobre:
 *  - Doc-drift guard: TODO caminho de arquivo referenciado no runbook existe de fato no repo
 *    (cross-links não podem apontar para arquivos inexistentes).
 *  - Diagramas: o runbook tem os diagramas mermaid (fluxo por release + ONCE/EACH).
 *  - IAM (invariantes mais estritas que o teste do dev):
 *      · deploy role: conjunto EXATO das 5 ações amplify (nem a mais, nem a menos), todo Resource com o app-id;
 *      · trust policy: Principal.Federated apontando para o OIDC provider do GitHub, com Condition
 *        escopando o `sub` ao repo (nunca "*").
 *  - Consistência com a pipeline real: os 4 nomes de job e a cadeia aparecem; os números de
 *    polling/retry do runbook batem com os composites reais (15 min / 5 min).
 *
 * Estrutural/de contrato apenas — GitHub Actions e AWS não rodam no sandbox.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, normalize } from "node:path";

const ROOT = resolve(process.cwd());
const DOC_PATH = "docs/deployment/production-cicd.md";
const doc = readFileSync(resolve(ROOT, DOC_PATH), "utf8");

function extractJsonBlocks(md) {
  const blocks = [];
  const re = /```json\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md)) !== null) blocks.push(m[1]);
  return blocks;
}
const policies = extractJsonBlocks(doc).map((b) => JSON.parse(b));
const stmtsOf = (p) => (Array.isArray(p.Statement) ? p.Statement : [p.Statement]);
const arrify = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

describe("Story 11.7 QA — doc-drift guard (cross-links existem)", () => {
  // Caminhos de arquivo do repo mencionados no runbook (links markdown e menções).
  const referenced = [
    "docs/ops/amplify-deploy.md",
    "app/api/health/route.ts",
    ".github/workflows/production.yml",
    ".github/jobs/tests/action.yml",
    ".github/jobs/deploy-supabase/action.yml",
    ".github/jobs/deploy-amplify/action.yml",
    ".github/jobs/smoke-test/action.yml",
    "amplify.yml",
    "supabase/migrations/20260728015653_remote_schema.sql",
  ];
  for (const rel of referenced) {
    test(`o runbook menciona e o arquivo existe: ${rel}`, () => {
      assert.ok(doc.includes(rel), `runbook deve referenciar ${rel}`);
      assert.ok(existsSync(resolve(ROOT, rel)), `${rel} deve existir no repo (link não pode quebrar)`);
    });
  }

  test("todos os links markdown relativos resolvem para arquivos existentes", () => {
    const linkRe = /\]\((\.\.\/[^)]+\.(?:md|ts|yml|yaml|sql))\)/g;
    const docDir = resolve(ROOT, "docs/deployment");
    let m;
    let checked = 0;
    while ((m = linkRe.exec(doc)) !== null) {
      const target = normalize(resolve(docDir, m[1]));
      assert.ok(existsSync(target), `link relativo quebrado: ${m[1]} -> ${target}`);
      checked++;
    }
    assert.ok(checked >= 4, `esperado >= 4 links relativos verificados, houve ${checked}`);
  });
});

describe("Story 11.7 QA — diagramas mermaid", () => {
  test("há pelo menos 2 diagramas mermaid (fluxo por release + ONCE/EACH)", () => {
    const count = (doc.match(/```mermaid/g) || []).length;
    assert.ok(count >= 2, `esperado >= 2 diagramas mermaid, encontrado ${count}`);
  });
});

describe("Story 11.7 QA — IAM invariantes estritas", () => {
  test("deploy role: conjunto EXATO das 5 ações amplify e todo Resource com o app-id", () => {
    const expected = [
      "amplify:GetBranch",
      "amplify:GetJob",
      "amplify:ListJobs",
      "amplify:StartJob",
      "amplify:UpdateBranch",
    ];
    const deploy = policies.find((p) =>
      stmtsOf(p).some((s) => arrify(s.Action).some((a) => a.startsWith("amplify:")))
    );
    assert.ok(deploy, "deve existir a policy do deploy role");
    const s = stmtsOf(deploy).find((st) => arrify(st.Action).some((a) => a.startsWith("amplify:")));
    const actions = [...arrify(s.Action)].sort();
    assert.deepEqual(actions, expected, "deploy role deve ter EXATAMENTE as 5 ações amplify esperadas");
    const resources = arrify(s.Resource);
    assert.ok(resources.length >= 1, "deploy role deve ter ao menos 1 Resource");
    for (const r of resources) {
      assert.notEqual(r, "*", "Resource do deploy role não pode ser '*'");
      assert.match(r, /^arn:aws:amplify:.*apps\/<app-id>/, "Resource deve escopar o app-id do Amplify");
    }
  });

  test("trust policy: Principal.Federated aponta para o OIDC provider do GitHub, com Condition escopando o sub ao repo", () => {
    const trust = policies.find((p) =>
      stmtsOf(p).some((s) => s.Principal !== undefined)
    );
    assert.ok(trust, "deve existir a trust policy do deploy role");
    const stmts = stmtsOf(trust).filter((s) => s.Principal !== undefined);
    assert.ok(stmts.length > 0, "trust policy deve ter ao menos 1 statement com Principal");
    for (const s of stmts) {
      assert.notEqual(s.Principal, "*", "Principal não pode ser '*'");
      const federated = s.Principal.Federated;
      assert.ok(federated, "trust policy deve declarar Principal.Federated (OIDC), não Principal.AWS (IAM user)");
      for (const f of arrify(federated)) {
        assert.notEqual(f, "*", "Principal.Federated não pode ser '*'");
        assert.match(
          f,
          /^arn:aws:iam::.*:oidc-provider\/token\.actions\.githubusercontent\.com$/,
          "Principal.Federated deve apontar para o OIDC provider do GitHub (token.actions.githubusercontent.com)",
        );
      }
      assert.equal(
        s.Action,
        "sts:AssumeRoleWithWebIdentity",
        "trust policy OIDC deve usar sts:AssumeRoleWithWebIdentity",
      );
      assert.ok(s.Condition, "trust policy OIDC deve declarar Condition");
      const aud = s.Condition.StringEquals?.["token.actions.githubusercontent.com:aud"];
      assert.equal(
        aud,
        "sts.amazonaws.com",
        "Condition deve fixar token.actions.githubusercontent.com:aud como sts.amazonaws.com",
      );
      const subCondition =
        s.Condition.StringEquals?.["token.actions.githubusercontent.com:sub"] ??
        s.Condition.StringLike?.["token.actions.githubusercontent.com:sub"];
      assert.ok(subCondition, "Condition deve escopar token.actions.githubusercontent.com:sub");
      // Regra estrita: nem "*" nem qualquer wildcard/prefixo genérico — precisa ser um
      // valor exato "repo:<org>/<repo>:ref:refs/heads/<branch>". Um regex frouxo como
      // /^repo:/ deixaria passar "repo:org/repo:*" (qualquer branch/PR/tag), a
      // misconfiguration mais comum de trust policy OIDC.
      assert.notEqual(subCondition, "*", "Condition do sub nunca pode ser '*'");
      assert.match(
        subCondition,
        /^repo:[^/*]+\/[^:*]+:ref:refs\/heads\/[^*]+$/,
        "Condition do sub deve ser um valor exato repo:<org>/<repo>:ref:refs/heads/<branch> — sem wildcards",
      );
    }
  });

  test("nenhuma policy declara Effect: Deny disfarçando privilégio amplo (todas Allow escopadas)", () => {
    for (const p of policies) {
      for (const s of stmtsOf(p)) {
        assert.equal(s.Effect, "Allow", "todas as statements deste runbook são Allow escopadas");
      }
    }
  });
});

describe("Story 11.7 QA — consistência com a pipeline real", () => {
  test("os 4 jobs e a cadeia completa aparecem", () => {
    for (const j of ["tests", "deploy-supabase", "deploy-amplify", "smoke-test"]) {
      assert.ok(doc.includes(j), `deve mencionar o job ${j}`);
    }
    assert.match(
      doc,
      /tests\s*(?:→|->)\s*deploy-supabase\s*(?:→|->)\s*deploy-amplify\s*(?:→|->)\s*smoke-test/
    );
  });

  test("os tempos de polling/retry do runbook batem com os composites reais", () => {
    // deploy-amplify: 60 x 15s = 15 min ; smoke-test: 30 x 10s = 5 min
    const amplify = readFileSync(resolve(ROOT, ".github/jobs/deploy-amplify/action.yml"), "utf8");
    const smoke = readFileSync(resolve(ROOT, ".github/jobs/smoke-test/action.yml"), "utf8");
    assert.ok(amplify.includes("max_attempts=60") && amplify.includes("sleep_seconds=15"),
      "sanidade: composite amplify usa 60x15s");
    assert.ok(smoke.includes("max_attempts=30") && smoke.includes("sleep_seconds=10"),
      "sanidade: composite smoke-test usa 30x10s");
    assert.ok(doc.includes("15 min"), "runbook deve citar o timeout de 15 min do polling do Amplify");
    assert.ok(doc.includes("5 min"), "runbook deve citar o timeout de 5 min do smoke-test");
  });
});
