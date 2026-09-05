import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const readText = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

describe("Story 13.1 — dashboard route migration", () => {
  test("moves the unchanged overview route under /dashboard", () => {
    assert.equal(existsSync(path.join(root, "app/(dashboard)/page.tsx")), false);
    const overview = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(overview.startsWith('"use client"'));
    assert.match(overview, /export default function OverviewPage/);
  });

  test("protects dashboard route boundaries without treating / as dashboard", () => {
    const middleware = readText("src/shared/middleware.ts");
    assert.match(
      middleware,
      /const dashboardPaths = \["\/dashboard", "\/apps", "\/proof-requests", "\/settings"\]/,
    );
    assert.match(middleware, /pathname === p \|\| pathname\.startsWith\(`\$\{p\}\/`\)/);
    assert.doesNotMatch(middleware, /const dashboardPaths = \[[^\]]*["']\/["']/);
  });

  test("redirects authenticated root visits and passes anonymous root visits through", () => {
    const middleware = readText("src/shared/middleware.ts");
    assert.match(
      middleware,
      /if \(pathname === "\/"\) \{\s*if \(user\) \{\s*return NextResponse\.redirect\(new URL\("\/dashboard", request\.url\)\);\s*\}\s*return sessionResponse;\s*\}/s,
    );
  });

  test("redirects authenticated auth-page visits to /dashboard", () => {
    const middleware = readText("src/shared/middleware.ts");
    assert.match(
      middleware,
      /if \(user && \(pathname === "\/sign-in" \|\| pathname === "\/sign-up"\)\) \{\s*return NextResponse\.redirect\(new URL\("\/dashboard", request\.url\)\);/s,
    );
  });

  test("uses /dashboard as auth success fallback while preserving safe next paths", () => {
    const signIn = readText("app/sign-in/page.tsx");
    assert.match(
      signIn,
      /next && next\.startsWith\("\/"\) && !next\.startsWith\("\/\/"\) \? next : "\/dashboard"/,
    );
    assert.match(signIn, /router\.push\(safePath\)/);
    assert.match(readText("app/sign-up/page.tsx"), /router\.push\("\/dashboard"\)/);
  });

  test("links and activates Overview only at the /dashboard route boundary", () => {
    const sidebar = readText("components/layout/app-sidebar.tsx");
    assert.match(sidebar, /title: "Overview", url: "\/dashboard"/);
    assert.match(sidebar, /pathname === url \|\| pathname\.startsWith\(`\$\{url\}\/`\)/);
  });
});
