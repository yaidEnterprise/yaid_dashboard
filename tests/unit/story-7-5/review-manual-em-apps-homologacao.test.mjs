/**
 * Story 7.5: Review Manual (Aprovar/Reprovar) em Apps de Homologação
 *
 * Contract tests (source-inspection, no TypeScript execution) covering:
 * - AC #1: viewmodel accepts only "approve"/"reject" decisions.
 * - AC #2/#3: use case guard order (404 ownership -> 403 environment -> 422 terminal).
 * - AC #1/#2/#3/#4: route wiring + middleware session-auth for POST .../review
 *   (without this, the endpoint would be unauthenticated).
 * - AC #5/#6: client store + detail page conditional rendering, confirm copy,
 *   toast feedback.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const VIEWMODEL = "src/modules/proof-request/app/review_proof_request_viewmodel.ts";
const USECASE = "src/modules/proof-request/app/review_proof_request_usecase.ts";
const CONTROLLER = "src/modules/proof-request/app/review_proof_request_controller.ts";
const PRESENTER = "src/modules/proof-request/app/review_proof_request_presenter.ts";
const ROUTE = "app/api/proof-requests/[requestId]/review/route.ts";
const MIDDLEWARE = "src/shared/middleware.ts";
const STORE = "utils/proof-requests-store.ts";
const PAGE = "app/(dashboard)/proof-requests/[requestId]/page.tsx";

// ── AC #1: input contract ───────────────────────────────────────────────────

describe("Story 7.5 — ReviewProofRequestSchema", () => {
  test("accepts only the enum ['approve', 'reject']", () => {
    const src = readText(VIEWMODEL);
    assert.match(src, /z\.enum\(\["approve",\s*"reject"\]\)/);
  });
});

// ── AC #1/#2/#3/#4: use case guard order ────────────────────────────────────

describe("Story 7.5 — ReviewProofRequestUseCase guard order", () => {
  const src = readText(USECASE);

  test("404s (ownership) before checking environment or status — anti-enumeration (NFR6)", () => {
    assert.match(src, /row\.app\.companyId !== input\.companyId/);
    assert.match(src, /NotFoundError\(/);
    const notFoundIdx = src.indexOf("NotFoundError(");
    const forbiddenIdx = src.indexOf("ForbiddenError(");
    const terminalIdx = src.indexOf("UnprocessableEntityError(");
    assert.ok(notFoundIdx > -1 && forbiddenIdx > -1 && terminalIdx > -1);
    assert.ok(notFoundIdx < forbiddenIdx, "ownership guard must run before the environment guard");
    assert.ok(forbiddenIdx < terminalIdx, "environment guard must run before the terminal-state guard");
  });

  test("rejects with ForbiddenError (403) when app.environment !== 'homol'", () => {
    assert.match(src, /row\.app\.environment !== "homol"/);
  });

  test("rejects with UnprocessableEntityError (422) for terminal statuses", () => {
    assert.match(src, /TERMINAL_STATUSES/);
    assert.match(src, /ProofRequestStatus\.APPROVED/);
    assert.match(src, /ProofRequestStatus\.REJECTED/);
    assert.match(src, /ProofRequestStatus\.EXPIRED/);
  });

  test("persists the transition via updateStatus before the webhook is dispatched", () => {
    const updateIdx = src.indexOf("updateStatus(");
    const webhookIdx = src.indexOf("this.deliverWebhook");
    assert.ok(updateIdx > -1 && webhookIdx > -1);
    assert.ok(updateIdx < webhookIdx, "updateStatus must run before the webhook dispatch");
  });

  test("webhook delivery is fire-and-forget, never awaited directly", () => {
    assert.doesNotMatch(src, /await this\.deliverWebhook\.execute/);
    assert.match(src, /\.catch\(/);
  });
});

// ── Route + middleware wiring ───────────────────────────────────────────────

describe("Story 7.5 — POST /api/proof-requests/[requestId]/review route", () => {
  test("route file exports a POST handler wired to the presenter and handleHttpError", () => {
    const src = readText(ROUTE);
    assert.match(src, /export async function POST/);
    assert.match(src, /makeReviewProofRequestController/);
    assert.match(src, /handleHttpError/);
  });
});

describe("Story 7.5 — presenter composes ProofRequestRepository + DeliverWebhookUseCase", () => {
  test("presenter wires getProofRequestRepository() and makeDeliverWebhookUseCase()", () => {
    const src = readText(PRESENTER);
    assert.match(src, /getProofRequestRepository/);
    assert.match(src, /makeDeliverWebhookUseCase/);
  });
});

describe("Story 7.5 — controller validates body before calling the use case", () => {
  test("controller parses input.body with ReviewProofRequestSchema", () => {
    const src = readText(CONTROLLER);
    assert.match(src, /ReviewProofRequestSchema\.parse\(input\.body\)/);
  });
});

describe("Story 7.5 — middleware authenticates POST .../review by session", () => {
  test("isSessionAuthApiRoute grants a dedicated rule for POST .../review", () => {
    const src = readText(MIDDLEWARE);
    const start = src.indexOf("function isSessionAuthApiRoute");
    assert.ok(start > -1, "isSessionAuthApiRoute must exist");
    const end = src.indexOf("\n}", start);
    const body = src.slice(start, end);

    assert.ok(body.includes("review"), "must reference the /review sub-route");
    assert.ok(body.includes('method === "POST"'), "must gate the rule on POST");
    assert.ok(body.includes("[^/]+"), "must match any requestId segment via a wildcard regex");
  });
});

// ── AC #5: client store ─────────────────────────────────────────────────────

describe("Story 7.5 — client store exposes reviewProofRequest", () => {
  test("reviewProofRequest POSTs { decision } to /api/proof-requests/{id}/review", () => {
    const src = readText(STORE);
    assert.match(src, /export async function reviewProofRequest/);
    assert.match(src, /\/api\/proof-requests\/\$\{requestId\}\/review/);
    assert.match(src, /method:\s*"POST"/);
    assert.match(src, /JSON\.stringify\(\{\s*decision\s*\}\)/);
  });
});

// ── AC #5/#6: detail page ───────────────────────────────────────────────────

describe("Story 7.5 — detail page conditionally renders review actions", () => {
  const src = readText(PAGE);

  test("canReview requires environment homol and a non-terminal status", () => {
    assert.match(src, /data\.environment === "homol"/);
    assert.match(src, /data\.status === "pending_user" \|\| data\.status === "processing"/);
  });

  test("Aprovar/Reprovar buttons are gated behind canReview", () => {
    assert.match(src, /\{canReview && \(/);
    assert.match(src, />\s*Aprovar\s*</);
    assert.match(src, />\s*Reprovar\s*</);
  });

  test("confirm dialog states the webhook is real and the action is irreversible", () => {
    assert.match(src, /Esta ação envia o webhook real para o app e não pode ser desfeita\./);
  });

  test("success feedback uses toast.success with the approved/rejected copy", () => {
    assert.match(src, /toast\.success\(/);
    assert.match(src, /Verificação aprovada/);
    assert.match(src, /Verificação reprovada/);
  });

  test("on success, updates status and updatedAt locally without a full refetch", () => {
    assert.match(src, /setData\(\{\s*\.\.\.data,\s*status:\s*result\.status,\s*updatedAt:\s*result\.updatedAt\s*\}\)/);
  });
});
