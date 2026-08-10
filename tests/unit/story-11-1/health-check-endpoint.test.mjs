/**
 * Story 11.1: Health Check Endpoint
 *
 * Tests cover:
 * - AC #1: GET /api/health returns { status: "ok" } with 200 and Cache-Control: no-store
 * - AC #2: route exports dynamic = "force-dynamic"
 * - AC #3: route has no DB/env/domain-module dependencies (infra-only)
 * - AC #4: middleware classifies GET /api/health as a public API route
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const ROUTE = "app/api/health/route.ts";
const MIDDLEWARE = "src/shared/middleware.ts";

describe("Story 11.1 — GET /api/health route (AC #1, #2, #3)", () => {
  test("exports dynamic = 'force-dynamic'", () => {
    const src = readText(ROUTE);
    assert.match(src, /export const dynamic\s*=\s*["']force-dynamic["'];?/);
  });

  test("exports a GET handler with no params", () => {
    const src = readText(ROUTE);
    assert.match(src, /export function GET\(\)/);
  });

  test("returns { status: 'ok' } with HTTP 200", () => {
    const src = readText(ROUTE);
    assert.match(src, /NextResponse\.json\(\s*\{\s*status:\s*["']ok["']\s*\}/);
    assert.match(src, /status:\s*200/);
  });

  test("sets Cache-Control: no-store", () => {
    const src = readText(ROUTE);
    assert.match(src, /["']Cache-Control["']:\s*["']no-store["']/);
  });

  test("does not import Environments/environments.ts", () => {
    const src = readText(ROUTE);
    assert.equal(/from ["']@\/shared\/environments["']/.test(src), false);
    assert.equal(/Environments/.test(src), false);
  });

  test("does not import Supabase", () => {
    const src = readText(ROUTE);
    assert.equal(/@supabase\//.test(src), false);
  });

  test("does not import any domain module (src/modules/*)", () => {
    const src = readText(ROUTE);
    assert.equal(/from ["']@\/modules\//.test(src), false);
    assert.equal(/src\/modules\//.test(src), false);
  });

  test("only imports from next/server", () => {
    const src = readText(ROUTE);
    const importLines = src
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));
    for (const line of importLines) {
      assert.match(line, /from ["']next\/server["']/);
    }
  });
});

describe("Story 11.1 — middleware public route classification (AC #4)", () => {
  test("isPublicApiRoute classifies GET /api/health as public", () => {
    const src = readText(MIDDLEWARE);
    assert.match(
      src,
      /pathname === "\/api\/health" && method === "GET"/,
      "isPublicApiRoute must cover GET /api/health"
    );
  });

  test("health whitelist entry lives inside isPublicApiRoute (not another classifier)", () => {
    const src = readText(MIDDLEWARE);
    const fnStart = src.indexOf("function isPublicApiRoute");
    const fnEnd = src.indexOf("\n}", fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    assert.match(fnBody, /pathname === "\/api\/health" && method === "GET"/);
  });

  test("no other route classifier was modified to reference /api/health (no accidental broadening)", () => {
    const src = readText(MIDDLEWARE);
    const otherClassifiers = [
      "isDashboardPage",
      "isPublicAuthPage",
      "isSessionAuthApiRoute",
      "isDIDAuthRoute",
    ];
    for (const fnName of otherClassifiers) {
      const fnStart = src.indexOf(`function ${fnName}`);
      const fnEnd = src.indexOf("\n}", fnStart);
      const fnBody = src.slice(fnStart, fnEnd);
      assert.equal(
        fnBody.includes("/api/health"),
        false,
        `${fnName} must not reference /api/health`
      );
    }
  });
});
