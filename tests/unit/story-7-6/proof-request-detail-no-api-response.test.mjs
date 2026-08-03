/**
 * Story 7.6: Remoção da Seção "Resposta da API" no Detalhe
 *
 * Contract tests (source-inspection, no TypeScript execution) covering:
 * - AC #1/#3: the raw "Resposta da API" CodeBlock section is removed from the
 *   detail page; summary, confirmed-attributes and privacy cards remain.
 * - AC #2: the CodeBlock import and the raw payload variable are removed —
 *   InlineCode import is preserved (still used for the request ID and
 *   external reference).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const PAGE = "app/(dashboard)/proof-requests/[requestId]/page.tsx";

describe("Story 7.6 — detail page: 'Resposta da API' section removed", () => {
  test("does not import CodeBlock from components/api/code-block", () => {
    const src = readText(PAGE);
    assert.equal(
      /import\s*\{[^}]*\bCodeBlock\b[^}]*\}\s*from\s*"@\/components\/api\/code-block"/.test(src),
      false,
      "CodeBlock import must be removed",
    );
  });

  test("still imports InlineCode from components/api/code-block", () => {
    const src = readText(PAGE);
    assert.match(
      src,
      /import\s*\{[^}]*\bInlineCode\b[^}]*\}\s*from\s*"@\/components\/api\/code-block"/,
      "InlineCode import must be preserved (still used for id/external reference)",
    );
  });

  test("does not render the 'Resposta da API' heading", () => {
    const src = readText(PAGE);
    assert.equal(src.includes("Resposta da API"), false, "heading must be removed");
  });

  test("does not build the raw JSON payload variable", () => {
    const src = readText(PAGE);
    assert.equal(
      /const\s+payload\s*=\s*JSON\.stringify/.test(src),
      false,
      "raw payload construction must be removed",
    );
  });

  test("does not reference CodeBlock anywhere in the page (JSX usage included)", () => {
    const src = readText(PAGE);
    assert.equal(src.includes("<CodeBlock"), false, "CodeBlock must not be rendered");
  });

  test("keeps the summary card", () => {
    const src = readText(PAGE);
    assert.match(src, /Resumo/, "summary card must remain");
  });

  test("keeps the confirmed attributes card", () => {
    const src = readText(PAGE);
    assert.match(src, /Atributos confirmados/, "confirmed attributes card must remain");
  });

  test("keeps the privacy card", () => {
    const src = readText(PAGE);
    assert.match(src, /Privacidade/, "privacy card must remain");
  });

  test("keeps the 2-column grid layout (main column + aside)", () => {
    const src = readText(PAGE);
    assert.match(src, /lg:grid-cols-3/, "grid must remain lg:grid-cols-3");
    assert.match(src, /lg:col-span-2/, "main column must remain lg:col-span-2");
  });
});
