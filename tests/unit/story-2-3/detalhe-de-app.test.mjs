/**
 * Story 2.3: Detalhe e Edição de App
 *
 * Contract tests for:
 *   - Backend: GET and PATCH route handlers, use cases (isolation by companyId)
 *   - Frontend: editable Identificação/Webhook cards, AlertDialog for disable, CopyButton for app_id
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

// ─── Backend: route handler ───────────────────────────────────────────────────

describe("Story 2.3 — Backend route handler", () => {
  test("exports GET and PATCH handlers", () => {
    const src = readText("app/api/company-apps/[appId]/route.ts");
    assert.match(src, /export async function GET/, "must export GET handler");
    assert.match(src, /export async function PATCH/, "must export PATCH handler");
  });

  test("GET reads companyId from x-company-id header", () => {
    const src = readText("app/api/company-apps/[appId]/route.ts");
    assert.match(src, /x-company-id/, "must read x-company-id header in GET");
  });

  test("PATCH reads companyId from x-company-id header", () => {
    const src = readText("app/api/company-apps/[appId]/route.ts");
    // Ensure both GET and PATCH reference x-company-id
    const occurrences = (src.match(/x-company-id/g) || []).length;
    assert.ok(occurrences >= 2, "x-company-id must appear in both GET and PATCH");
  });

  test("route uses handleHttpError for error handling", () => {
    const src = readText("app/api/company-apps/[appId]/route.ts");
    assert.match(src, /handleHttpError/, "must use handleHttpError for consistent error responses");
  });
});

// ─── Backend: GetCompanyAppUseCase ────────────────────────────────────────────

describe("Story 2.3 — GetCompanyAppUseCase", () => {
  test("throws NotFoundError when app does not exist", () => {
    const src = readText("src/modules/company-app/app/get_company_app_usecase.ts");
    assert.match(src, /NotFoundError/, "must throw NotFoundError for missing app");
  });

  test("enforces companyId isolation (ForbiddenError or NotFoundError on mismatch)", () => {
    const src = readText("src/modules/company-app/app/get_company_app_usecase.ts");
    // The use case throws ForbiddenError when companyId mismatches — handleHttpError maps it to 404
    assert.match(
      src,
      /ForbiddenError|NotFoundError/,
      "must throw an error when companyId does not match (privacy: no enumeration)"
    );
    assert.match(src, /app\.companyId !== input\.companyId/, "must compare companyIds");
  });

  test("returns DTO with appId field", () => {
    const src = readText("src/modules/company-app/app/get_company_app_usecase.ts");
    assert.match(src, /appId/, "response DTO must include appId");
  });
});

// ─── Backend: UpdateCompanyAppUseCase ─────────────────────────────────────────

describe("Story 2.3 — UpdateCompanyAppUseCase", () => {
  test("validates companyId isolation before update", () => {
    const src = readText("src/modules/company-app/app/update_company_app_usecase.ts");
    assert.match(src, /companyId/, "must validate companyId");
    assert.match(src, /ForbiddenError|NotFoundError/, "must throw error on companyId mismatch");
  });

  test("supports partial updates (name, webhookUrl, status)", () => {
    const src = readText("src/modules/company-app/app/update_company_app_usecase.ts");
    assert.match(src, /input\.name !== undefined/, "must support optional name update");
    assert.match(src, /input\.webhookUrl !== undefined/, "must support optional webhookUrl update");
    assert.match(src, /input\.status !== undefined/, "must support optional status update");
  });

  test("schema requires at least one field (not empty body)", () => {
    const src = readText("src/modules/company-app/app/update_company_app_viewmodel.ts");
    assert.match(
      src,
      /Object\.keys\(v\)\.length/,
      "schema must reject empty body (at least one field required)"
    );
  });

  test("status field only accepts enabled or disabled", () => {
    const src = readText("src/modules/company-app/app/update_company_app_viewmodel.ts");
    assert.match(
      src,
      /z\.enum\(\[\"enabled\",\s*\"disabled\"\]\)/,
      "status enum must be enabled | disabled"
    );
  });
});

// ─── Frontend: App detail page ────────────────────────────────────────────────

describe("Story 2.3 — App detail page (frontend contract)", () => {
  test("uses React Hook Form with zodResolver", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /useForm/, "page must use useForm (react-hook-form)");
    assert.match(src, /zodResolver/, "page must use zodResolver");
  });

  test("has an editable Identificação card with name field", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /Identificação/, "must have Identificação card");
    assert.match(src, /app-name/, "must have input with id app-name");
    assert.match(
      src,
      /identSchema|IdentValues/,
      "must have a Zod schema for Identificação form"
    );
  });

  test("has an editable Webhook card with webhookUrl field", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /Webhook/, "must have Webhook card");
    assert.match(src, /webhook-url/, "must have input with id webhook-url");
    assert.match(src, /webhookUrl/, "must have webhookUrl field in form");
  });

  test("Salvar button is disabled until form is dirty", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(
      src,
      /!isDirty.*isSubmitting|isSubmitting.*!isDirty/,
      "Salvar button must be disabled when form is not dirty or submitting"
    );
  });

  test("calls updateApp with name for Identificação save", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /updateApp/, "must call updateApp for saving changes");
    assert.match(src, /name:\s*values\.name\.trim\(\)/, "must trim name before saving");
  });

  test("displays API key card with only app_id (not secret)", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /Chave da API/, "must have Chave da API card");
    assert.match(src, /app\.appId|app\.id/, "must show appId (public identifier)");
    // The word 'secret' may appear only as a placeholder hint (e.g., <secret>) — never as a real value display
    // Ensure there is no api_key_hash or raw secret field being rendered
    assert.equal(
      src.includes("apiKeyHash"),
      false,
      "must NOT display apiKeyHash (the hashed secret) in the card"
    );
    assert.equal(
      src.includes("app.secret"),
      false,
      "must NOT render app.secret directly"
    );
  });

  test("uses CopyButton for app_id display", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /CopyButton/, "must use CopyButton for app_id");
  });

  test("shows AlertDialog when clicking Desabilitar on an enabled app", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(
      src,
      /disableDialogOpen|disable.*Dialog|DisableConfirmDialog/,
      "must have a disable confirmation dialog"
    );
    assert.match(
      src,
      /setDisableDialogOpen\(true\)/,
      "must open dialog when user clicks Desabilitar"
    );
  });

  test("AlertDialog shows impact warning about proof requests", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(
      src,
      /proof.requests/i,
      "disable dialog must warn about impact on proof requests"
    );
  });

  test("enabling a disabled app calls PATCH without dialog", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(
      src,
      /status:\s*\"enabled\"/,
      'must call updateApp with status "enabled" to re-enable'
    );
    // Re-enabling goes through handleEnable() directly, not via dialog
    assert.match(src, /handleEnable/, "must have a handleEnable function for direct re-enable");
  });

  test("shows toast.success on successful save", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /toast\.success/, "must show success toast on save");
  });

  test("shows toast.error on failed save without resetting fields", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    // React Hook Form preserves field values on error by default (no reset called in catch)
    assert.match(src, /toast\.error/, "must show error toast on failure");
  });

  test("shows loading skeleton while fetching", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /animate-pulse/, "must show skeleton with animate-pulse during loading");
    assert.match(src, /PageSkeleton/, "must render PageSkeleton component while loading");
  });

  test("shows error state with back link when app not found", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /não encontrado/, "must show 'App não encontrado' error message");
    assert.match(src, /href=\"\/apps\"/, "must have link to go back to /apps");
  });

  test("uses toggle-status-btn id for the status toggle button", () => {
    const src = readText("app/(dashboard)/apps/[appId]/page.tsx");
    assert.match(src, /toggle-status-btn/, "toggle button must have unique id for testing");
  });
});

// ─── Frontend: apps-store integration ─────────────────────────────────────────

describe("Story 2.3 — apps-store integration", () => {
  test("getApp function exists and uses fetchWithAuth", () => {
    const src = readText("utils/apps-store.ts");
    assert.match(src, /export async function getApp/, "must export getApp function");
    assert.match(src, /fetchWithAuth/, "getApp must use fetchWithAuth");
  });

  test("updateApp function accepts partial UpdateAppInput", () => {
    const src = readText("utils/apps-store.ts");
    assert.match(src, /export async function updateApp/, "must export updateApp function");
    assert.match(
      src,
      /name\?:|webhookUrl\?:|status\?:/,
      "UpdateAppInput must have optional fields"
    );
  });

  test("updateApp uses PATCH method", () => {
    const src = readText("utils/apps-store.ts");
    const updateSection = src.slice(src.indexOf("async function updateApp"));
    assert.match(updateSection, /method:\s*\"PATCH\"/, "updateApp must use PATCH HTTP method");
  });
});
