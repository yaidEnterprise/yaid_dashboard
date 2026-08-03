/**
 * Story 8.2: Topbar Dinâmica Integrada à Company Logada
 *
 * Tests cover:
 * - AC #1: app-topbar.tsx consumes GET /api/companies/me via fetchWithAuth — no hardcoded company name
 * - AC #2: Skeleton (animate-pulse) present for loading state; no "never-a-placeholder" violation
 * - AC #3: aria-label on the avatar element
 * - AC #4: EnvBadge removed from topbar; hardcoded values "Acme Identidade Ltda.", "MR", "Maria R." absent
 * - Structure: file exists, fetchWithAuth import present, no EnvBadge import
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

function fileExists(relPath) {
  return existsSync(resolve(ROOT, relPath));
}

const TOPBAR = "components/layout/app-topbar.tsx";

// ── File existence ───────────────────────────────────────────────────────────

describe("Story 8.2 — File contracts", () => {
  test("app-topbar.tsx exists", () => {
    assert.ok(fileExists(TOPBAR), `${TOPBAR} should exist`);
  });
});

// ── AC #1: Dynamic data from GET /api/companies/me ───────────────────────────

describe("Story 8.2 — AC #1: Consumes GET /api/companies/me", () => {
  const src = readText(TOPBAR);

  test("imports fetchWithAuth", () => {
    assert.ok(
      src.includes("fetchWithAuth"),
      "app-topbar.tsx must import and use fetchWithAuth",
    );
  });

  test("calls /api/companies/me endpoint", () => {
    assert.ok(
      src.includes("/api/companies/me"),
      "app-topbar.tsx must fetch from /api/companies/me",
    );
  });

  test("uses useEffect for data fetching", () => {
    assert.ok(
      src.includes("useEffect"),
      "app-topbar.tsx must use useEffect to trigger the fetch on mount",
    );
  });

  test("uses useState to manage company data", () => {
    assert.ok(
      src.includes("useState"),
      "app-topbar.tsx must use useState to store company data and load state",
    );
  });

  test("derives initial from company name dynamically", () => {
    assert.ok(
      src.includes("charAt") || src.includes("toUpperCase"),
      "app-topbar.tsx must derive the avatar initial from company.name dynamically",
    );
  });
});

// ── AC #2: Skeleton during loading ───────────────────────────────────────────

describe("Story 8.2 — AC #2: Skeleton during loading state", () => {
  const src = readText(TOPBAR);

  test("has animate-pulse skeleton element for loading state", () => {
    assert.ok(
      src.includes("animate-pulse"),
      "app-topbar.tsx must render a Skeleton (animate-pulse) while loading",
    );
  });

  test("has error state handler (does not throw on fetch failure)", () => {
    assert.ok(
      src.includes("error") && src.includes("catch"),
      "app-topbar.tsx must handle fetch errors gracefully",
    );
  });

  test("loading state is tracked explicitly", () => {
    assert.ok(
      src.includes("loading"),
      "app-topbar.tsx must have an explicit loading state",
    );
  });
});

// ── AC #3: aria-label on avatar ──────────────────────────────────────────────

describe("Story 8.2 — AC #3: aria-label on avatar for accessibility", () => {
  const src = readText(TOPBAR);

  test("avatar has aria-label attribute", () => {
    assert.ok(
      src.includes("aria-label"),
      "app-topbar.tsx must include aria-label on the avatar element for screen reader accessibility",
    );
  });
});

// ── AC #4: Removal of hardcoded values and EnvBadge ─────────────────────────

describe("Story 8.2 — AC #4: No hardcoded placeholders, no EnvBadge", () => {
  const src = readText(TOPBAR);

  test('does not contain hardcoded "Acme Identidade Ltda."', () => {
    assert.ok(
      !src.includes("Acme Identidade Ltda."),
      'app-topbar.tsx must not contain the hardcoded placeholder "Acme Identidade Ltda."',
    );
  });

  test('does not contain hardcoded initials "MR" as JSX literal', () => {
    assert.ok(
      !src.includes(">MR<") && !src.includes('"MR"') && !src.includes("'MR'"),
      'app-topbar.tsx must not contain the hardcoded initials "MR"',
    );
  });

  test('does not contain hardcoded name "Maria R."', () => {
    assert.ok(
      !src.includes("Maria R."),
      'app-topbar.tsx must not contain the hardcoded name "Maria R."',
    );
  });

  test("does not import EnvBadge", () => {
    assert.ok(
      !src.includes("EnvBadge"),
      "app-topbar.tsx must not import or use EnvBadge — environment is an app-level attribute, not session-level",
    );
  });

  test("does not import environment-badge module", () => {
    assert.ok(
      !src.includes("environment-badge"),
      "app-topbar.tsx must not import from environment-badge",
    );
  });
});

// ── Structure: purely UI change ──────────────────────────────────────────────

describe("Story 8.2 — Structure: purely UI change", () => {
  test("companies/me route.ts still exists with GET handler (backend untouched)", () => {
    assert.ok(
      fileExists("app/api/companies/me/route.ts"),
      "app/api/companies/me/route.ts must exist — backend is untouched",
    );
    const routeSrc = readText("app/api/companies/me/route.ts");
    assert.ok(
      routeSrc.includes("GET"),
      "app/api/companies/me/route.ts must still export GET handler",
    );
  });

  test("GetMyCompanyUseCase still exists (backend untouched)", () => {
    assert.ok(
      fileExists("src/modules/company/app/get_my_company_usecase.ts"),
      "GetMyCompanyUseCase must exist — no backend changes in this story",
    );
  });
});
