import assert from "node:assert/strict";
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

// ─── Story 2.1 — Listagem de Aplicações ──────────────────────────────────────

// AC #1 — Backend: GET /api/company-apps exists and filters by company_id

test("Story 2.1 route.ts exports async GET handler for /api/company-apps", () => {
  const src = readText("app/api/company-apps/route.ts");
  assert.match(src, /export async function GET/, "must export async GET handler");
  assert.match(src, /makeListCompanyAppsController/, "must use makeListCompanyAppsController");
});

test("Story 2.1 GET handler reads x-company-id from request headers", () => {
  const src = readText("app/api/company-apps/route.ts");
  assert.match(src, /x-company-id/, "must read x-company-id header for company isolation");
});

test("Story 2.1 ListCompanyAppsUseCase filters by companyId (server-side isolation)", () => {
  const src = readText("src/modules/company-app/app/list_company_apps_usecase.ts");
  assert.match(src, /listByCompanyId\(input\.companyId\)/, "must filter by companyId via repository");
});

test("Story 2.1 list_company_apps_viewmodel returns camelCase DTO fields", () => {
  const src = readText("src/modules/company-app/app/list_company_apps_viewmodel.ts");
  assert.match(src, /companyId/, "must return companyId in camelCase");
  assert.match(src, /webhookUrl/, "must return webhookUrl in camelCase");
  assert.match(src, /createdAt/, "must return createdAt in camelCase");
});

// AC #1 — Frontend: page calls listApps() from apps-store (fetchWithAuth → GET /api/company-apps)

test("Story 2.1 apps page imports listApps from apps-store", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /from ['"]\@\/utils\/apps-store['"]/, "must import from apps-store");
  assert.match(src, /listApps/, "must use listApps function");
});

test("Story 2.1 apps-store listApps uses fetchWithAuth for GET /api/company-apps", () => {
  const src = readText("utils/apps-store.ts");
  assert.match(src, /fetchWithAuth/, "listApps must use fetchWithAuth");
  assert.match(src, /\/api\/company-apps/, "must call /api/company-apps endpoint");
  assert.match(src, /json\.items/, "must extract items from response");
});

// AC #2 — Loading state (skeleton or spinner)

test("Story 2.1 apps page renders loading state while fetching", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /loading/, "must have loading state");
  assert.match(src, /animate-pulse|skeleton|Skeleton/i, "must show skeleton/pulse during loading");
});

// AC #3 — Empty state with CTA to /apps/new

test("Story 2.1 apps page shows empty state with CTA link to /apps/new", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /apps\.length\s*===\s*0/, "must check apps.length === 0 for empty state");
  assert.match(src, /\/apps\/new/, "must have link to /apps/new in empty state");
  assert.match(src, /Criar primeiro app|primeiro app/i, "must have CTA text for creating first app");
});

// AC #4 — Error state with retry option

test("Story 2.1 apps page shows error state with retry button", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /error/, "must have error state");
  assert.match(
    src,
    /Tentar novamente|retry|onRetry/i,
    "must have retry option when error occurs",
  );
  assert.match(src, /reload|setFetchKey|refetch/i, "must have a way to reload/retry on error");
});

// AC #5 — Clickable rows navigate to /apps/[appId]

test("Story 2.1 apps page rows navigate to /apps/[appId] on click", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(
    src,
    /router\.push\(`\/apps\/\$\{app\.id\}`\)|href=\{`\/apps\/\$\{app\.id\}`\}/,
    "must navigate to /apps/[appId] on row click",
  );
});

test("Story 2.1 apps page renders app name and app_id (truncated) in table rows", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /app\.name/, "must render app name");
  assert.match(src, /app\.id/, "must render app.id (the app_id)");
});

test("Story 2.1 apps page renders StatusBadge for app status", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /StatusBadge/, "must use StatusBadge component for status column");
  assert.match(src, /app\.status/, "must pass app.status to StatusBadge");
});

test("Story 2.1 apps page renders createdAt column with formatted date", () => {
  const src = readText("app/(dashboard)/apps/page.tsx");
  assert.match(src, /app\.createdAt/, "must render app.createdAt");
  assert.match(src, /formatDate|toLocaleDateString/, "must format the date for display");
});

// ─── File contracts ───────────────────────────────────────────────────────────

test("Story 2.1 required backend files exist", () => {
  assertFileExists("app/api/company-apps/route.ts");
  assertFileExists("src/modules/company-app/app/list_company_apps_usecase.ts");
  assertFileExists("src/modules/company-app/app/list_company_apps_controller.ts");
  assertFileExists("src/modules/company-app/app/list_company_apps_presenter.ts");
  assertFileExists("src/modules/company-app/app/list_company_apps_viewmodel.ts");
});

test("Story 2.1 required frontend files exist", () => {
  assertFileExists("app/(dashboard)/apps/page.tsx");
  assertFileExists("utils/apps-store.ts");
  assertFileExists("utils/fetch-with-auth.ts");
});
