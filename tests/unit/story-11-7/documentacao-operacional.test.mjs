/**
 * Story 11.7: Documentação Operacional do Release de Produção (Runbook end-to-end + IAM)
 *
 * Story de DOCUMENTAÇÃO — o artefato primário é `docs/deployment/production-cicd.md`. Como a Story 7.1
 * (fundação/docs), os testes são ESTRUTURAIS/DE CONTRATO sobre o próprio markdown: existência + seções
 * obrigatórias + parse dos blocos de policy JSON de IAM + ausência de wildcards/AdministratorAccess +
 * consolidação dos itens de hardening 11.1–11.6 + cross-links. GitHub Actions e AWS NÃO rodam no
 * sandbox — não há teste de execução da pipeline (esperado e correto).
 *
 *   AC #1  — doc existe, não vazio, tem H1
 *   AC #2  — arquitetura: trigger prod, cadeia dos 4 jobs, needs, estrutura distribuída
 *   AC #3  — descrição dos 4 jobs (tests / deploy-supabase / deploy-amplify / smoke-test)
 *   AC #4  — >= 2 blocos de policy JSON válidos (trust policy Principal.Federated/OIDC; deploy role amplify:* no ARN)
 *   AC #5  — nenhum bloco JSON contém AdministratorAccess / "Action":"*" / "Resource":"*"
 *   AC #6  — bootstrap (one-time) vs release (automático)
 *   AC #7  — custom domain + DNS + SSL
 *   AC #8  — migrations expand→contract (+ dry-run antes do apply)
 *   AC #9  — rollback (app Amplify + implicação de banco)
 *   AC #10 — troubleshooting consolidando hardening 11.1–11.6
 *   AC #11 — cross-links para amplify-deploy.md e app/api/health/route.ts (sem duplicar)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DOC_PATH = "docs/deployment/production-cicd.md";

function readDoc() {
  return readFileSync(resolve(ROOT, DOC_PATH), "utf8");
}

// Extrai o conteúdo de todos os code fences ```json do markdown.
function extractJsonBlocks(md) {
  const blocks = [];
  const re = /```json\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

const doc = existsSync(resolve(ROOT, DOC_PATH)) ? readDoc() : "";
const docLower = doc.toLowerCase();
const jsonBlocks = extractJsonBlocks(doc);

describe("Story 11.7 — AC #1: runbook existe, não vazio, com H1", () => {
  test("o arquivo docs/deployment/production-cicd.md existe", () => {
    assert.ok(existsSync(resolve(ROOT, DOC_PATH)), `${DOC_PATH} deve existir`);
  });

  test("o documento não é vazio", () => {
    assert.ok(doc.trim().length > 500, "o runbook deve ter conteúdo substancial");
  });

  test("tem um heading H1 (título de nível 1)", () => {
    assert.match(doc, /^#\s+.+/m, "deve haver um título '# ...'");
  });
});

describe("Story 11.7 — AC #2: arquitetura da pipeline", () => {
  test("documenta o trigger na branch prod", () => {
    assert.match(doc, /\bprod\b/, "deve mencionar a branch prod");
    assert.ok(docLower.includes("push"), "deve mencionar o trigger de push");
  });

  test("documenta a cadeia completa dos 4 jobs", () => {
    assert.match(
      doc,
      /tests\s*(?:→|->)\s*deploy-supabase\s*(?:→|->)\s*deploy-amplify\s*(?:→|->)\s*smoke-test/,
      "a cadeia tests → deploy-supabase → deploy-amplify → smoke-test deve estar documentada"
    );
  });

  test("menciona needs (gates sequenciais) e a estrutura distribuída (composite actions)", () => {
    assert.ok(docLower.includes("needs"), "deve mencionar o encadeamento via needs");
    assert.ok(docLower.includes("composite"), "deve mencionar composite actions");
    assert.ok(
      doc.includes(".github/jobs/") && doc.includes("production.yml"),
      "deve mencionar .github/jobs/ e production.yml"
    );
  });
});

describe("Story 11.7 — AC #3: os quatro jobs descritos", () => {
  const jobs = ["tests", "deploy-supabase", "deploy-amplify", "smoke-test"];
  for (const job of jobs) {
    test(`descreve o job ${job}`, () => {
      assert.ok(doc.includes(job), `o job ${job} deve ser descrito`);
    });
  }

  test("tests: Node 22 + npm ci + npm test", () => {
    assert.ok(docLower.includes("node 22") || doc.includes("Node 22"), "deve exigir Node 22");
    assert.ok(doc.includes("npm ci"), "deve mencionar npm ci");
    assert.ok(doc.includes("npm test"), "deve mencionar npm test");
  });

  test("deploy-supabase: link + db push --dry-run + db push", () => {
    assert.ok(doc.includes("db push --dry-run"), "deve mencionar db push --dry-run");
    assert.ok(docLower.includes("link"), "deve mencionar supabase link");
  });

  test("deploy-amplify: OIDC + sync env merge + start-job RELEASE + polling", () => {
    assert.ok(
      doc.includes("OIDC") || doc.includes("AssumeRoleWithWebIdentity"),
      "deve mencionar OIDC/AssumeRoleWithWebIdentity",
    );
    assert.ok(docLower.includes("merge"), "deve mencionar o sync de env por merge");
    assert.ok(doc.includes("RELEASE"), "deve mencionar start-job RELEASE");
    assert.ok(docLower.includes("polling"), "deve mencionar o polling finito");
  });

  test("smoke-test: GET /api/health, sucesso HTTP 200 {status:ok}", () => {
    assert.ok(doc.includes("/api/health"), "deve mencionar /api/health");
    assert.ok(doc.includes("200"), "deve mencionar HTTP 200");
    assert.match(doc, /status.{0,4}ok/i, "deve mencionar o corpo {status:ok}");
  });
});

describe("Story 11.7 — AC #4: policies IAM JSON válidas e least-privilege", () => {
  test("há pelo menos 2 blocos de código JSON", () => {
    assert.ok(
      jsonBlocks.length >= 2,
      `esperado >= 2 blocos de policy JSON (bootstrap + deploy role), encontrado ${jsonBlocks.length}`
    );
  });

  test("todos os blocos JSON parseiam com JSON.parse", () => {
    for (const [i, block] of jsonBlocks.entries()) {
      assert.doesNotThrow(
        () => JSON.parse(block),
        `bloco JSON #${i + 1} deve ser JSON válido`
      );
    }
  });

  test("existe uma trust policy com Principal.Federated (OIDC) e Condition no sub", () => {
    const hasOidcTrustPolicy = jsonBlocks.some((b) => {
      let p;
      try {
        p = JSON.parse(b);
      } catch {
        return false;
      }
      const stmts = Array.isArray(p.Statement) ? p.Statement : [p.Statement];
      return stmts.some((s) => {
        if (!s || !s.Principal || !s.Principal.Federated) return false;
        const federated = Array.isArray(s.Principal.Federated) ? s.Principal.Federated : [s.Principal.Federated];
        const hasGithubOidc = federated.some(
          (f) => typeof f === "string" && f.includes("token.actions.githubusercontent.com"),
        );
        const hasAudCondition =
          s.Condition?.StringEquals?.["token.actions.githubusercontent.com:aud"] === "sts.amazonaws.com";
        const sub =
          s.Condition?.StringEquals?.["token.actions.githubusercontent.com:sub"] ??
          s.Condition?.StringLike?.["token.actions.githubusercontent.com:sub"];
        // Mesma regra estrita do teste QA (production-cicd-contract.test.mjs): exige um
        // valor exato repo:<org>/<repo>:ref:refs/heads/<branch>, nunca "*" nem wildcard.
        const hasSubCondition =
          typeof sub === "string" && /^repo:[^/*]+\/[^:*]+:ref:refs\/heads\/[^*]+$/.test(sub);
        return s.Effect === "Allow" && hasGithubOidc && hasAudCondition && hasSubCondition;
      });
    });
    assert.ok(
      hasOidcTrustPolicy,
      "deve haver uma trust policy com Principal.Federated (OIDC do GitHub) e Condition escopando o sub",
    );
  });

  test("existe uma policy do deploy role com as ações amplify:* esperadas escopadas a um ARN", () => {
    const expected = [
      "amplify:StartJob",
      "amplify:GetJob",
      "amplify:GetBranch",
      "amplify:UpdateBranch",
      "amplify:ListJobs",
    ];
    const hasDeployRole = jsonBlocks.some((b) => {
      let p;
      try {
        p = JSON.parse(b);
      } catch {
        return false;
      }
      const stmts = Array.isArray(p.Statement) ? p.Statement : [p.Statement];
      return stmts.some((s) => {
        if (!s || !s.Action) return false;
        const actions = Array.isArray(s.Action) ? s.Action : [s.Action];
        const allExpected = expected.every((a) => actions.includes(a));
        const onlyAmplify = actions.every((a) => a.startsWith("amplify:"));
        const resources = Array.isArray(s.Resource) ? s.Resource : [s.Resource];
        const scopedToArn = resources.some(
          (r) => typeof r === "string" && r.includes("arn:aws:amplify:") && r.includes("apps/")
        );
        return allExpected && onlyAmplify && scopedToArn;
      });
    });
    assert.ok(
      hasDeployRole,
      "deve haver uma policy do deploy role com amplify:StartJob/GetJob/GetBranch/UpdateBranch/ListJobs no ARN do app"
    );
  });
});

describe("Story 11.7 — AC #5: least-privilege (negativo — sem wildcards)", () => {
  test("nenhum bloco JSON contém AdministratorAccess", () => {
    for (const [i, block] of jsonBlocks.entries()) {
      assert.ok(
        !block.includes("AdministratorAccess"),
        `bloco JSON #${i + 1} não deve conter AdministratorAccess`
      );
    }
  });

  test('nenhum bloco JSON tem "Action": "*"', () => {
    for (const [i, block] of jsonBlocks.entries()) {
      assert.ok(
        !/"Action"\s*:\s*"\*"/.test(block),
        `bloco JSON #${i + 1} não deve ter "Action": "*"`
      );
    }
  });

  test('nenhum bloco JSON tem "Resource": "*"', () => {
    for (const [i, block] of jsonBlocks.entries()) {
      assert.ok(
        !/"Resource"\s*:\s*"\*"/.test(block),
        `bloco JSON #${i + 1} não deve ter "Resource": "*"`
      );
    }
  });

  test("nenhuma ação/recurso wildcard também na forma de array", () => {
    for (const [i, block] of jsonBlocks.entries()) {
      let p;
      try {
        p = JSON.parse(block);
      } catch {
        continue;
      }
      const stmts = Array.isArray(p.Statement) ? p.Statement : [p.Statement];
      for (const s of stmts) {
        const actions = Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [];
        const resources = Array.isArray(s.Resource) ? s.Resource : s.Resource ? [s.Resource] : [];
        assert.ok(!actions.includes("*"), `bloco #${i + 1}: Action não pode conter "*"`);
        assert.ok(!resources.includes("*"), `bloco #${i + 1}: Resource não pode conter "*"`);
      }
    }
  });
});

describe("Story 11.7 — AC #6: bootstrap (one-time) vs release (automático)", () => {
  test("separa setup manual one-time de passos por release", () => {
    assert.ok(
      docLower.includes("one-time") || docLower.includes("uma única vez") || docLower.includes("bootstrap"),
      "deve descrever o setup one-time/bootstrap"
    );
    assert.ok(
      docLower.includes("por release") || docLower.includes("a cada release") || docLower.includes("automático"),
      "deve descrever os passos por release/automáticos"
    );
  });

  test("lista os passos manuais chave (desabilitar auto-build, IAM, secrets, domínio)", () => {
    assert.ok(docLower.includes("auto build") || docLower.includes("auto-build"), "auto-build");
    assert.ok(doc.includes("IAM"), "IAM");
    assert.ok(docLower.includes("secret"), "secrets");
    assert.ok(docLower.includes("dns") || docLower.includes("domínio") || docLower.includes("domain"), "domínio/DNS");
  });
});

describe("Story 11.7 — AC #7: custom domain + DNS + SSL", () => {
  test("documenta custom domain, DNS e SSL/TLS", () => {
    assert.ok(docLower.includes("domínio") || docLower.includes("domain"), "custom domain");
    assert.ok(docLower.includes("dns"), "DNS");
    assert.ok(docLower.includes("ssl") || docLower.includes("tls") || docLower.includes("certificado"), "SSL/TLS");
  });
});

describe("Story 11.7 — AC #8: migrations expand→contract", () => {
  test("documenta expand→contract e dry-run antes do apply", () => {
    assert.ok(docLower.includes("expand"), "expand");
    assert.ok(docLower.includes("contract"), "contract");
    assert.ok(doc.includes("db push --dry-run"), "dry-run antes do apply");
  });
});

describe("Story 11.7 — AC #9: rollback", () => {
  test("documenta rollback de app e implicação de banco", () => {
    assert.ok(docLower.includes("rollback"), "seção de rollback");
    assert.ok(docLower.includes("amplify"), "rollback do app no Amplify");
  });
});

describe("Story 11.7 — AC #10: troubleshooting + hardening consolidado 11.1–11.6", () => {
  test("tem seção de troubleshooting/known-issues", () => {
    assert.ok(
      docLower.includes("troubleshooting") || docLower.includes("known-issue") || docLower.includes("known issue"),
      "deve haver troubleshooting/known-issues"
    );
  });

  const items = [
    { label: "SHA-pinning das actions", test: (d) => d.includes("SHA") && (d.toLowerCase().includes("pin")) },
    { label: "pinning de versão do setup-cli", test: (d) => d.includes("setup-cli") },
    { label: "Web Compute (SSR) no App Amplify", test: (d) => d.toLowerCase().includes("web compute") },
    { label: "verificar auto-build desabilitado", test: (d) => d.toLowerCase().includes("auto build") || d.toLowerCase().includes("auto-build") },
    { label: "db push não-TTY", test: (d) => d.toLowerCase().includes("tty") },
    { label: "validação do payload JSON de env", test: (d) => d.toLowerCase().includes("payload") && d.toLowerCase().includes("json") },
    { label: "tolerância a erros transitórios", test: (d) => d.toLowerCase().includes("transit") },
  ];
  for (const item of items) {
    test(`consolida: ${item.label}`, () => {
      assert.ok(item.test(doc), `deve consolidar o item de hardening: ${item.label}`);
    });
  }
});

describe("Story 11.7 — AC #11: cross-links (sem duplicar)", () => {
  test("referencia docs/ops/amplify-deploy.md", () => {
    assert.ok(doc.includes("amplify-deploy.md"), "deve cross-linkar amplify-deploy.md (Story 11.2)");
  });

  test("referencia app/api/health/route.ts", () => {
    assert.ok(doc.includes("app/api/health/route.ts"), "deve referenciar o endpoint de health (Story 11.1)");
  });

  test("referencia o workflow e os composites", () => {
    assert.ok(doc.includes(".github/workflows/production.yml"), "deve referenciar o orquestrador");
    assert.ok(doc.includes(".github/jobs/"), "deve referenciar os composites");
  });
});
