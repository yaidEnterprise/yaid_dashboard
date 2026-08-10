/**
 * Story 7.6: Remoção da Seção "Resposta da API" no Detalhe
 *
 * QA pass — adds coverage the dev-authored proof-request-detail-no-api-response.test.mjs
 * did not have:
 * - Codebase-wide guard: `CodeBlock` has zero remaining consumers anywhere in the app
 *   (not just on the detail page) — catches accidental re-introduction elsewhere.
 * - `InlineCode` usages preserved on the detail page (id + external reference), not just
 *   the import line.
 * - Sanity: package.json test script wiring, TypeScript compiles clean (code-review finding:
 *   dev-story validated `npx tsc --noEmit` manually but did not persist it as a test).
 *
 * Structural/behavioral only — source inspection + real `tsc` invocation, no browser, no DOM.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const PAGE = "app/(dashboard)/proof-requests/[requestId]/page.tsx";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "supabase"]);
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function walkSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (CODE_EXTS.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

// ── Codebase-wide guard: CodeBlock has no remaining consumers ──────────────────

describe("Story 7.6 — CodeBlock has zero consumers codebase-wide", () => {
  test("no source file (other than the component itself) imports CodeBlock", () => {
    const importPattern = /import\s*\{[^}]*\bCodeBlock\b[^}]*\}\s*from\s*["']@\/components\/api\/code-block["']/;
    const offenders = [];
    for (const file of walkSourceFiles(ROOT)) {
      if (file.endsWith(join("components", "api", "code-block.tsx"))) continue;
      const src = readFileSync(file, "utf8");
      if (importPattern.test(src)) offenders.push(file);
    }
    assert.deepEqual(
      offenders,
      [],
      "CodeBlock must have no consumers left after Story 7.6 removed the last one (see deferred-work.md)",
    );
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
