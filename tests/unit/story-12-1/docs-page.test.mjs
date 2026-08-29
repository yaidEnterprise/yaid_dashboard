import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const page = read("app/docs/page.tsx");
const layout = read("app/docs/layout.tsx");

const sections = [
  ["visao-geral", "Visão geral"],
  ["conta-e-app", "Criando sua conta e seu primeiro app"],
  ["ambientes", "Ambientes: Homologação vs Produção"],
  ["proof-requests", "Solicitando uma verificação (Proof Request)"],
  ["webhooks", "Webhooks"],
];

describe("Story 12.1 — estrutura pública de /docs", () => {
  test("usa layout próprio com metadata, toaster e sem chrome do dashboard", () => {
    assert.match(layout, /export const metadata: Metadata/);
    assert.match(layout, /<Toaster/);
    assert.doesNotMatch(layout, /AppSidebar|AppTopbar/);
    assert.match(page, /src="\/yaid_(icon|logo)\.svg"/);
  });

  test("oferece skip link, conteúdo principal e navegação nomeada", () => {
    assert.match(page, /href="#conteudo"/);
    assert.match(page, /<main[^>]+id="conteudo"/);
    assert.match(page, /<nav[^>]+aria-label="Navegação da documentação"/);
    assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  });

  for (const [id, label] of sections) {
    test(`liga a navegação ao destino #${id}`, () => {
      assert.match(page, new RegExp(`href="#${id}"`));
      assert.match(page, new RegExp(`id="${id}"`));
      assert.ok(page.includes(label));
    });
  }

  test("mantém headings semânticos e offset de scroll nos cinco destinos", () => {
    assert.equal((page.match(/<h2\b/g) ?? []).length, 5);
    assert.equal((page.match(/scroll-mt-/g) ?? []).length >= 5, true);
  });
});

describe("Story 12.1 — conteúdo Conta e Apps", () => {
  test("reutiliza CodeBlock e InlineCode compartilhados", () => {
    assert.match(
      page,
      /import\s*\{\s*CodeBlock,\s*InlineCode\s*\}\s*from\s*"@\/components\/api\/code-block"/,
    );
    assert.match(page, /<CodeBlock/);
    assert.match(page, /<InlineCode/);
  });

  test("documenta o fluxo ponta a ponta na ordem esperada", () => {
    const terms = [
      "Criar sua conta",
      "Criar um app",
      "Guardar a API key",
      "Criar a proof request",
      "Redirecionar o holder",
      "Receber o webhook",
    ];
    let previous = -1;
    for (const term of terms) {
      const current = page.indexOf(term);
      assert.ok(current > previous, `${term} deve aparecer na ordem do fluxo`);
      previous = current;
    }
  });

  test("documenta signup, app, allowlist e reveal one-shot", () => {
    for (const required of [
      "/sign-up",
      "E-mail",
      "Senha",
      "Nome da empresa",
      "CNPJ",
      "/apps/new",
      "Webhook HTTPS opcional",
      "can_create_apps",
      "uma única vez",
    ]) {
      assert.ok(page.includes(required), `conteúdo ausente: ${required}`);
    }
  });

  test("explica os contratos de homologação e produção sem sugerir sandbox", () => {
    for (const required of [
      "imutável no MVP",
      "Aprovar",
      "Reprovar",
      "webhook real",
      "fluxo real do holder",
      "não há isolamento de dados",
      "é real nos dois ambientes",
    ]) {
      assert.ok(page.includes(required), `conteúdo ausente: ${required}`);
    }
  });

  test("usa somente exemplo de credencial explicitamente fictício", () => {
    assert.match(page, /yaid_sk_xxx/);
    assert.match(page, /fictíci[oa]/i);
    assert.doesNotMatch(page, /YAID_API_KEY\s*=\s*(?![^\n]*xxx)[^\n<]+/);
  });
});
