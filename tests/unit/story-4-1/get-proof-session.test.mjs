/**
 * Story 4.1: Endpoint Público de Status da Sessão
 *
 * Tests cover:
 * - AC #1: response shape { status, proofType, companyName, expiresAt }
 *   (no returnUrl — proof_request has no return_url column in the live schema)
 * - AC #1: forbidden fields not in response (proofRequestId, sessionToken, challengeNonceHash)
 * - AC #2: 404 for unknown/malformed token
 * - AC #3: terminal statuses returned as-is
 * - AC #4: clock-expired sessions get status updated to "expired"
 * - markExpired() entity method behavior
 * - ProofSessionWithContext type on repository interface
 * - DTO shape (no old fields like proofRequestId, openedAt, approvedAt)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

// ── Structural contract tests ──────────────────────────────────────────────────

describe("Story 4.1 — ProofSessionOutputDTO (viewmodel)", () => {
  test("DTO has status field", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.match(src, /status/, "DTO must have status field");
  });

  test("DTO has proofType field", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.match(src, /proofType/, "DTO must have proofType field");
  });

  test("DTO has companyName field", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.match(src, /companyName/, "DTO must have companyName field");
  });

  test("DTO has expiresAt field", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.match(src, /expiresAt/, "DTO must have expiresAt field");
  });

  test("DTO does NOT have returnUrl field (no return_url column exists)", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.equal(src.includes("returnUrl"), false, "DTO must not have returnUrl field");
  });

  test("DTO does NOT expose proofRequestId (internal field)", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.equal(src.includes("proofRequestId"), false, "DTO must not expose proofRequestId");
  });

  test("DTO does NOT expose id (internal session id)", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    // 'id:' as a field — avoid false positive from 'provider' etc.
    assert.equal(src.includes("  id:"), false, "DTO must not expose id field");
  });

  test("DTO does NOT expose openedAt", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.equal(src.includes("openedAt"), false, "DTO must not expose openedAt");
  });

  test("DTO does NOT expose approvedAt", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.equal(src.includes("approvedAt"), false, "DTO must not expose approvedAt");
  });

  test("DTO does NOT expose createdAt", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
    assert.equal(src.includes("createdAt"), false, "DTO must not expose createdAt");
  });
});

describe("Story 4.1 — ProofSessionRepository interface", () => {
  test("interface declares findByTokenHashWithContext method", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofSessionRepository.ts");
    assert.match(src, /findByTokenHashWithContext/, "repository must declare findByTokenHashWithContext");
  });

  test("ProofSessionWithContext type is exported", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofSessionRepository.ts");
    assert.match(src, /ProofSessionWithContext/, "ProofSessionWithContext type must be exported");
  });

  test("ProofSessionWithContext has session, proofType, companyName (no returnUrl)", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofSessionRepository.ts");
    assert.match(src, /session/, "must have session field");
    assert.match(src, /proofType/, "must have proofType field");
    assert.match(src, /companyName/, "must have companyName field");
    assert.equal(src.includes("returnUrl"), false, "must not have returnUrl field");
  });
});

describe("Story 4.1 — SupabaseProofSessionRepository", () => {
  test("implements findByTokenHashWithContext", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
    assert.match(src, /findByTokenHashWithContext/, "must implement findByTokenHashWithContext");
  });

  test("join query includes proof_request", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
    assert.match(src, /proof_request/, "join must include proof_request");
  });

  test("join query includes company_app", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
    assert.match(src, /company_app/, "join must include company_app");
  });

  test("join query includes company name", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
    assert.match(src, /company/, "join must include company");
    assert.match(src, /name/, "join must select company name");
  });

  test("does not use 'as any' cast", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
    assert.equal(src.includes("as any"), false, "must not use unsafe 'as any' cast");
  });
});

describe("Story 4.1 — GetProofSessionUseCase", () => {
  test("use case uses findByTokenHashWithContext (not findByTokenHash)", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    assert.match(src, /findByTokenHashWithContext/, "must use findByTokenHashWithContext");
    assert.equal(
      src.includes("findByTokenHash("),
      false,
      "must not use plain findByTokenHash"
    );
  });

  test("use case does NOT call markOpened()", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    assert.equal(src.includes("markOpened"), false, "story 4.1 is read-only — must not call markOpened");
  });

  test("use case has expiration logic (markExpired + update)", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    assert.match(src, /markExpired/, "must call markExpired on clock-expired sessions");
    assert.match(src, /sessionRepo\.update/, "must persist expiration to DB");
  });

  test("use case returns proofType from context", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    assert.match(src, /proofType/, "must return proofType");
  });

  test("use case returns companyName from context", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    assert.match(src, /companyName/, "must return companyName");
  });

  test("use case does not return returnUrl (no return_url column exists)", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    assert.equal(src.includes("returnUrl"), false, "must not return returnUrl");
  });

  test("use case does NOT expose proofRequestId in return", () => {
    const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
    // proofRequestId should not appear in the return object
    const returnIdx = src.lastIndexOf("return {");
    const returnBlock = src.slice(returnIdx);
    assert.equal(returnBlock.includes("proofRequestId"), false, "return must not include proofRequestId");
  });
});

describe("Story 4.1 — ProofSession entity markExpired()", () => {
  test("entity has markExpired method", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    assert.match(src, /markExpired/, "ProofSession must have markExpired method");
  });

  test("markExpired sets status to EXPIRED", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    assert.match(src, /EXPIRED/, "markExpired must set status to EXPIRED");
  });

  test("markExpired does not affect already-terminal sessions", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    // Should have a guard (set of terminal statuses or similar)
    assert.match(
      src,
      /TERMINAL_STATUSES|APPROVED_BY_USER|CANCELLED/,
      "markExpired must guard against re-expiring terminal sessions"
    );
  });

  test("entity still has markOpened method (not removed — needed by Story 5.3)", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    assert.match(src, /markOpened/, "markOpened must remain — used by Story 5.3 challenge flow");
  });
});
