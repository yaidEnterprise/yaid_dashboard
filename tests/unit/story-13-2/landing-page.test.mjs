import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const page = read("app/page.tsx");
const middleware = read("src/shared/middleware.ts");

const steps = [
  "Solicite",
  "Usuário confirma",
  "YaID verifica",
  "Receba o resultado",
];

describe("Story 13.2 — rota pública / (AC #1)", () => {
  test("serve / a partir de app/page.tsx, fora de qualquer route group", () => {
    assert.equal(existsSync(resolve(ROOT, "app/page.tsx")), true);
    assert.equal(existsSync(resolve(ROOT, "app/(dashboard)/page.tsx")), false);
    assert.equal(existsSync(resolve(ROOT, "app/(marketing)")), false);
    assert.equal(existsSync(resolve(ROOT, "app/layout.tsx")), true);
  });

  test("não carrega o chrome do dashboard nem um layout próprio", () => {
    assert.doesNotMatch(page, /AppSidebar|AppTopbar/);
    assert.doesNotMatch(page, /\(dashboard\)/);
    assert.equal(existsSync(resolve(ROOT, "app/layout-landing.tsx")), false);
  });

  test("é um Server Component estático, sem sessão, fetch ou estado", () => {
    assert.doesNotMatch(page, /"use client"|'use client'/);
    assert.doesNotMatch(page, /useState|useEffect|fetch\(/);
    assert.doesNotMatch(page, /supabase|createClient|getUser|cookies\(/i);
    assert.match(page, /export default function \w+\(\)/);
  });
});

describe("Story 13.2 — conteúdo institucional (AC #2)", () => {
  test("tem CTA principal para /sign-up e link secundário para /docs", () => {
    assert.match(page, /href="\/sign-up"/);
    assert.match(page, /href="\/docs"/);
    assert.match(page, /href="\/sign-in"/);
    assert.ok(page.includes("Criar conta"), "CTA principal deve usar verbo concreto");
  });

  test("apresenta a proposta de valor em um hero com h1 único", () => {
    assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(page.includes("Confirme quem importa"));
  });

  test('descreve "Como funciona" na sequência real de quatro passos', () => {
    assert.ok(page.includes("Como funciona"));
    let previous = -1;
    for (const step of steps) {
      const current = page.indexOf(step);
      assert.ok(current > previous, `passo fora de ordem ou ausente: ${step}`);
      previous = current;
    }
  });

  test("declara explicitamente o limite de privacidade da empresa", () => {
    assert.ok(page.includes("resultado da validação"));
    assert.match(page, /documentos/i);
    assert.match(page, /dados pessoais/i);
  });

  test("não expõe jargão SSI nem números inventados", () => {
    assert.doesNotMatch(page, /\bDIDs?\b|\bVCs?\b|\bVPs?\b|blockchain|self-sovereign/i);
    assert.doesNotMatch(page, /\d+(?:[.,]\d+)?\s*(?:%|mil|milhões|milhões\b)/i);
  });
});

describe("Story 13.2 — identidade visual e acessibilidade (AC #4)", () => {
  test("usa a marca oficial e os primitivos do projeto", () => {
    assert.match(page, /src="\/yaid_icon\.svg"/);
    assert.match(page, /from "next\/image"/);
    assert.match(page, /from "next\/link"/);
  });

  test("mantém estrutura semântica de página pública", () => {
    for (const tag of ["<header", "<nav", "<main", "<section", "<footer"]) {
      assert.ok(page.includes(tag), `elemento semântico ausente: ${tag}`);
    }
    assert.match(page, /href="#conteudo"/);
    assert.match(page, /<main[^>]+id="conteudo"/);
  });

  test("reaproveita os tokens de cor existentes em vez de cores cruas", () => {
    for (const token of ["bg-background", "text-text-primary", "border-border", "text-trust"]) {
      assert.ok(page.includes(token), `token ausente: ${token}`);
    }
    assert.doesNotMatch(page, /#[0-9a-fA-F]{6}\b/);
  });

  test("garante foco visível e respeita prefers-reduced-motion", () => {
    assert.match(page, /focus-visible:ring/);
    assert.match(page, /motion-reduce:/);
  });

  test("é mobile-first: as variantes de breakpoint só ampliam o layout base", () => {
    assert.match(page, /\bsm:|\bmd:|\blg:/);
    assert.doesNotMatch(page, /max-sm:|max-md:|max-lg:/);
  });
});

describe("Story 13.2 — visitante autenticado em / (AC #3)", () => {
  test("o redirect para /dashboard permanece no middleware da 13.1", () => {
    assert.match(
      middleware,
      /if \(pathname === "\/"\) \{\s*if \(user\) \{\s*return NextResponse\.redirect\(new URL\("\/dashboard", request\.url\)\);\s*\}\s*return sessionResponse;\s*\}/s,
    );
  });

  test("/ não é tratada como rota de dashboard protegida", () => {
    assert.doesNotMatch(middleware, /const dashboardPaths = \[[^\]]*["']\/["']/);
  });
});
