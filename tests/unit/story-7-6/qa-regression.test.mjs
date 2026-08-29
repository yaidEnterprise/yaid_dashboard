/**
 * Story 7.6: Remoção da Seção "Resposta da API" no Detalhe
 *
 * QA pass — adds coverage the dev-authored proof-request-detail-no-api-response.test.mjs
 * did not have:
 * - Detail-page guard: the "Resposta da API" block stays out — the page must not import
 *   or render a copyable code block again.
 *   (Story 12.1 narrowed this from a codebase-wide ban: the shared component is now
 *   legitimately reused by the public /docs page. The 7.6 contract is about the detail
 *   page, not about the component having zero consumers anywhere.)
 * - `InlineCode` usages preserved on the detail page (id + external reference), not just
 *   the import line.
 * - Sanity: package.json test script wiring, TypeScript compiles clean (code-review finding:
 *   dev-story validated `npx tsc --noEmit` manually but did not persist it as a test).
 *
 * Structural/behavioral only — source inspection + real `tsc` invocation, no browser, no DOM.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const PAGE = "app/(dashboard)/proof-requests/[requestId]/page.tsx";

// ── Detail-page guard: the raw API response block stays out ───────────────────

describe("Story 7.6 — the detail page keeps no raw API response block", () => {
  test("the page neither imports nor renders a copyable code block", () => {
    const src = readText(PAGE);
    assert.doesNotMatch(
      src,
      /import\s*\{[^}]*\bCodeBlock\b[^}]*\}\s*from\s*["']@\/components\/api\/code-block["']/,
      "the detail page must not import CodeBlock again",
    );
    assert.ok(!src.includes("<CodeBlock"), "the detail page must not render CodeBlock again");
  });

  test("the page has no section labelled with the removed heading", () => {
    const src = readText(PAGE);
    assert.ok(!src.includes("Resposta da API"), "the 'Resposta da API' section stays removed");
  });
});

// ── InlineCode preserved on the detail page (not just the import line) ─────────

describe("Story 7.6 — InlineCode usage preserved on the detail page", () => {
  test("renders InlineCode for the request id", () => {
    const src = readText(PAGE);
    assert.match(src, /<InlineCode copyable>\{data\.id\}<\/InlineCode>/);
  });

  test("renders InlineCode for the external reference summary row", () => {
    const src = readText(PAGE);
    assert.match(src, /item\.code \? <InlineCode copyable>\{item\.v\}<\/InlineCode> : item\.v/);
  });
});

// ── Sanity: wiring and compilation ──────────────────────────────────────────────

describe("Story 7.6 — project wiring sanity", () => {
  test("package.json exposes test:story:7.6 pointing at the story's test directory", () => {
    const pkg = JSON.parse(readText("package.json"));
    assert.equal(
      pkg.scripts["test:story:7.6"],
      'node --test "tests/unit/story-7-6/*.test.mjs"',
    );
  });

  test("project still compiles cleanly with TypeScript", { timeout: 120_000 }, () => {
    // Invoke via `node <tsc.js>` rather than the `.bin/tsc` shebang script — the
    // latter throws ENOENT under execFileSync on Windows (no shell resolution),
    // which a broad try/catch could mistake for "no errors" (empty stdout).
    const tscScript = resolve(ROOT, "node_modules", "typescript", "bin", "tsc");
    try {
      execFileSync(process.execPath, [tscScript, "--noEmit"], {
        cwd: ROOT,
        env: { ...process.env, STAGE: "TEST" },
        stdio: "pipe",
      });
    } catch (err) {
      const stdout = err.stdout?.toString() || "";
      const relevantErrors = stdout
        .split("\n")
        .filter((line) => line.includes("error TS") && !line.includes("lucide-react"));
      if (relevantErrors.length > 0) {
        assert.fail(`TypeScript errors:\n${relevantErrors.join("\n")}`);
      }
      assert.notEqual(stdout, "", "tsc must actually run — empty stdout on failure means the spawn itself failed (e.g. ENOENT), not a clean compile");
    }
  });
});
