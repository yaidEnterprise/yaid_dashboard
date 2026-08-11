/**
 * Story 7.3: Allowlist de Criação de Apps (`can_create_apps`)
 *
 * Contract tests (source-inspection, no TypeScript execution) covering:
 * - AC #1: forward migration adds company.can_create_apps, backfilled true for
 *   existing rows, NOT NULL DEFAULT false.
 * - AC #2: Company entity and CompanyMapper carry canCreateApps/can_create_apps,
 *   propagated to GET /api/companies/me.
 * - AC #3: CreateCompanyAppUseCase rejects with 403 when the company is not allowed
 *   to create apps.
 * - AC #4: /apps CTA is blocked with a banner, /apps/new blocks navigation, when
 *   canCreateApps is false.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const MIGRATIONS_DIR = "supabase/migrations";
const ENTITY = "src/shared/domain/entities/Company.ts";
const MAPPER = "src/shared/infra/dto/CompanyMapper.ts";
const CREATE_COMPANY_USECASE = "src/modules/company/app/create_company_usecase.ts";
const UPDATE_COMPANY_USECASE = "src/modules/company/app/update_my_company_usecase.ts";
const GET_MY_COMPANY_USECASE = "src/modules/company/app/get_my_company_usecase.ts";
const GET_MY_COMPANY_VIEWMODEL = "src/modules/company/app/get_my_company_viewmodel.ts";
const CREATE_APP_USECASE = "src/modules/company-app/app/create_company_app_usecase.ts";
const CREATE_APP_PRESENTER = "src/modules/company-app/app/create_company_app_presenter.ts";
const APPS_PAGE = "app/(dashboard)/apps/page.tsx";
const APPS_NEW_PAGE = "app/(dashboard)/apps/new/page.tsx";

function findCanCreateAppsMigration() {
  const files = readdirSync(resolve(ROOT, MIGRATIONS_DIR)).sort();
  const match = files.find((f) => f.endsWith("_add_can_create_apps_to_company.sql"));
  assert.ok(match, "a migration file ending in _add_can_create_apps_to_company.sql must exist");
  return `${MIGRATIONS_DIR}/${match}`;
}

// ── AC #1: forward migration ────────────────────────────────────────────────

describe("Story 7.3 — forward migration add_can_create_apps_to_company", () => {
  test("adds can_create_apps as NOT NULL DEFAULT false in a single atomic statement", () => {
    const src = readText(findCanCreateAppsMigration());
    assert.match(
      src,
      /alter table "public"\."company"\s+add column "can_create_apps" boolean not null default false/,
      "must add can_create_apps as boolean not null default false in one ADD COLUMN statement",
    );
  });

  test("backfills can_create_apps = true for existing rows", () => {
    const src = readText(findCanCreateAppsMigration());
    assert.match(
      src,
      /update "public"\."company"\s+set "can_create_apps" = true/,
      "must backfill can_create_apps = true for existing companies",
    );
  });

  test("does not use a nullable-then-constrain pattern (no separate ALTER COLUMN statements)", () => {
    const src = readText(findCanCreateAppsMigration());
    assert.equal(
      /alter column/i.test(src),
      false,
      "column must be created NOT NULL DEFAULT false directly, not backfilled then constrained (avoids a race window for concurrent inserts)",
    );
  });

  test("does not touch any other table", () => {
    const src = readText(findCanCreateAppsMigration());
    assert.equal(
      /alter table "public"\.(?!"company")/.test(src),
      false,
      "migration must only alter company",
    );
  });
});

// ── AC #2: entity + mapper + GET /api/companies/me ─────────────────────────

describe("Story 7.3 — Company entity carries canCreateApps", () => {
  test("CompanyProps declares canCreateApps: boolean", () => {
    const src = readText(ENTITY);
    assert.match(src, /canCreateApps:\s*boolean;/, "props must declare canCreateApps: boolean");
  });

  test("entity exposes a canCreateApps getter", () => {
    const src = readText(ENTITY);
    assert.match(
      src,
      /get canCreateApps\(\)\s*\{\s*return this\.props\.canCreateApps;/,
      "must expose canCreateApps getter",
    );
  });
});

describe("Story 7.3 — CompanyMapper maps can_create_apps", () => {
  test("CompanyPersistence declares can_create_apps: boolean", () => {
    const src = readText(MAPPER);
    assert.match(src, /can_create_apps:\s*boolean;/, "persistence type must declare can_create_apps: boolean");
  });

  test("toDomain maps can_create_apps to canCreateApps", () => {
    const src = readText(MAPPER);
    assert.match(src, /canCreateApps:\s*raw\.can_create_apps/, "toDomain must map raw.can_create_apps");
  });

  test("toPersistence maps canCreateApps to can_create_apps", () => {
    const src = readText(MAPPER);
    assert.match(
      src,
      /can_create_apps:\s*company\.canCreateApps/,
      "toPersistence must serialize canCreateApps",
    );
  });
});

describe("Story 7.3 — Company instantiation sites stay valid", () => {
  test("CreateCompanyUseCase sets canCreateApps: false for new companies", () => {
    const src = readText(CREATE_COMPANY_USECASE);
    const ctor = src.match(/new Company\(\{[\s\S]*?\}\);/);
    assert.ok(ctor, "must instantiate Company");
    assert.match(ctor[0], /canCreateApps:\s*false/, "new companies must start with canCreateApps: false");
  });

  test("UpdateMyCompanyUseCase preserves canCreateApps from the existing company", () => {
    const src = readText(UPDATE_COMPANY_USECASE);
    const ctor = src.match(/new Company\(\{[\s\S]*?\}\);/);
    assert.ok(ctor, "must instantiate Company");
    assert.match(
      ctor[0],
      /canCreateApps:\s*company\.canCreateApps/,
      "update must not silently reset canCreateApps",
    );
  });
});

describe("Story 7.3 — GET /api/companies/me propagates canCreateApps", () => {
  test("CompanyOutputDTO declares canCreateApps: boolean", () => {
    const src = readText(GET_MY_COMPANY_VIEWMODEL);
    assert.match(src, /canCreateApps:\s*boolean;/, "DTO must declare canCreateApps: boolean");
  });

  test("GetMyCompanyUseCase maps canCreateApps from the entity", () => {
    const src = readText(GET_MY_COMPANY_USECASE);
    assert.match(
      src,
      /canCreateApps:\s*company\.canCreateApps/,
      "use case must map canCreateApps into the response",
    );
  });
});

// ── AC #3: CreateCompanyAppUseCase guard ────────────────────────────────────

describe("Story 7.3 — CreateCompanyAppUseCase rejects companies not allowed to create apps", () => {
  test("constructor is injected with a CompanyRepository", () => {
    const src = readText(CREATE_APP_USECASE);
    assert.match(
      src,
      /companyRepository:\s*CompanyRepository/,
      "use case must receive a CompanyRepository dependency",
    );
  });

  test("execute() throws ForbiddenError when company.canCreateApps is false", () => {
    const src = readText(CREATE_APP_USECASE);
    assert.match(
      src,
      /if\s*\(!company\.canCreateApps\)\s*\{\s*throw new ForbiddenError\(/,
      "must guard on company.canCreateApps and throw ForbiddenError",
    );
  });

  test("imports ForbiddenError from the shared AppError module", () => {
    const src = readText(CREATE_APP_USECASE);
    assert.match(
      src,
      /import\s*\{[^}]*ForbiddenError[^}]*\}\s*from\s*"@\/shared\/errors\/AppError"/,
      "must import ForbiddenError (403) instead of a generic AppError",
    );
  });

  test("presenter wires the CompanyRepository into the use case", () => {
    const src = readText(CREATE_APP_PRESENTER);
    assert.match(
      src,
      /new CreateCompanyAppUseCase\(\s*await envs\.getCompanyAppRepository\(\),\s*await envs\.getApiKeyHasher\(\),\s*await envs\.getCompanyRepository\(\)\s*\)/,
      "presenter must pass a CompanyRepository as the third constructor argument",
    );
  });
});

// ── AC #4: dashboard CTA + /apps/new block ──────────────────────────────────

describe("Story 7.3 — /apps CTA is blocked with a banner when canCreateApps is false", () => {
  test("page fetches canCreateApps via GET /api/companies/me", () => {
    const src = readText(APPS_PAGE);
    assert.match(src, /fetchWithAuth\("\/api\/companies\/me"\)/, "must fetch company info client-side");
    assert.match(src, /canCreateApps/, "must read canCreateApps from the response");
  });

  test("renders a blocked banner when createAppsBlocked is true", () => {
    const src = readText(APPS_PAGE);
    assert.match(src, /CreateAppsBlockedBanner/, "must render an explanatory banner when blocked");
  });

  test("EmptyState's CTA respects the canCreateApps flag", () => {
    const src = readText(APPS_PAGE);
    assert.match(
      src,
      /function EmptyState\(\{ canCreateApps \}/,
      "EmptyState must accept a canCreateApps prop",
    );
  });

  test("validates the companies/me response shape before trusting canCreateApps", () => {
    const src = readText(APPS_PAGE);
    assert.match(
      src,
      /typeof canCreate === "boolean"/,
      "must guard against a missing/non-boolean canCreateApps field instead of trusting a bare type assertion",
    );
  });

  test("disabled CTAs explain why they are blocked", () => {
    const src = readText(APPS_PAGE);
    const matches = src.match(/aria-label="Cria[^"]*bloqueado[^"]*"/g) ?? [];
    assert.ok(
      matches.length >= 2,
      "both the header CTA and the EmptyState CTA must carry an aria-label explaining the block",
    );
  });
});

describe("Story 7.3 — /apps/new blocks navigation when canCreateApps is false", () => {
  test("page fetches canCreateApps via GET /api/companies/me before rendering the form", () => {
    const src = readText(APPS_NEW_PAGE);
    assert.match(src, /fetchWithAuth\("\/api\/companies\/me"\)/, "must fetch company info client-side");
  });

  test("validates the companies/me response shape before trusting canCreateApps", () => {
    const src = readText(APPS_NEW_PAGE);
    assert.match(
      src,
      /typeof canCreate === "boolean"/,
      "must guard against a missing/non-boolean canCreateApps field instead of trusting a bare type assertion",
    );
  });

  test("redirects to /apps when the company is not allowed to create apps", () => {
    const src = readText(APPS_NEW_PAGE);
    assert.match(
      src,
      /router\.replace\("\/apps"\)/,
      "must redirect away from /apps/new when blocked",
    );
  });

  test("shows a toast explaining the redirect instead of a silent bounce", () => {
    const src = readText(APPS_NEW_PAGE);
    assert.match(
      src,
      /toast\.error\([^)]*\);\s*\n\s*router\.replace\("\/apps"\)/,
      "must toast before redirecting so the user knows why they were bounced",
    );
  });

  test("does not render the create-app form before the allowlist check resolves", () => {
    const src = readText(APPS_NEW_PAGE);
    assert.match(
      src,
      /if\s*\(allowed !== "yes"\)\s*\{\s*return/,
      "must gate the form render behind the resolved allowlist check",
    );
  });
});
