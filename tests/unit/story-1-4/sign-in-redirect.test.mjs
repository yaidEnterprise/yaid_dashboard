import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");

// AC #1: sign-in reads ?next= and redirects after successful login

test("Story 1.4 sign-in page reads ?next= search param after successful login", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /URLSearchParams|useSearchParams/,
    "must read ?next= from URL search params to support post-login redirect"
  );
  assert.match(
    src,
    /['"](next)['"]/,
    "must retrieve the 'next' param by name"
  );
});

test("Story 1.4 sign-in validates next param to block open redirect attacks", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /startsWith\(["']\/["']\)/,
    "must require next to start with / to reject absolute URLs like https://evil.com"
  );
  assert.match(
    src,
    /!.*startsWith\(["']\/\/["']\)|startsWith\(["']\/\/["']\).*!/,
    "must reject protocol-relative paths like //evil.com to prevent open redirect"
  );
});

test("Story 1.4 sign-in falls back to / when next is absent or unsafe", () => {
  const src = readText("app/sign-in/page.tsx");
  // The ternary must have a '/' fallback
  assert.match(
    src,
    /:\s*["']\/["']/,
    "must fall back to '/' root when next is null, empty, or fails open-redirect validation"
  );
});

// AC #3: stale code removed

test("Story 1.4 sign-in no longer calls /api/companies/me after login", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.equal(
    src.includes("/api/companies/me"),
    false,
    "stale /api/companies/me post-login check must be removed — company always exists after Story 1.1"
  );
});

test("Story 1.4 sign-in does not redirect to /onboarding/company after login", () => {
  const src = readText("app/sign-in/page.tsx");
  // href assignment to /onboarding/company must be gone; the Link for signup registration is unrelated
  const hasPostLoginOnboardingRedirect =
    /window\.location\.href\s*=\s*["']\/onboarding\/company["']/.test(src) ||
    /window\.location\.replace\s*\(\s*["']\/onboarding\/company["']/.test(src);
  assert.equal(
    hasPostLoginOnboardingRedirect,
    false,
    "must not redirect to /onboarding/company after login — route was removed in Story 1.1"
  );
});

// Inline behavioral test: open-redirect guard logic
// Replicates the guard logic from app/sign-in/page.tsx to verify edge cases deterministically

test("Story 1.4 open-redirect guard correctly classifies safe and unsafe paths", () => {
  function computeSafePath(next) {
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  // Safe: relative paths
  assert.equal(computeSafePath("/settings"), "/settings", "relative path must pass");
  assert.equal(computeSafePath("/dashboard"), "/dashboard", "dashboard path must pass");
  assert.equal(computeSafePath("/apps/123"), "/apps/123", "nested path must pass");
  assert.equal(
    computeSafePath("/dashboard?tab=apps"),
    "/dashboard?tab=apps",
    "path with query string must pass"
  );

  // Unsafe: absolute and protocol-relative URLs
  assert.equal(computeSafePath("//evil.com"), "/", "protocol-relative URL must be blocked");
  assert.equal(computeSafePath("https://evil.com"), "/", "https absolute URL must be blocked");
  assert.equal(computeSafePath("http://evil.com"), "/", "http absolute URL must be blocked");

  // Missing or empty
  assert.equal(computeSafePath(null), "/", "null must fall back to /");
  assert.equal(computeSafePath(undefined), "/", "undefined must fall back to /");
  assert.equal(computeSafePath(""), "/", "empty string must fall back to /");
});

test("Story 1.4 fetchWithAuth encodes pathname in ?next= to prevent URL injection", () => {
  const src = readText("utils/fetch-with-auth.ts");
  assert.match(
    src,
    /encodeURIComponent\(window\.location\.pathname\)/,
    "pathname must be URI-encoded before embedding in ?next= query param"
  );
});
