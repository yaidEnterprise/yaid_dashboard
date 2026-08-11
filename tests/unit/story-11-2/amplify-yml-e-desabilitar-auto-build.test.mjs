/**
 * Story 11.2: amplify.yml e Desabilitar Auto-Build
 *
 * Tests cover:
 * - AC #1: amplify.yml exists, is valid YAML, defines version 1 with a frontend section,
 *   preBuild (npm ci) and build (npm run build) phases
 * - AC #2: artifacts.baseDirectory is exactly ".next" (Next.js Web Compute/SSR, never "out")
 * - AC #3: cache.paths includes node_modules/**\/*
 * - AC #4/#5: docs/ops/amplify-deploy.md exists and documents enableAutoBuild / "Auto build"
 *   for the "prod" branch, and the dependency on Story 11.5
 *
 * Structural only — no AWS Amplify CLI/API calls in this environment. Desabilitar o auto-build
 * é uma ação manual de infraestrutura real, fora do escopo de um teste automatizado (mesmo
 * padrão de "infra documentada, não executada" usado em outras stories de infraestrutura).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const AMPLIFY_YML = "amplify.yml";
const OPS_DOC = "docs/ops/amplify-deploy.md";
const NEXT_CONFIG = "next.config.ts";

// ── AC #1: amplify.yml exists, valid structure ──────────────────────────────

describe("Story 11.2 — amplify.yml exists and is well-formed (AC #1)", () => {
  test("amplify.yml exists at repo root", () => {
    assert.ok(existsSync(resolve(ROOT, AMPLIFY_YML)), `${AMPLIFY_YML} should exist`);
  });

  test("amplify.yml declares version: 1", () => {
    const yml = readText(AMPLIFY_YML);
    assert.match(yml, /^version:\s*1\s*$/m);
  });

  test("amplify.yml has a frontend section", () => {
    const yml = readText(AMPLIFY_YML);
    assert.match(yml, /^frontend:\s*$/m);
  });

  test("amplify.yml preBuild phase runs npm ci", () => {
    const yml = readText(AMPLIFY_YML);
    const preBuildMatch = yml.match(/preBuild:\s*\n\s*commands:\s*\n([\s\S]*?)\n\s*build:/);
    assert.ok(preBuildMatch, "expected to find a preBuild.commands block before build:");
    assert.match(preBuildMatch[1], /-\s*npm ci/);
  });

  test("amplify.yml build phase runs npm run build (next build)", () => {
    const yml = readText(AMPLIFY_YML);
    const buildMatch = yml.match(/\n\s*build:\s*\n\s*commands:\s*\n([\s\S]*?)\n\s*artifacts:/);
    assert.ok(buildMatch, "expected to find a build.commands block before artifacts:");
    assert.match(buildMatch[1], /-\s*npm run build/);
  });

  test("package.json build script maps to next build", () => {
    const pkg = readText("package.json");
    assert.match(pkg, /"build":\s*"next build"/);
  });

  test("amplify.yml uses spaces (not tabs) for indentation", () => {
    const yml = readText(AMPLIFY_YML);
    assert.doesNotMatch(yml, /\t/, "YAML should use spaces, not tabs, for indentation");
  });
});

// ── AC #2: baseDirectory is .next (SSR/Web Compute, not static export) ─────

describe("Story 11.2 — artifacts.baseDirectory is .next, not static export (AC #2)", () => {
  test("amplify.yml artifacts.baseDirectory is exactly .next", () => {
    const yml = readText(AMPLIFY_YML);
    assert.match(yml, /baseDirectory:\s*\.next\s*$/m);
  });

  test("amplify.yml does not point baseDirectory at a static export directory (out)", () => {
    const yml = readText(AMPLIFY_YML);
    assert.doesNotMatch(yml, /baseDirectory:\s*out\s*$/m);
  });

  test("next.config.ts does not configure static export (output: export)", () => {
    const config = readText(NEXT_CONFIG);
    assert.doesNotMatch(
      config,
      /output:\s*["']export["']/,
      "project must remain SSR/Web Compute — a static export config would contradict baseDirectory: .next",
    );
  });
});

// ── AC #3: cache paths include node_modules ─────────────────────────────────

describe("Story 11.2 — build cache configured for node_modules (AC #3)", () => {
  test("amplify.yml cache.paths includes node_modules/**/* as an active (non-commented) entry", () => {
    const yml = readText(AMPLIFY_YML);
    const cacheMatch = yml.match(/cache:\s*\n\s*paths:\s*\n([\s\S]*)$/);
    assert.ok(cacheMatch, "expected to find a cache.paths block");
    // Anchored to line-start (ignoring leading whitespace) so a commented-out
    // "# - node_modules/**/*" cannot satisfy this assertion.
    assert.match(cacheMatch[1], /^\s*-\s*node_modules\/\*\*\/\*\s*$/m);
  });

  test("amplify.yml cache.paths also caches .next/cache to avoid slow repeated builds", () => {
    const yml = readText(AMPLIFY_YML);
    const cacheMatch = yml.match(/cache:\s*\n\s*paths:\s*\n([\s\S]*)$/);
    assert.ok(cacheMatch, "expected to find a cache.paths block");
    assert.match(cacheMatch[1], /^\s*-\s*\.next\/cache\/\*\*\/\*\s*$/m);
  });

  test("amplify.yml excludes .next/cache from deploy artifacts (avoids bloated/slow uploads)", () => {
    const yml = readText(AMPLIFY_YML);
    assert.match(yml, /excludeFiles:\s*\n\s*-\s*cache\/\*\*\/\*/);
  });
});

// ── AC #4/#5: operational documentation for disabling Amplify auto-build ───

describe("Story 11.2 — auto-build disable documentation (AC #4, #5)", () => {
  test("docs/ops/amplify-deploy.md exists", () => {
    assert.ok(existsSync(resolve(ROOT, OPS_DOC)), `${OPS_DOC} should exist`);
  });

  test("documentation mentions enableAutoBuild / Auto build", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /enable-auto-build|enableAutoBuild|Auto [Bb]uild/);
  });

  test("documentation references the prod branch explicitly", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /\bprod\b/);
  });

  test("documentation provides the AWS CLI command for disabling auto-build", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /aws amplify update-branch/);
    assert.match(doc, /--no-enable-auto-build/);
  });

  test("documentation explains the console (manual) path as well as the CLI path", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /Console/i);
    assert.match(doc, /Branch settings|Auto build/i);
  });

  test("documentation states this is a manual action not executed by automation in this environment", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /manual|não é executada automaticamente|not executed automatically/i);
  });

  test("documentation references the dependency on Story 11.5 (deploy job)", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /11\.5/);
  });

  test("documentation includes a get-branch check before mutating, to avoid targeting the wrong app/branch", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /aws amplify get-branch/);
  });

  test("documentation includes a rollback (re-enable) command", () => {
    const doc = readText(OPS_DOC);
    assert.match(doc, /^\s*--enable-auto-build\s*$/m);
  });
});
