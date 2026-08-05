/**
 * Story 7.2 — teste dinâmico/comportamental de updated_at.
 *
 * Diferente de `updated-at-tracking.test.mjs` (regex sobre o source), este
 * arquivo instancia as classes reais (ProofRequestMapper, GetProofRequestUseCase)
 * com dados/repositórios fake e verifica o output efetivamente produzido em
 * runtime — fechando a lacuna "suíte 100% estática" registrada para stories
 * anteriores em `deferred-work.md`.
 *
 * Executado via `tsx` (não `node --test` puro) porque importa os módulos
 * TypeScript reais do projeto, incluindo os aliases `@/...` do tsconfig.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ProofRequestMapper } from "@/shared/infra/dto/ProofRequestMapper";
import type {
  ProofRequestRepository,
  ProofRequestWithApp,
} from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { GetProofRequestUseCase } from "@/modules/proof-request/app/get_proof_request_usecase";

function makeRequest(overrides: Partial<{
  createdAt: Date;
  updatedAt: Date;
  validatedAt: Date | null;
}> = {}): ProofRequest {
  const createdAt = overrides.createdAt ?? new Date("2026-08-01T10:00:00.000Z");
  return new ProofRequest({
    id: "req-1",
    appId: "app-1",
    proofType: "age_over_18",
    status: ProofRequestStatus.PENDING_USER,
    result: null,
    externalRef: null,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    validatedAt: overrides.validatedAt ?? null,
  });
}

// ─── AC #2: ProofRequestMapper round-trip ──────────────────────────────────

describe("Story 7.2 — ProofRequestMapper updated_at round-trip", () => {
  test("toPersistence serializes updatedAt distinct from createdAt after a transition", () => {
    const createdAt = new Date("2026-08-01T10:00:00.000Z");
    const updatedAt = new Date("2026-08-02T15:30:00.000Z");
    const request = makeRequest({ createdAt, updatedAt });

    const persisted = ProofRequestMapper.toPersistence(request);

    assert.equal(persisted.created_at, createdAt.toISOString());
    assert.equal(persisted.updated_at, updatedAt.toISOString());
    assert.notEqual(persisted.updated_at, persisted.created_at);
  });

  test("toDomain round-trips updated_at back into a real Date on the entity", () => {
    const raw = {
      id: "req-2",
      app_id: "app-1",
      proof_type: "personhood",
      status: "approved",
      result: true,
      external_ref: null,
      created_at: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-03T09:00:00.000Z",
      validated_at: "2026-08-03T09:00:00.000Z",
    };

    const domain = ProofRequestMapper.toDomain(raw);

    assert.ok(domain.updatedAt instanceof Date);
    assert.equal(domain.updatedAt.toISOString(), raw.updated_at);
    assert.notEqual(domain.updatedAt.getTime(), domain.createdAt.getTime());
  });

  test("on creation, updatedAt equals createdAt (no transition yet)", () => {
    const createdAt = new Date("2026-08-05T12:00:00.000Z");
    const request = makeRequest({ createdAt });

    assert.equal(request.updatedAt.getTime(), request.createdAt.getTime());
  });
});

// ─── AC #4: GetProofRequestUseCase maps the real column, never validatedAt ─

describe("Story 7.2 — GetProofRequestUseCase returns real updatedAt at runtime", () => {
  function makeFakeRepo(row: ProofRequestWithApp | null): ProofRequestRepository {
    return {
      create: async () => {},
      createAtomic: async () => {},
      findById: async () => row,
      listByAppIds: async () => [],
      updateStatus: async () => {},
    };
  }

  test("updatedAt in the DTO matches the entity's updatedAt, not validatedAt", async () => {
    const createdAt = new Date("2026-08-01T10:00:00.000Z");
    const updatedAt = new Date("2026-08-04T18:45:00.000Z");
    const validatedAt = new Date("2026-08-02T00:00:00.000Z");
    const request = makeRequest({ createdAt, updatedAt, validatedAt });

    const row: ProofRequestWithApp = {
      request,
      app: { id: "app-1", name: "Test App", environment: "homol", companyId: "company-1" },
    };

    const useCase = new GetProofRequestUseCase(makeFakeRepo(row));
    const dto = await useCase.execute({ requestId: "req-1", companyId: "company-1" });

    assert.equal(dto.updatedAt, updatedAt.toISOString());
    assert.notEqual(dto.updatedAt, dto.validatedAt);
    assert.equal(typeof dto.updatedAt, "string");
  });

  test("updatedAt is never null in the DTO, even without a validation event yet", async () => {
    const createdAt = new Date("2026-08-01T10:00:00.000Z");
    const request = makeRequest({ createdAt, updatedAt: createdAt, validatedAt: null });

    const row: ProofRequestWithApp = {
      request,
      app: { id: "app-1", name: "Test App", environment: "homol", companyId: "company-1" },
    };

    const useCase = new GetProofRequestUseCase(makeFakeRepo(row));
    const dto = await useCase.execute({ requestId: "req-1", companyId: "company-1" });

    assert.equal(dto.validatedAt, null);
    assert.equal(dto.updatedAt, createdAt.toISOString());
  });

  test("404s on company mismatch without touching updatedAt logic", async () => {
    const row: ProofRequestWithApp = {
      request: makeRequest(),
      app: { id: "app-1", name: "Test App", environment: "homol", companyId: "company-owner" },
    };

    const useCase = new GetProofRequestUseCase(makeFakeRepo(row));

    await assert.rejects(
      () => useCase.execute({ requestId: "req-1", companyId: "company-other" }),
      /Proof request not found/,
    );
  });
});
