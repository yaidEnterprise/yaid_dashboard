import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";

const ROOT = resolve(process.cwd());
const PAGE = resolve(ROOT, "app/docs/page.tsx");
const LAYOUT = resolve(ROOT, "app/docs/layout.tsx");
const source = () => readFileSync(PAGE, "utf8");

describe("Story 12.2 — página pública de integração", () => {
  test("cria /docs como Server Component público com navegação acessível", () => {
    assert.ok(existsSync(PAGE), "app/docs/page.tsx deve existir");
    const src = source();

    assert.doesNotMatch(src, /^\s*["']use client["']/m);
    // O alvo do skip link é `#conteudo`, contrato fixado pela Story 12.1
    // (tests/unit/story-12-1/docs-page.test.mjs) e verificado no <main>.
    assert.match(src, /href=["']#conteudo["']/);
    assert.match(src, /<main[^>]+id=["']conteudo["']/);
    assert.match(src, /<nav[^>]+aria-label=/);
    assert.match(src, /id=["']proof-requests["']/);
    assert.match(src, /id=["']webhooks["']/);
    assert.match(src, /Solicitando uma verifica[cç][aã]o \(Proof Request\)/i);
    assert.match(src, />Webhooks</);
  });

  test("reutiliza marca, CodeBlock, InlineCode e feedback de cópia", () => {
    const src = source();

    assert.match(src, /yaid_(icon|logo)\.svg/);
    assert.match(src, /import\s*\{[^}]*CodeBlock[^}]*InlineCode[^}]*\}\s*from\s*["']@\/components\/api\/code-block["']/s);
    assert.match(src, /<CodeBlock/g);
    assert.match(src, /<InlineCode/g);
    // O Toaster que dá feedback ao copiar vive no layout público criado pela
    // Story 12.1 — montá-lo também na página duplicaria a região de anúncio.
    assert.match(readFileSync(LAYOUT, "utf8"), /<Toaster/);
  });
});

describe("Story 12.2 — contrato de proof request publicado", () => {
  test("documenta autenticação, body, response e helper reais", () => {
    const src = source();

    for (const expected of [
      "POST /api/proof-requests",
      "Authorization: Bearer",
      "proofType",
      "externalReference",
      "personhood",
      "age_over_18",
      "verificationUrl",
      "deepLinkUrl",
      "expiresAt",
    ]) {
      assert.ok(src.includes(expected), `documentação deve conter ${expected}`);
    }
    assert.doesNotMatch(
      src,
      /proof-requests\/new/,
      "documentação não deve referenciar a página removida /proof-requests/new"
    );
  });

  test("separa estados de proof request dos estados da sessão", () => {
    const src = source();

    for (const status of [
      "pending_user",
      "processing",
      "approved",
      "rejected",
      "expired",
      "waiting_user",
      "opened",
      "approved_by_user",
      "cancelled",
    ]) {
      assert.ok(src.includes(status), `documentação deve explicar ${status}`);
    }
    assert.match(src, /Status da proof request/i);
    assert.match(src, /Estado da sess[aã]o/i);
  });
});

describe("Story 12.2 — contrato e segurança dos webhooks", () => {
  test("documenta payload, headers e chave pública implementados", () => {
    const src = source();

    for (const expected of [
      "proofRequestId",
      "updatedAt",
      "X-YaID-Signature",
      "X-YaID-Timestamp",
      "Content-Type",
      "GET /api/webhook-public-key",
      'algorithm',
      'Ed25519',
    ]) {
      assert.ok(src.includes(expected), `documentação deve conter ${expected}`);
    }
  });

  test("o exemplo Node verifica base64 contra o raw body sem reserializar", () => {
    const src = source();

    assert.match(src, /@noble\/ed25519/);
    assert.match(src, /verifyAsync/);
    assert.match(src, /rawBody/);
    assert.match(src, /Buffer\.from\([^\n]+["']base64["']/);
    assert.match(src, /antes de JSON\.parse/i);
  });

  test("explica privacidade, sem prometer um campo valid no payload", () => {
    const src = source();

    for (const protectedTerm of ["VC", "VP", "DID", "dados pessoais"]) {
      assert.ok(src.includes(protectedTerm), `nota de privacidade deve citar ${protectedTerm}`);
    }
    assert.match(src, /status === ["']approved["']/);
    assert.match(src, /n[aã]o (?:inclui|envia|possui)[^\n]*valid/i);
  });

  test("usa somente identificadores e segredos claramente fictícios", () => {
    const src = source();

    assert.match(src, /11111111-1111-4111-8111-111111111111\.yaid_sk_xxx/);
    assert.doesNotMatch(src, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(src, /(?:api[_-]?key|secret)\s*[:=]\s*["'][A-Za-z0-9_-]{24,}["']/i);
  });
});
