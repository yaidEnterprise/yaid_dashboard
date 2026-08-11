/**
 * Story 7.3 — teste dinâmico/comportamental do allowlist can_create_apps.
 *
 * Diferente de `allowlist-can-create-apps.test.mjs` (regex sobre o source),
 * este arquivo instancia as classes reais (CreateCompanyAppUseCase,
 * GetMyCompanyUseCase, CompanyMapper) com repositórios fake e verifica o
 * comportamento efetivamente produzido em runtime — fechando a lacuna
 * "suíte 100% estática" já registrada como padrão sistêmico em
 * `deferred-work.md` (Stories 5.7/5.8/7.1/7.2).
 *
 * Executado via `tsx` (não `node --test` puro) porque importa os módulos
 * TypeScript reais do projeto, incluindo os aliases `@/...` do tsconfig.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { Company } from "@/shared/domain/entities/Company";
import { CompanyApp } from "@/shared/domain/entities/CompanyApp";
import { CompanyStatus } from "@/shared/domain/enums/CompanyStatus";
import { CompanyMapper } from "@/shared/infra/dto/CompanyMapper";
import type { CompanyRepository } from "@/shared/domain/interfaces/repositories/CompanyRepository";
import type { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import type { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { CreateCompanyAppUseCase } from "@/modules/company-app/app/create_company_app_usecase";
import { GetMyCompanyUseCase } from "@/modules/company/app/get_my_company_usecase";
import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError";

function makeCompany(overrides: Partial<{ canCreateApps: boolean }> = {}): Company {
  return new Company({
    id: "company-1",
    name: "Acme Ltda",
    documentNumber: "12345678000199",
    email: "acme@example.com",
    status: CompanyStatus.ACTIVE,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    canCreateApps: overrides.canCreateApps ?? false,
  });
}

function makeCompanyRepo(company: Company | null): CompanyRepository {
  return {
    create: async () => {},
    findById: async () => company,
    findByEmail: async () => null,
    update: async () => {},
  };
}

function makeCompanyAppRepo(): CompanyAppRepository & { created: CompanyApp[] } {
  const created: CompanyApp[] = [];
  return {
    created,
    create: async (app: CompanyApp) => {
      created.push(app);
    },
    findById: async () => null,
    listByCompanyId: async () => [],
    update: async () => {},
  };
}

const fakeHasher: ApiKeyHasher = {
  hash: async (secret: string) => `hashed:${secret}`,
  verify: async () => true,
};

// ── AC #3: CreateCompanyAppUseCase guard ────────────────────────────────────

describe("Story 7.3 — CreateCompanyAppUseCase enforces the can_create_apps guard at runtime", () => {
  test("rejects with ForbiddenError (403) when the company cannot create apps", async () => {
    const companyRepo = makeCompanyRepo(makeCompany({ canCreateApps: false }));
    const appRepo = makeCompanyAppRepo();
    const useCase = new CreateCompanyAppUseCase(appRepo, fakeHasher, companyRepo);

    await assert.rejects(
      () =>
        useCase.execute({
          companyId: "company-1",
          name: "My App",
          webhookUrl: "",
          environment: "homol",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.equal((err as ForbiddenError).statusCode, 403);
        return true;
      },
    );

    assert.equal(appRepo.created.length, 0, "no app should be persisted when the guard rejects");
  });

  test("creates the app normally when the company is allowed", async () => {
    const companyRepo = makeCompanyRepo(makeCompany({ canCreateApps: true }));
    const appRepo = makeCompanyAppRepo();
    const useCase = new CreateCompanyAppUseCase(appRepo, fakeHasher, companyRepo);

    const result = await useCase.execute({
      companyId: "company-1",
      name: "My App",
      webhookUrl: "",
      environment: "homol",
    });

    assert.equal(appRepo.created.length, 1, "app should be persisted when the guard allows");
    assert.equal(result.companyId, "company-1");
    assert.ok(result.apiKey.startsWith(result.id + "."));
  });

  test("rejects with NotFoundError when the company does not exist", async () => {
    const companyRepo = makeCompanyRepo(null);
    const appRepo = makeCompanyAppRepo();
    const useCase = new CreateCompanyAppUseCase(appRepo, fakeHasher, companyRepo);

    await assert.rejects(
      () =>
        useCase.execute({
          companyId: "ghost-company",
          name: "My App",
          webhookUrl: "",
          environment: "homol",
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        return true;
      },
    );

    assert.equal(appRepo.created.length, 0);
  });
});

// ── AC #2: CompanyMapper round-trip ─────────────────────────────────────────

describe("Story 7.3 — CompanyMapper canCreateApps round-trip", () => {
  test("toPersistence serializes canCreateApps as-is", () => {
    const company = makeCompany({ canCreateApps: true });
    const persisted = CompanyMapper.toPersistence(company);
    assert.equal(persisted.can_create_apps, true);
  });

  test("toDomain round-trips can_create_apps back into a boolean on the entity", () => {
    const raw = {
      id: "company-2",
      name: "Beta Ltda",
      document_number: null,
      email: "beta@example.com",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      can_create_apps: true,
    };

    const domain = CompanyMapper.toDomain(raw);
    assert.equal(domain.canCreateApps, true);
  });
});

// ── AC #2: GET /api/companies/me propagates canCreateApps at runtime ───────

describe("Story 7.3 — GetMyCompanyUseCase returns real canCreateApps at runtime", () => {
  test("DTO reflects canCreateApps = false for a blocked company", async () => {
    const companyRepo = makeCompanyRepo(makeCompany({ canCreateApps: false }));
    const useCase = new GetMyCompanyUseCase(companyRepo);

    const dto = await useCase.execute({ authUserId: "company-1" });

    assert.equal(dto.canCreateApps, false);
  });

  test("DTO reflects canCreateApps = true for an allowed company", async () => {
    const companyRepo = makeCompanyRepo(makeCompany({ canCreateApps: true }));
    const useCase = new GetMyCompanyUseCase(companyRepo);

    const dto = await useCase.execute({ authUserId: "company-1" });

    assert.equal(dto.canCreateApps, true);
  });

  test("404s when the company does not exist, without touching canCreateApps logic", async () => {
    const companyRepo = makeCompanyRepo(null);
    const useCase = new GetMyCompanyUseCase(companyRepo);

    await assert.rejects(
      () => useCase.execute({ authUserId: "ghost-company" }),
      /Company not found/,
    );
  });
});
