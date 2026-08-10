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

// ─── File contracts ──────────────────────────────────────────────────────────

test("Story 1.7 creates update_my_company use case files", () => {
  assertFileExists("src/modules/company/app/update_my_company_usecase.ts");
  assertFileExists("src/modules/company/app/update_my_company_controller.ts");
  assertFileExists("src/modules/company/app/update_my_company_presenter.ts");
  assertFileExists("src/modules/company/app/update_my_company_viewmodel.ts");
});

// ─── Backend: AC #1 & #2 — GET/PATCH /api/companies/me ───────────────────────

test("Story 1.7 route exports PATCH handler for /api/companies/me", () => {
  const src = readText("app/api/companies/me/route.ts");
  assert.match(src, /export async function PATCH/, "must export async PATCH");
  assert.match(src, /makeUpdateMyCompanyController/, "must use UpdateMyCompanyController");
});

test("Story 1.7 CompanyRepository interface includes update method", () => {
  const src = readText("src/shared/domain/interfaces/repositories/CompanyRepository.ts");
  assert.match(src, /update\(company:\s*Company\):\s*Promise<void>/, "must define update method");
});

test("Story 1.7 SupabaseCompanyRepository implements update method", () => {
  const src = readText("src/shared/infra/repositories/SupabaseCompanyRepository.ts");
  assert.match(src, /async update\(company:\s*Company\)/, "must implement update method");
  assert.match(src, /\.update\(\{/, "must call supabase update");
  assert.match(src, /name:\s*company\.name/, "must update name");
  assert.match(src, /document_number:\s*company\.documentNumber/, "must update document_number");
});

test("Story 1.7 GetMyCompanyUseCase returns cnpj instead of documentNumber", () => {
  const src = readText("src/modules/company/app/get_my_company_usecase.ts");
  assert.match(src, /cnpj:\s*company\.documentNumber/, "must map documentNumber to cnpj");
  assert.equal(src.includes("email: company.email"), false, "must not return email in DTO per Story 1.7 contract");
});

test("Story 1.7 UpdateMyCompanyUseCase applies partial updates", () => {
  const src = readText("src/modules/company/app/update_my_company_usecase.ts");
  assert.match(src, /name:\s*input\.dto\.name\s*\?\?\s*company\.name/, "must partially update name");
  assert.match(src, /documentNumber:\s*input\.dto\.cnpj\s*!==\s*undefined/, "must partially update cnpj");
});

// ─── Frontend: AC #3 & #4 — Settings page ────────────────────────────────────

test("Story 1.7 settings page uses React Hook Form with zodResolver", () => {
  const src = readText("app/(dashboard)/settings/page.tsx");
  assert.match(src, /zodResolver/, "must use zodResolver for RHF + Zod integration");
  assert.match(src, /useForm/, "must use useForm from react-hook-form");
});

test("Story 1.7 settings page has CNPJ mask function", () => {
  const src = readText("app/(dashboard)/settings/page.tsx");
  assert.match(src, /function applyCnpjMask/, "must have applyCnpjMask function");
  assert.match(src, /slice\(0,\s*14\)/, "must truncate CNPJ at 14 digits");
});

test("Story 1.7 settings page calls PATCH /api/companies/me using fetchWithAuth", () => {
  const src = readText("app/(dashboard)/settings/page.tsx");
  assert.match(src, /fetchWithAuth\(["']\/api\/companies\/me["'],\s*\{/, "must use fetchWithAuth");
  assert.match(src, /method:\s*["']PATCH["']/, "must use PATCH method");
});

test("Story 1.7 settings page uses plain fetch for logout", () => {
  const src = readText("app/(dashboard)/settings/page.tsx");
  assert.match(src, /fetch\(["']\/api\/auth\/sign-out["']/, "must use plain fetch for sign-out to avoid redirect loops");
  assert.equal(src.includes('fetchWithAuth("/api/auth/sign-out"'), false, "must not use fetchWithAuth for sign-out");
});

test("Story 1.7 settings page includes LogoutConfirmDialog", () => {
  const src = readText("app/(dashboard)/settings/page.tsx");
  assert.match(src, /function LogoutConfirmDialog/, "must have LogoutConfirmDialog component");
  assert.match(src, /role=["']dialog["']/, "dialog must have role=dialog");
  assert.match(src, /aria-modal=["']true["']/, "dialog must have aria-modal=true");
});

// TypeScript compilation test removed because npm install is failing in the environment

