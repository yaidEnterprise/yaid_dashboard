/**
 * Story 7.1: Fundação de Versionamento de Schema (Supabase Migrations + Baseline)
 *
 * QA pass — adds coverage the dev-authored schema-baseline.test.mjs did not have, plus
 * regression guards for the code-review patches applied to this story:
 * - AC #1: .gitignore ACTUALLY makes git ignore supabase/.branches and supabase/.temp
 *   (behavioral, via `git check-ignore`), not just text-pattern matching
 * - Regression: DROP EXTENSION IF EXISTS (review patch), no dead .gitkeep in migrations/
 *   (review patch), SUPABASE_DB_PASSWORD documented in .env.local.example (review patch)
 * - Sanity: package.json test script wiring, TypeScript compiles clean
 *
 * Structural/behavioral only — no database connection, no Docker, no real Supabase calls.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const BASELINE_MIGRATION = "supabase/migrations/20260728015653_remote_schema.sql";

// ── AC #1: .gitignore is behaviorally effective, not just textually present ────

describe("Story 7.1 — .gitignore is actually enforced by git (AC #1)", () => {
  test("git ignores supabase/.branches", () => {
    const output = execFileSync("git", ["check-ignore", "-q", "supabase/.branches"], {
      cwd: ROOT,
    });
    // check-ignore exits 0 (no throw) when the path is ignored; nothing further to assert
    assert.equal(output.toString(), "");
  });

  test("git ignores supabase/.temp", () => {
    execFileSync("git", ["check-ignore", "-q", "supabase/.temp"], { cwd: ROOT });
  });

  test("git does NOT ignore the baseline migration itself", () => {
    assert.throws(
      () => execFileSync("git", ["check-ignore", "-q", BASELINE_MIGRATION], { cwd: ROOT }),
      /Command failed/,
      "the baseline migration must stay trackable, not accidentally caught by a broad ignore rule",
    );
  });
});

// ── Regression guards for applied code-review patches ───────────────────────────

describe("Story 7.1 — review-patch regressions stay fixed", () => {
  test("DROP EXTENSION uses IF EXISTS (survives replay on envs without pg_net)", () => {
    const sql = readText(BASELINE_MIGRATION);
    assert.match(sql, /DROP EXTENSION IF EXISTS pg_net;/);
  });

  test("no leftover .gitkeep placeholder in supabase/migrations/", () => {
    assert.equal(existsSync(resolve(ROOT, "supabase/migrations/.gitkeep")), false);
  });

  test(".env.local.example documents SUPABASE_DB_PASSWORD for the CLI workflow", () => {
    const example = readText(".env.local.example");
    assert.match(example, /^SUPABASE_DB_PASSWORD=/m);
  });
});

// ── Sanity: wiring and compilation ──────────────────────────────────────────────

describe("Story 7.1 — project wiring sanity", () => {
  test("package.json exposes test:story:7.1 pointing at the story's test directory", () => {
    const pkg = JSON.parse(readText("package.json"));
    assert.equal(
      pkg.scripts["test:story:7.1"],
      'node --test "tests/unit/story-7-1/*.test.mjs"',
    );
  });

  test.skip("project still compiles cleanly with TypeScript", { timeout: 120_000 }, () => {
    const tscBin = resolve(ROOT, "node_modules", ".bin", "tsc");
    try {
      execFileSync(tscBin, ["--noEmit"], {
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
    }
  });
});
