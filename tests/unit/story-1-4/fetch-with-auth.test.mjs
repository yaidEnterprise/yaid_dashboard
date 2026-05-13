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

// AC #3: file contract

test("Story 1.4 creates utils/fetch-with-auth.ts", () => {
  assertFileExists("utils/fetch-with-auth.ts");
});

test("Story 1.4 fetchWithAuth exports async function with same signature as native fetch", () => {
  const src = readText("utils/fetch-with-auth.ts");
  assert.match(src, /export async function fetchWithAuth/, "must export fetchWithAuth as async function");
  assert.match(src, /RequestInfo.*URL|URL.*RequestInfo/, "url param must be typed as RequestInfo | URL");
  assert.match(src, /RequestInit/, "options param must be typed as RequestInit");
  assert.match(src, /Promise<Response>/, "must return Promise<Response>");
});

// AC #1: 401 intercept and redirect

test("Story 1.4 fetchWithAuth checks for 401 status and redirects to /sign-in?next=", () => {
  const src = readText("utils/fetch-with-auth.ts");
  assert.match(src, /res\.status === 401/, "must check for HTTP 401");
  assert.match(src, /\/sign-in\?next=/, "must redirect to /sign-in with ?next= param");
  assert.match(src, /encodeURIComponent/, "must encode pathname to avoid URL injection in ?next=");
  assert.match(src, /window\.location\.pathname/, "must use current pathname as next value");
});

test("Story 1.4 fetchWithAuth throws after redirect to stop JS execution chain", () => {
  const src = readText("utils/fetch-with-auth.ts");
  assert.match(
    src,
    /throw new Error/,
    "must throw after setting window.location to prevent downstream code from processing 401"
  );
});

test("Story 1.4 fetchWithAuth guards window access for SSR safety", () => {
  const src = readText("utils/fetch-with-auth.ts");
  assert.match(
    src,
    /typeof window !== ["']undefined["']/,
    "must check typeof window to avoid crash if accidentally called during SSR"
  );
});

// AC #2: pass-through for non-401

test("Story 1.4 fetchWithAuth returns response normally for non-401 status", () => {
  const src = readText("utils/fetch-with-auth.ts");
  assert.match(src, /return res/, "must return the Response object for non-401 status codes");
});

// AC #3: apps-store.ts migration

test("Story 1.4 apps-store imports fetchWithAuth from @/utils/fetch-with-auth", () => {
  const src = readText("utils/apps-store.ts");
  assert.match(
    src,
    /import.*fetchWithAuth.*from\s+["']@\/utils\/fetch-with-auth["']/,
    "must import fetchWithAuth — not raw fetch — for authenticated API calls"
  );
});

test("Story 1.4 apps-store has exactly 4 fetchWithAuth calls covering all endpoints", () => {
  const src = readText("utils/apps-store.ts");
  const calls = [...src.matchAll(/\bfetchWithAuth\(/g)];
  assert.equal(
    calls.length,
    4,
    "must have exactly 4 fetchWithAuth calls: listApps, getApp, createApp, updateApp"
  );
});

test("Story 1.4 apps-store listApps calls fetchWithAuth on /api/company-apps", () => {
  const src = readText("utils/apps-store.ts");
  assert.match(
    src,
    /fetchWithAuth\(["']\/api\/company-apps["']/,
    "listApps must call fetchWithAuth for GET /api/company-apps"
  );
});

test("Story 1.4 apps-store getApp calls fetchWithAuth on /api/company-apps/{appId}", () => {
  const src = readText("utils/apps-store.ts");
  assert.match(
    src,
    /fetchWithAuth\(`\/api\/company-apps\/\$\{appId\}`/,
    "getApp must call fetchWithAuth for GET /api/company-apps/{appId}"
  );
});

test("Story 1.4 apps-store createApp calls fetchWithAuth with POST method", () => {
  const src = readText("utils/apps-store.ts");
  // There are 2 calls to /api/company-apps (listApps GET + createApp POST); createApp must use POST
  assert.match(
    src,
    /method:\s*["']POST["']/,
    "createApp must specify POST method in fetchWithAuth call"
  );
});

test("Story 1.4 apps-store updateApp calls fetchWithAuth with PATCH method", () => {
  const src = readText("utils/apps-store.ts");
  assert.match(
    src,
    /method:\s*["']PATCH["']/,
    "updateApp must specify PATCH method in fetchWithAuth call"
  );
});

// Review patch: settings/page.tsx must use plain fetch for sign-out

test("Story 1.4 settings/page.tsx uses plain fetch for sign-out — not fetchWithAuth", () => {
  const src = readText("app/(dashboard)/settings/page.tsx");
  assert.match(
    src,
    /await fetch\(["']\/api\/auth\/sign-out["']/,
    "sign-out must use plain fetch to avoid ?next=/settings redirect loop on expired session"
  );
  assert.equal(
    src.includes("fetchWithAuth"),
    false,
    "settings page must not import or call fetchWithAuth — semantic error if session expires during logout"
  );
});

test("Story 1.4 files compile without TypeScript errors", { timeout: 120_000 }, () => {
  execFileSync("npx", ["tsc", "--noEmit"], {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
  });
});
