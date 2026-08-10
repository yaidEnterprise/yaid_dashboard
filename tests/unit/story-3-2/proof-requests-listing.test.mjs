/**
 * Story 3.2: Listagem de Proof Requests no Dashboard
 *
 * Contract and pure-logic tests for:
 * - AC #1: GET /api/proof-requests client store + MetricCard counts
 * - AC #3: empty state component
 * - AC #4: error retry pattern in page
 * - AC #5: navigation to detail route
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

// Mirror of countByStatus from utils/proof-requests-store.ts
function countByStatus(items) {
  return {
    total: items.length,
    approved: items.filter((r) => r.status === "approved").length,
    pending: items.filter(
      (r) => r.status === "pending_user" || r.status === "processing",
    ).length,
    rejected: items.filter(
      (r) => r.status === "rejected" || r.status === "expired",
    ).length,
  };
}

describe("Story 3.2 file contracts", () => {
  test("creates proof-requests-store client module", () => {
    assertFileExists("utils/proof-requests-store.ts");
  });

  test("creates shared EmptyState and list skeleton components", () => {
    assertFileExists("components/shared/empty-state.tsx");
    assertFileExists("components/shared/list-skeleton.tsx");
  });

  test("listProofRequests uses fetchWithAuth against GET /api/proof-requests", () => {
    const src = readText("utils/proof-requests-store.ts");
    assert.match(src, /fetchWithAuth\("\/api\/proof-requests"/);
    assert.match(src, /json\.items/);
    assert.match(src, /export async function listProofRequests/);
  });

  test("proof-requests page integrates API, MetricCard, skeleton and empty state", () => {
    const src = readText("app/(dashboard)/proof-requests/page.tsx");
    assert.match(src, /listProofRequests/);
    assert.match(src, /MetricCard/);
    assert.match(src, /MetricCardsSkeleton/);
    assert.match(src, /EmptyState/);
    assert.match(src, /TableRowsSkeleton/);
    assert.doesNotMatch(src, /const rows: Row\[\]/, "mock rows must be removed");
  });

  test("page navigates to detail on row click", () => {
    const src = readText("app/(dashboard)/proof-requests/page.tsx");
    assert.match(src, /router\.push\(`\/proof-requests\/\$\{item\.id\}`\)/);
  });

  test("page shows retry on API error", () => {
    const src = readText("app/(dashboard)/proof-requests/page.tsx");
    assert.match(src, /Tentar novamente/);
    assert.match(src, /onClick=\{load\}/);
  });

  test("empty state instructs API usage without dashboard create CTA", () => {
    const src = readText("app/(dashboard)/proof-requests/page.tsx");
    assert.match(src, /POST \/api\/proof-requests/);
    assert.doesNotMatch(src, /proof-requests\/new/, "helper create page is story 3.4");
  });
});

describe("Story 3.2 metric counts (AC #1)", () => {
  const sample = [
    { status: "approved" },
    { status: "pending_user" },
    { status: "processing" },
    { status: "rejected" },
    { status: "expired" },
  ];

  test("counts total from full dataset", () => {
    assert.equal(countByStatus(sample).total, 5);
  });

  test("counts approved only", () => {
    assert.equal(countByStatus(sample).approved, 1);
  });

  test("counts pending_user and processing as pendentes", () => {
    assert.equal(countByStatus(sample).pending, 2);
  });

  test("counts rejected and expired as rejeitadas", () => {
    assert.equal(countByStatus(sample).rejected, 2);
  });

  test("empty list returns zero counts", () => {
    assert.deepEqual(countByStatus([]), {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    });
  });
});

describe("Story 3.2 proof type labels", () => {
  test("store exports labels for known proof types", () => {
    const src = readText("utils/proof-requests-store.ts");
    assert.match(src, /personhood/);
    assert.match(src, /age_over_18/);
    assert.match(src, /export function formatProofType/);
  });
});
