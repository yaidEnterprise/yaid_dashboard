/**
 * Story 7.1: Fundação de Versionamento de Schema (Supabase Migrations + Baseline)
 *
 * Tests cover:
 * - AC #1: supabase/config.toml, supabase/migrations/, supabase/seed.sql versioned; .gitignore covers
 *   supabase/.branches and supabase/.temp
 * - AC #2: baseline migration captures the real deployed schema, including the known drift
 *   (proof_request: result/external_ref/validated_at, no updated_at; company: no can_create_apps;
 *   company_apps: has environment) — no new columns are introduced by this story
 *
 * Structural only — no database connection (local or remote). AC #3 (db reset) and AC #4 (CI diff)
 * are infra/CLI operations validated manually per Dev Notes, not something a structural test can assert.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const CONFIG_TOML = "supabase/config.toml";
const NESTED_GITIGNORE = "supabase/.gitignore";
const MIGRATIONS_DIR = "supabase/migrations";
const SEED_SQL = "supabase/seed.sql";

function findBaselineMigration() {
  const files = readdirSync(resolve(ROOT, MIGRATIONS_DIR))
    .filter((f) => /^\d{14}_.*\.sql$/.test(f))
    .sort();
  assert.ok(files.length >= 1, "expected at least one timestamped migration file");
  // Timestamped filenames sort lexicographically = chronologically; the earliest
  // one is the baseline this story generated, even after later stories add more.
  return readText(`${MIGRATIONS_DIR}/${files[0]}`);
}

// ── AC #1: infra files versioned ────────────────────────────────────────────

describe("Story 7.1 — Supabase migrations infrastructure (AC #1)", () => {
  test("supabase/config.toml exists with a project_id set", () => {
    assert.ok(existsSync(resolve(ROOT, CONFIG_TOML)), `${CONFIG_TOML} should exist`);
    const config = readText(CONFIG_TOML);
    assert.match(config, /^project_id\s*=\s*".+"/m);
  });

  test("supabase/migrations/ directory exists", () => {
    assert.ok(existsSync(resolve(ROOT, MIGRATIONS_DIR)), `${MIGRATIONS_DIR} should exist`);
  });

  test("supabase/seed.sql exists", () => {
    assert.ok(existsSync(resolve(ROOT, SEED_SQL)), `${SEED_SQL} should exist`);
  });

  test("supabase/.gitignore covers .branches and .temp", () => {
    assert.ok(existsSync(resolve(ROOT, NESTED_GITIGNORE)), `${NESTED_GITIGNORE} should exist`);
    const gitignore = readText(NESTED_GITIGNORE);
    assert.match(gitignore, /(^|\n)\.branches\b/);
    assert.match(gitignore, /(^|\n)\.temp\b/);
  });

  test("at least one timestamped baseline migration exists", () => {
    const files = readdirSync(resolve(ROOT, MIGRATIONS_DIR)).filter((f) =>
      /^\d{14}_.*\.sql$/.test(f),
    );
    assert.ok(files.length >= 1, "expected at least one <timestamp>_name.sql migration file");
  });
});

// ── AC #2: baseline is faithful to the real deployed schema (including drift) ──

describe("Story 7.1 — Baseline schema fidelity (AC #2)", () => {
  test("baseline creates all four expected tables", () => {
    const sql = findBaselineMigration();
    for (const table of ["company", "company_apps", "proof_request", "proof_sessions"]) {
      assert.match(
        sql,
        new RegExp(`CREATE TABLE public\\.${table}\\b`),
        `expected CREATE TABLE for public.${table}`,
      );
    }
  });

  test("proof_request table reflects the real drift: has result/external_ref/validated_at, no updated_at", () => {
    const sql = findBaselineMigration();
    const match = sql.match(/CREATE TABLE public\.proof_request \(([^;]*?)\);/s);
    assert.ok(match, "expected to find proof_request table definition");
    const columns = match[1];
    assert.match(columns, /\bresult\b/);
    assert.match(columns, /\bexternal_ref\b/);
    assert.match(columns, /\bvalidated_at\b/);
    assert.doesNotMatch(
      columns,
      /\bupdated_at\b/,
      "proof_request.updated_at must NOT exist yet — it is added by Story 7.2, not this baseline",
    );
  });

  test("company table reflects the real drift: no can_create_apps column yet", () => {
    const sql = findBaselineMigration();
    const match = sql.match(/CREATE TABLE public\.company \(([^;]*?)\);/s);
    assert.ok(match, "expected to find company table definition");
    assert.doesNotMatch(
      match[1],
      /\bcan_create_apps\b/,
      "company.can_create_apps must NOT exist yet — it is added by Story 7.3, not this baseline",
    );
  });

  test("company_apps table already has the environment column", () => {
    const sql = findBaselineMigration();
    const match = sql.match(/CREATE TABLE public\.company_apps \(([^;]*?)\);/s);
    assert.ok(match, "expected to find company_apps table definition");
    assert.match(match[1], /\benvironment\b/);
  });

  test("baseline has no appended forward-migration statements anywhere in the file", () => {
    // Whole-file scope, unlike the table-scoped checks above: guards against a stray
    // ALTER TABLE for a forward-migration column being appended after the CREATE TABLE
    // block instead of inside it.
    const sql = findBaselineMigration();
    assert.doesNotMatch(sql, /\bcan_create_apps\b/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.proof_request ADD COLUMN updated_at/);
  });
});
