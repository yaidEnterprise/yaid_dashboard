/**
 * Story 7.5 — teste dinâmico/comportamental do ReviewProofRequestUseCase e
 * do ReviewProofRequestController.
 *
 * Instancia as classes reais com repositórios/webhook fake e verifica o
 * comportamento efetivamente produzido em runtime (guards, transições,
 * disparo do webhook), seguindo o mesmo padrão das Stories 7.3/9.2.
 *
 * Executado via `tsx` (não `node --test` puro) porque importa os módulos
 * TypeScript reais do projeto, incluindo os aliases `@/...` do tsconfig.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { ZodError } from "zod";

import { ReviewProofRequestUseCase } from "@/modules/proof-request/app/review_proof_request_usecase";
import { ReviewProofRequestController } from "@/modules/proof-request/app/review_proof_request_controller";
import type {
  DeliverWebhookInput,
  DeliverWebhookUseCase,
} from "@/modules/webhook/app/deliver_webhook_usecase";
import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import type {
  ProofRequestRepository,
  ProofRequestWithApp,
} from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "@/shared/errors/AppError";

class FakeRequestRepo implements ProofRequestRepository {
  readonly statusUpdates: { id: string; status: ProofRequestStatus }[] = [];

  constructor(private readonly result: ProofRequestWithApp | null) {}

  async create(): Promise<void> {}

  async createAtomic(): Promise<void> {}

  async findById(id: string): Promise<ProofRequestWithApp | null> {
    if (!this.result) return null;
    return this.result.request.id === id ? this.result : null;
  }

  async listByAppIds(): Promise<ProofRequestWithApp[]> {
    return [];
  }

  async updateStatus(id: string, status: ProofRequestStatus): Promise<void> {
    this.statusUpdates.push({ id, status });
  }
}

class FakeDeliverWebhookUseCase implements Pick<DeliverWebhookUseCase, "execute"> {
  readonly calls: DeliverWebhookInput[] = [];

  constructor(private readonly shouldReject = false) {}

  async execute(input: DeliverWebhookInput): Promise<void> {
    this.calls.push(input);
    if (this.shouldReject) throw new Error("webhook delivery failed");
  }
}

function makeRow(
  overrides: {
    id?: string;
    companyId?: string;
    environment?: "dev" | "homol" | "prod";
    status?: ProofRequestStatus;
    proofType?: string;
    externalRef?: string | null;
  } = {}
): ProofRequestWithApp {
  return {
    request: new ProofRequest({
      id: overrides.id ?? "request-1",
      appId: "app-1",
      proofType: overrides.proofType ?? "age_over_18",
      status: overrides.status ?? ProofRequestStatus.PENDING_USER,
      result: null,
      externalRef: overrides.externalRef ?? null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      validatedAt: null,
    }),
    app: {
      id: "app-1",
      name: "Test App",
      environment: overrides.environment ?? "homol",
      companyId: overrides.companyId ?? "company-1",
    },
  };
}

// ── AC #1: approve/reject transitions + webhook dispatch ───────────────────

describe("Story 7.5 — ReviewProofRequestUseCase approve/reject transitions", () => {
  test("approve transitions a pending_user request to approved, persists via updateStatus, dispatches webhook", async () => {
    const row = makeRow({ status: ProofRequestStatus.PENDING_USER });
    const repo = new FakeRequestRepo(row);
    const webhook = new FakeDeliverWebhookUseCase();
    const useCase = new ReviewProofRequestUseCase(
      repo,
      webhook as unknown as DeliverWebhookUseCase
    );

    const result = await useCase.execute({
      requestId: "request-1",
      companyId: "company-1",
      decision: "approve",
    });

    assert.equal(result.status, ProofRequestStatus.APPROVED);
    assert.equal(repo.statusUpdates.length, 1);
    assert.deepEqual(repo.statusUpdates[0], {
      id: "request-1",
      status: ProofRequestStatus.APPROVED,
    });
    assert.equal(webhook.calls.length, 1);
    assert.equal(webhook.calls[0].proofRequestId, "request-1");
    assert.equal(webhook.calls[0].status, ProofRequestStatus.APPROVED);
    assert.equal(webhook.calls[0].proofType, "age_over_18");
  });

  test("reject transitions a processing request to rejected", async () => {
    const row = makeRow({ status: ProofRequestStatus.PROCESSING });
    const repo = new FakeRequestRepo(row);
    const webhook = new FakeDeliverWebhookUseCase();
    const useCase = new ReviewProofRequestUseCase(
      repo,
      webhook as unknown as DeliverWebhookUseCase
    );

    const result = await useCase.execute({
      requestId: "request-1",
      companyId: "company-1",
      decision: "reject",
    });

    assert.equal(result.status, ProofRequestStatus.REJECTED);
    assert.deepEqual(repo.statusUpdates[0], {
      id: "request-1",
      status: ProofRequestStatus.REJECTED,
    });
    assert.equal(webhook.calls[0].status, ProofRequestStatus.REJECTED);
  });

  test("webhook delivery failure does not reject the use case (fire-and-forget)", async () => {
    const row = makeRow({ status: ProofRequestStatus.PENDING_USER });
    const repo = new FakeRequestRepo(row);
    const webhook = new FakeDeliverWebhookUseCase(true);
    const useCase = new ReviewProofRequestUseCase(
      repo,
      webhook as unknown as DeliverWebhookUseCase
    );

    const result = await useCase.execute({
      requestId: "request-1",
      companyId: "company-1",
      decision: "approve",
    });

    assert.equal(result.status, ProofRequestStatus.APPROVED);
    assert.equal(repo.statusUpdates.length, 1, "status must still transition even if webhook delivery fails");
  });

  test("works without a webhook dependency (optional constructor argument)", async () => {
    const row = makeRow({ status: ProofRequestStatus.PENDING_USER });
    const repo = new FakeRequestRepo(row);
    const useCase = new ReviewProofRequestUseCase(repo);

    const result = await useCase.execute({
      requestId: "request-1",
      companyId: "company-1",
      decision: "approve",
    });

    assert.equal(result.status, ProofRequestStatus.APPROVED);
  });
});

// ── AC #2: environment guard (403) ──────────────────────────────────────────

describe("Story 7.5 — ReviewProofRequestUseCase rejects non-homol apps", () => {
  for (const environment of ["prod", "dev"] as const) {
    test(`rejects with ForbiddenError (403) when app.environment === "${environment}"`, async () => {
      const row = makeRow({ environment, status: ProofRequestStatus.PENDING_USER });
      const repo = new FakeRequestRepo(row);
      const useCase = new ReviewProofRequestUseCase(repo);

      await assert.rejects(
        () =>
          useCase.execute({
            requestId: "request-1",
            companyId: "company-1",
            decision: "approve",
          }),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.equal((err as ForbiddenError).statusCode, 403);
          return true;
        }
      );
      assert.equal(repo.statusUpdates.length, 0, "no status transition should happen when the guard rejects");
    });
  }
});

// ── AC #3: terminal-state guard (422) ───────────────────────────────────────

describe("Story 7.5 — ReviewProofRequestUseCase rejects terminal-state requests", () => {
  for (const status of [
    ProofRequestStatus.APPROVED,
    ProofRequestStatus.REJECTED,
    ProofRequestStatus.EXPIRED,
  ]) {
    test(`rejects with UnprocessableEntityError (422) when status === "${status}"`, async () => {
      const row = makeRow({ status });
      const repo = new FakeRequestRepo(row);
      const useCase = new ReviewProofRequestUseCase(repo);

      await assert.rejects(
        () =>
          useCase.execute({
            requestId: "request-1",
            companyId: "company-1",
            decision: "approve",
          }),
        (err: unknown) => {
          assert.ok(err instanceof UnprocessableEntityError);
          assert.equal((err as UnprocessableEntityError).statusCode, 422);
          return true;
        }
      );
      assert.equal(repo.statusUpdates.length, 0);
    });
  }
});

// ── AC #4: ownership guard (404, anti-enumeration) ──────────────────────────

describe("Story 7.5 — ReviewProofRequestUseCase enforces company isolation", () => {
  test("rejects with NotFoundError (404) when the request does not exist", async () => {
    const repo = new FakeRequestRepo(null);
    const useCase = new ReviewProofRequestUseCase(repo);

    await assert.rejects(
      () =>
        useCase.execute({
          requestId: "ghost-request",
          companyId: "company-1",
          decision: "approve",
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.equal((err as NotFoundError).statusCode, 404);
        return true;
      }
    );
  });

  test("rejects with NotFoundError (404), not ForbiddenError, when the request belongs to another company", async () => {
    const row = makeRow({ companyId: "company-2" });
    const repo = new FakeRequestRepo(row);
    const useCase = new ReviewProofRequestUseCase(repo);

    await assert.rejects(
      () =>
        useCase.execute({
          requestId: "request-1",
          companyId: "company-1",
          decision: "approve",
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.ok(!(err instanceof ForbiddenError));
        return true;
      }
    );
  });
});

// ── Controller: input validation ────────────────────────────────────────────

describe("Story 7.5 — ReviewProofRequestController validates the decision field", () => {
  test("rejects an invalid decision value with a ZodError before reaching the use case", async () => {
    const row = makeRow();
    const repo = new FakeRequestRepo(row);
    const useCase = new ReviewProofRequestUseCase(repo);
    const controller = new ReviewProofRequestController(useCase);

    await assert.rejects(
      () =>
        controller.handle({
          requestId: "request-1",
          companyId: "company-1",
          body: { decision: "maybe" },
        }),
      ZodError
    );
    assert.equal(repo.statusUpdates.length, 0);
  });

  test("passes a valid decision through to the use case", async () => {
    const row = makeRow();
    const repo = new FakeRequestRepo(row);
    const useCase = new ReviewProofRequestUseCase(repo);
    const controller = new ReviewProofRequestController(useCase);

    const result = await controller.handle({
      requestId: "request-1",
      companyId: "company-1",
      body: { decision: "approve" },
    });

    assert.equal(result.status, ProofRequestStatus.APPROVED);
  });
});
