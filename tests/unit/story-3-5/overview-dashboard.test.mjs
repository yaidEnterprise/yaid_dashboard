/**
 * Story 3.5: Overview do Dashboard
 *
 * Contract and pure-logic tests for:
 * - AC #1–#4: Adaptive "Próximo passo" card logic
 * - AC #4: timeAgo relative time formatter
 * - AC #4: File contracts — page.tsx imports real stores, not mock data
 * - AC #5: Loading/error states
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");
const assertFileExists = (rel) =>
  assert.ok(existsSync(fromRoot(rel)), `${rel} should exist`);

// ── Mirror of getNextStep from page.tsx ──────────────────────────────────────

function getNextStep(apps, proofRequests) {
  if (apps.length === 0) {
    return {
      title: "Crie seu primeiro aplicativo",
      description:
        "Para começar a usar a YaID, cadastre um app e receba sua API key para integração.",
      ctaLabel: "Criar aplicativo",
      ctaHref: "/apps/new",
    };
  }
  if (proofRequests.length === 0) {
    return {
      title: "Crie sua primeira solicitação de verificação",
      description:
        "Use sua API key para criar uma proof request via POST /api/proof-requests e validar a identidade dos seus usuários.",
      ctaLabel: "Ver solicitações",
      ctaHref: "/proof-requests",
    };
  }
  return {
    title: "Acompanhe suas validações",
    description:
      "Verifique o status das suas solicitações de verificação. Configure webhooks para receber notificações em tempo real.",
    ctaLabel: "Ver solicitações",
    ctaHref: "/proof-requests",
  };
}

// ── Mirror of timeAgo from page.tsx ──────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Story 3.5 file contracts", () => {
  test("page.tsx exists", () => {
    assertFileExists("app/(dashboard)/dashboard/page.tsx");
  });

  test("page.tsx imports listApps from apps-store", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      src.includes("listApps") && src.includes("apps-store"),
      "should import listApps from apps-store"
    );
  });

  test("page.tsx imports listProofRequests from proof-requests-store", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      src.includes("listProofRequests") && src.includes("proof-requests-store"),
      "should import listProofRequests from proof-requests-store"
    );
  });

  test("page.tsx imports fetchWithAuth for companies/me", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      src.includes("fetchWithAuth") && src.includes("/api/companies/me"),
      "should fetch company data via fetchWithAuth"
    );
  });

  test("page.tsx has no hardcoded mock data arrays", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      !src.includes("const recentRequests = ["),
      "should not have hardcoded recentRequests array"
    );
    assert.ok(
      !src.includes('"2.847"') && !src.includes('"2.413"'),
      "should not have hardcoded metric values"
    );
  });

  test("page.tsx uses 'use client' directive", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(src.startsWith('"use client"'), "should start with use client");
  });

  test("page.tsx includes privacy notice", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      src.includes("A YaID nunca expõe documentos brutos"),
      "should include static privacy notice"
    );
  });

  test("page.tsx handles loading state", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      src.includes("loading") && src.includes("setLoading"),
      "should have loading state management"
    );
  });

  test("page.tsx handles error state with retry", () => {
    const src = readText("app/(dashboard)/dashboard/page.tsx");
    assert.ok(
      src.includes("Tentar novamente"),
      "should have retry button in error state"
    );
  });
});

describe("getNextStep — adaptive card logic", () => {
  test("returns 'create app' when no apps exist (AC #2)", () => {
    const result = getNextStep([], []);
    assert.strictEqual(result.title, "Crie seu primeiro aplicativo");
    assert.strictEqual(result.ctaLabel, "Criar aplicativo");
    assert.strictEqual(result.ctaHref, "/apps/new");
  });

  test("returns 'create proof request' when apps exist but no proof requests (AC #3)", () => {
    const apps = [{ id: "app-1", name: "Test App" }];
    const result = getNextStep(apps, []);
    assert.strictEqual(result.title, "Crie sua primeira solicitação de verificação");
    assert.strictEqual(result.ctaLabel, "Ver solicitações");
    assert.strictEqual(result.ctaHref, "/proof-requests");
    assert.ok(result.description.includes("POST /api/proof-requests"));
  });

  test("returns 'track validations' when both exist (AC #4)", () => {
    const apps = [{ id: "app-1" }];
    const proofRequests = [{ id: "pr-1", status: "approved" }];
    const result = getNextStep(apps, proofRequests);
    assert.strictEqual(result.title, "Acompanhe suas validações");
    assert.strictEqual(result.ctaLabel, "Ver solicitações");
    assert.strictEqual(result.ctaHref, "/proof-requests");
    assert.ok(result.description.includes("webhook"));
  });

  test("prioritizes 'create app' even if proof requests exist without apps", () => {
    const result = getNextStep([], [{ id: "pr-1" }]);
    assert.strictEqual(result.title, "Crie seu primeiro aplicativo");
    assert.strictEqual(result.ctaHref, "/apps/new");
  });

  test("handles multiple apps and proof requests correctly", () => {
    const apps = [{ id: "app-1" }, { id: "app-2" }, { id: "app-3" }];
    const proofRequests = [
      { id: "pr-1", status: "approved" },
      { id: "pr-2", status: "pending_user" },
    ];
    const result = getNextStep(apps, proofRequests);
    assert.strictEqual(result.title, "Acompanhe suas validações");
  });
});

describe("timeAgo — relative time formatter", () => {
  test("returns 'agora' for timestamps less than 1 minute ago", () => {
    const now = new Date().toISOString();
    assert.strictEqual(timeAgo(now), "agora");
  });

  test("returns minutes for timestamps less than 1 hour ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(fiveMinAgo), "há 5 min");
  });

  test("returns hours for timestamps less than 24 hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(threeHoursAgo), "há 3 h");
  });

  test("returns days for timestamps more than 24 hours ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(twoDaysAgo), "há 2 d");
  });

  test("returns 'há 1 min' for exactly 1 minute ago", () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(oneMinAgo), "há 1 min");
  });

  test("returns 'há 59 min' for 59 minutes ago", () => {
    const fiftyNineMinAgo = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(fiftyNineMinAgo), "há 59 min");
  });

  test("returns 'há 1 h' for exactly 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(oneHourAgo), "há 1 h");
  });

  test("returns 'há 1 d' for exactly 24 hours ago", () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(oneDayAgo), "há 1 d");
  });
});
