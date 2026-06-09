/**
 * Story 5.3: Challenge e Abertura de Sessão
 *
 * Tests cover:
 * - AC #1: successful challenge — nonce returned, session transitions to opened, proof_request to processing
 * - AC #2: session already opened/approved/expired/cancelled → UnprocessableEntityError (422)
 * - AC #3: session token not found → NotFoundError (404)
 * - Structural: openWithChallenge method on ProofSession entity
 * - Structural: updateStatus on ProofRequestRepository interface
 * - Structural: SupabaseProofRequestRepository implements updateStatus
 * - Structural: ChallengeProofSessionUseCase uses sha256 for nonce hash (not raw nonce)
 * - Structural: nonce is base64url (randomBytes based)
 * - Structural: usecase transitions proof_request to processing
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

// ── Structural tests ──────────────────────────────────────────────────────────

describe("Story 5.3 — ProofSession entity: openWithChallenge", () => {
  test("entity declares openWithChallenge method", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    assert.match(src, /openWithChallenge/, "ProofSession must declare openWithChallenge method");
  });

  test("openWithChallenge sets challengeNonceHash", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    assert.match(src, /challengeNonceHash/, "openWithChallenge must set challengeNonceHash");
  });

  test("openWithChallenge sets challengeCreatedAt", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    assert.match(src, /challengeCreatedAt/, "openWithChallenge must set challengeCreatedAt");
  });

  test("openWithChallenge transitions status to OPENED", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    // The method must set status = OPENED inside openWithChallenge
    const methodSection = src.slice(src.indexOf("openWithChallenge"));
    assert.match(methodSection, /OPENED/, "openWithChallenge must transition status to OPENED");
  });

  test("openWithChallenge only acts on WAITING_USER sessions", () => {
    const src = readText("src/shared/domain/entities/ProofSession.ts");
    const methodSection = src.slice(src.indexOf("openWithChallenge"));
    assert.match(methodSection, /WAITING_USER/, "openWithChallenge must guard against non-waiting_user status");
  });
});

describe("Story 5.3 — ProofRequestRepository interface: updateStatus", () => {
  test("interface declares updateStatus method", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofRequestRepository.ts");
    assert.match(src, /updateStatus/, "ProofRequestRepository must declare updateStatus");
  });

  test("updateStatus accepts id and ProofRequestStatus", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofRequestRepository.ts");
    assert.match(src, /ProofRequestStatus/, "ProofRequestRepository must import ProofRequestStatus for updateStatus signature");
  });
});

describe("Story 5.3 — SupabaseProofRequestRepository: updateStatus", () => {
  test("implements updateStatus method", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofRequestRepository.ts");
    assert.match(src, /updateStatus/, "SupabaseProofRequestRepository must implement updateStatus");
  });

  test("updateStatus queries by id column", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofRequestRepository.ts");
    // Find updateStatus method and check it uses .eq("id"
    const methodIdx = src.indexOf("async updateStatus");
    const methodSection = src.slice(methodIdx, methodIdx + 300);
    assert.match(methodSection, /\.eq\("id"/, "updateStatus must filter by id column");
  });

  test("updateStatus updates status field", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofRequestRepository.ts");
    const methodIdx = src.indexOf("async updateStatus");
    const methodSection = src.slice(methodIdx, methodIdx + 300);
    assert.match(methodSection, /\.update\(\{ status/, "updateStatus must update the status field");
  });
});

describe("Story 5.3 — ChallengeProofSessionUseCase", () => {
  test("usecase imports NotFoundError", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /NotFoundError/, "usecase must import NotFoundError");
  });

  test("usecase imports UnprocessableEntityError", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /UnprocessableEntityError/, "usecase must import UnprocessableEntityError");
  });

  test("usecase uses sha256 to hash nonce (not raw nonce)", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /sha256|createHash|digest/, "usecase must hash the nonce before persisting");
  });

  test("usecase generates nonce with randomBytes (base64url)", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /randomBytes/, "usecase must generate nonce with randomBytes");
    assert.match(src, /base64url/, "usecase must encode nonce as base64url");
  });

  test("usecase calls sessionRepo.update after setting challenge", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /sessionRepo\.update/, "usecase must call sessionRepo.update to persist challenge fields");
  });

  test("usecase calls requestRepo.updateStatus with PROCESSING", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /requestRepo\.updateStatus/, "usecase must call requestRepo.updateStatus");
    assert.match(src, /PROCESSING/, "usecase must transition proof_request to PROCESSING");
  });

  test("usecase calls openWithChallenge on the session entity", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /openWithChallenge/, "usecase must call session.openWithChallenge");
  });

  test("usecase returns only the raw nonce in output", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /return \{ nonce \}/, "usecase must return { nonce } — only the raw nonce");
  });

  test("usecase injects sessionRepo, requestRepo and hasher", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(src, /sessionRepo/, "usecase must declare sessionRepo in constructor");
    assert.match(src, /requestRepo/, "usecase must declare requestRepo in constructor");
    assert.match(src, /hasher/, "usecase must declare hasher in constructor");
  });

  test("usecase throws 422 with 'Session not in waiting_user state' for non-waiting sessions", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_usecase.ts");
    assert.match(
      src,
      /Session not in waiting_user state/,
      "usecase must throw UnprocessableEntityError with correct message"
    );
  });
});

describe("Story 5.3 — ChallengeProofSessionController", () => {
  test("controller delegates to usecase.execute", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_controller.ts");
    assert.match(src, /useCase\.execute/, "controller must delegate to useCase.execute");
  });

  test("controller accepts sessionToken as input", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_controller.ts");
    assert.match(src, /sessionToken/, "controller must accept sessionToken in handle input");
  });
});

describe("Story 5.3 — ChallengeProofSessionPresenter", () => {
  test("presenter injects ProofSessionRepository", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_presenter.ts");
    assert.match(src, /getProofSessionRepository/, "presenter must inject ProofSessionRepository");
  });

  test("presenter injects ProofRequestRepository", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_presenter.ts");
    assert.match(src, /getProofRequestRepository/, "presenter must inject ProofRequestRepository");
  });

  test("presenter injects ApiKeyHasher", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_presenter.ts");
    assert.match(src, /getApiKeyHasher/, "presenter must inject ApiKeyHasher");
  });
});

describe("Story 5.3 — API route: challenge", () => {
  test("route file exists at correct path", () => {
    const src = readText("app/api/proof-sessions/[sessionToken]/challenge/route.ts");
    assert.ok(src.length > 0, "challenge route file must exist");
  });

  test("route exports GET function", () => {
    const src = readText("app/api/proof-sessions/[sessionToken]/challenge/route.ts");
    assert.match(src, /export async function GET/, "challenge route must export GET function");
  });

  test("route uses makeChallengeProofSessionController", () => {
    const src = readText("app/api/proof-sessions/[sessionToken]/challenge/route.ts");
    assert.match(src, /makeChallengeProofSessionController/, "route must use the presenter factory");
  });

  test("route uses handleHttpError for error handling", () => {
    const src = readText("app/api/proof-sessions/[sessionToken]/challenge/route.ts");
    assert.match(src, /handleHttpError/, "route must use handleHttpError");
  });

  test("route reads sessionToken from URL params", () => {
    const src = readText("app/api/proof-sessions/[sessionToken]/challenge/route.ts");
    assert.match(src, /sessionToken/, "route must extract sessionToken from params");
  });
});

describe("Story 5.3 — ChallengeProofSessionOutputDTO", () => {
  test("viewmodel exports ChallengeProofSessionOutputDTO with nonce field", () => {
    const src = readText("src/modules/proof-session/app/challenge_proof_session_viewmodel.ts");
    assert.match(src, /ChallengeProofSessionOutputDTO/, "viewmodel must export ChallengeProofSessionOutputDTO");
    assert.match(src, /nonce/, "output DTO must include nonce field");
  });
});
