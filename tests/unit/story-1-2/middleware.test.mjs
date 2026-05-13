import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");
const assertFileExists = (rel) =>
  assert.ok(existsSync(fromRoot(rel)), `${rel} should exist`);
const assertFileMissing = (rel) =>
  assert.equal(existsSync(fromRoot(rel)), false, `${rel} should be deleted`);

test("Story 1.2 creates the Next.js middleware at src/shared/middleware.ts", () => {
  assertFileExists("src/shared/middleware.ts");
});

test("Story 1.2 creates middleware helper files", () => {
  assertFileExists("src/shared/middlewares/withSessionAuth.ts");
  assertFileExists("src/shared/middlewares/withApiKeyAuth.ts");
  assertFileExists("src/shared/middlewares/withDIDAuth.ts");
});

test("Story 1.2 deletes the dead proxy.ts from the project root", () => {
  assertFileMissing("proxy.ts");
});

test("Story 1.2 middleware exports the middleware function and config matcher", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /export async function middleware/, "middleware function must be exported");
  assert.match(src, /export const config/, "config matcher must be exported");
  assert.match(src, /_next\/static/, "matcher must exclude _next/static");
});

test("Story 1.2 middleware imports updateSupabaseSession from the proxy client", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /from\s+["']@\/shared\/clients\/supabase\/proxy["']/,
    "must import from @/shared/clients/supabase/proxy"
  );
  assert.match(src, /updateSupabaseSession/, "must call updateSupabaseSession");
});

test("Story 1.2 middleware routes POST /api/proof-requests to withApiKeyAuth", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /withApiKeyAuth/, "must call withApiKeyAuth");
  assert.match(
    src,
    /\/api\/proof-requests.*POST|POST.*\/api\/proof-requests/,
    "must check POST method on /api/proof-requests"
  );
});

test("Story 1.2 middleware routes DID auth paths to withDIDAuth stub", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /withDIDAuth/, "must call withDIDAuth");
  assert.match(src, /challenge/, "must route /challenge paths to DIDAuth");
  assert.match(src, /credentials/, "must route /credentials paths to DIDAuth");
});

test("Story 1.2 middleware redirects unauthenticated dashboard visitors to sign-in", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(src, /sign-in/, "must redirect to /sign-in");
  assert.match(src, /isDashboardPage|dashboard/, "must detect dashboard pages");
});

test("Story 1.2 session-auth route handlers do not call requireAuthenticatedUser", () => {
  const handlers = [
    "app/api/company-apps/route.ts",
    "app/api/company-apps/[appId]/route.ts",
    "app/api/companies/route.ts",
    "app/api/companies/me/route.ts",
    "app/api/proof-requests/route.ts",
    "app/api/proof-requests/[requestId]/route.ts",
  ];

  handlers.forEach((file) => {
    const src = readText(file);
    assert.equal(
      src.includes("requireAuthenticatedUser"),
      false,
      `${file} must not call requireAuthenticatedUser — auth is now handled by middleware`
    );
  });
});

test("Story 1.2 session-auth route handlers read x-company-id from request headers", () => {
  const handlers = [
    "app/api/company-apps/route.ts",
    "app/api/company-apps/[appId]/route.ts",
    "app/api/companies/route.ts",
    "app/api/companies/me/route.ts",
    "app/api/proof-requests/route.ts",
    "app/api/proof-requests/[requestId]/route.ts",
  ];

  handlers.forEach((file) => {
    const src = readText(file);
    assert.ok(
      src.includes("x-company-id"),
      `${file} must read x-company-id header injected by middleware`
    );
  });
});

test("Story 1.2 POST /api/proof-requests still uses getApiKeyFromRequest", () => {
  const src = readText("app/api/proof-requests/route.ts");
  assert.match(
    src,
    /getApiKeyFromRequest/,
    "POST handler must still extract API key via getApiKeyFromRequest"
  );
});

test("Story 1.2 withSessionAuth injects X-Company-Id and preserves Supabase cookies", () => {
  const src = readText("src/shared/middlewares/withSessionAuth.ts");
  assert.match(src, /x-company-id/, "must set x-company-id header");
  assert.match(src, /cookies/, "must handle Supabase cookie propagation");
  assert.match(src, /redirectOnFail/, "must support redirectOnFail option");
});

test("Story 1.2 withApiKeyAuth checks for bearer token or x-api-key header", () => {
  const src = readText("src/shared/middlewares/withApiKeyAuth.ts");
  assert.match(src, /bearer/i, "must check for Bearer token");
  assert.match(src, /x-api-key/i, "must check for X-Api-Key header");
  assert.match(src, /401/, "must return 401 when no key present");
});

test("Story 1.2 middleware files compile without TypeScript errors", { timeout: 120_000 }, () => {
  execFileSync("npx", ["tsc", "--noEmit"], {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
  });
});
