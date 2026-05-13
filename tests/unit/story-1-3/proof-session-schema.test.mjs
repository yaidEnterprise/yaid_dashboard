import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");

// ── ProofSession entity ────────────────────────────────────────────────────────

test("Story 1.3 ProofSession entity has challengeNonceHash getter", () => {
  const src = readText("src/shared/domain/entities/ProofSession.ts");
  assert.match(src, /challengeNonceHash/, "must declare challengeNonceHash property");
  assert.match(src, /get challengeNonceHash\(\)/, "must expose challengeNonceHash getter");
});

test("Story 1.3 ProofSession entity has challengeCreatedAt getter", () => {
  const src = readText("src/shared/domain/entities/ProofSession.ts");
  assert.match(src, /challengeCreatedAt/, "must declare challengeCreatedAt property");
  assert.match(src, /get challengeCreatedAt\(\)/, "must expose challengeCreatedAt getter");
});

test("Story 1.3 ProofSession entity does not expose verificationPageUrl", () => {
  const src = readText("src/shared/domain/entities/ProofSession.ts");
  assert.equal(src.includes("verificationPageUrl"), false, "verificationPageUrl must be removed from entity");
});

test("Story 1.3 ProofSession entity does not expose deepLinkUrl", () => {
  const src = readText("src/shared/domain/entities/ProofSession.ts");
  assert.equal(src.includes("deepLinkUrl"), false, "deepLinkUrl must be removed from entity");
});

// ── ProofSessionMapper ─────────────────────────────────────────────────────────

test("Story 1.3 ProofSessionPersistence type has challenge_nonce_hash column", () => {
  const src = readText("src/shared/infra/dto/ProofSessionMapper.ts");
  assert.match(src, /challenge_nonce_hash/, "ProofSessionPersistence must declare challenge_nonce_hash");
});

test("Story 1.3 ProofSessionPersistence type has challenge_created_at column", () => {
  const src = readText("src/shared/infra/dto/ProofSessionMapper.ts");
  assert.match(src, /challenge_created_at/, "ProofSessionPersistence must declare challenge_created_at");
});

test("Story 1.3 ProofSessionPersistence type does not have verification_page_url column", () => {
  const src = readText("src/shared/infra/dto/ProofSessionMapper.ts");
  assert.equal(src.includes("verification_page_url"), false, "verification_page_url must be removed from ProofSessionPersistence");
});

test("Story 1.3 ProofSessionPersistence type does not have deep_link_url column", () => {
  const src = readText("src/shared/infra/dto/ProofSessionMapper.ts");
  assert.equal(src.includes("deep_link_url"), false, "deep_link_url must be removed from ProofSessionPersistence");
});

test("Story 1.3 ProofSessionMapper.toDomain maps challenge_nonce_hash to challengeNonceHash", () => {
  const src = readText("src/shared/infra/dto/ProofSessionMapper.ts");
  assert.match(
    src,
    /challengeNonceHash.*challenge_nonce_hash|challenge_nonce_hash.*challengeNonceHash/,
    "toDomain must map challenge_nonce_hash to challengeNonceHash"
  );
});

test("Story 1.3 ProofSessionMapper.toPersistence maps challengeNonceHash to challenge_nonce_hash", () => {
  const src = readText("src/shared/infra/dto/ProofSessionMapper.ts");
  assert.match(
    src,
    /challenge_nonce_hash.*session\.challengeNonceHash|session\.challengeNonceHash.*challenge_nonce_hash/,
    "toPersistence must map session.challengeNonceHash to challenge_nonce_hash"
  );
});

// ── create_proof_request_usecase ───────────────────────────────────────────────

test("Story 1.3 create_proof_request_usecase builds ProofSession with challengeNonceHash: null", () => {
  const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
  assert.match(src, /challengeNonceHash:\s*null/, "must initialise challengeNonceHash: null");
});

test("Story 1.3 create_proof_request_usecase builds ProofSession with challengeCreatedAt: null", () => {
  const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
  assert.match(src, /challengeCreatedAt:\s*null/, "must initialise challengeCreatedAt: null");
});

test("Story 1.3 create_proof_request_usecase does not pass URL fields to ProofSession constructor", () => {
  const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
  const constructorMatch = src.match(/new ProofSession\(\{([^}]+)\}\)/s);
  assert.ok(constructorMatch, "must construct a ProofSession");
  const constructorBody = constructorMatch[1];
  assert.equal(constructorBody.includes("verificationPageUrl"), false, "ProofSession constructor must not receive verificationPageUrl");
  assert.equal(constructorBody.includes("deepLinkUrl"), false, "ProofSession constructor must not receive deepLinkUrl");
});

test("Story 1.3 create_proof_request_usecase still computes verificationPageUrl and deepLinkUrl for B2B response", () => {
  const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
  assert.match(src, /verificationPageUrl/, "verificationPageUrl local variable must still exist for B2B response");
  assert.match(src, /deepLinkUrl/, "deepLinkUrl local variable must still exist for B2B response");
});

// ── get_proof_session_viewmodel ────────────────────────────────────────────────

test("Story 1.3 ProofSessionOutputDTO does not expose verificationPageUrl", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
  assert.equal(src.includes("verificationPageUrl"), false, "ProofSessionOutputDTO must not expose verificationPageUrl");
});

test("Story 1.3 ProofSessionOutputDTO does not expose deepLinkUrl", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_viewmodel.ts");
  assert.equal(src.includes("deepLinkUrl"), false, "ProofSessionOutputDTO must not expose deepLinkUrl");
});

// ── get_proof_session_usecase ──────────────────────────────────────────────────

test("Story 1.3 get_proof_session_usecase return object does not include verificationPageUrl", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
  assert.equal(src.includes("verificationPageUrl"), false, "use case return must not include verificationPageUrl");
});

test("Story 1.3 get_proof_session_usecase return object does not include deepLinkUrl", () => {
  const src = readText("src/modules/proof-session/app/get_proof_session_usecase.ts");
  assert.equal(src.includes("deepLinkUrl"), false, "use case return must not include deepLinkUrl");
});

// ── SupabaseProofSessionRepository (review patch) ─────────────────────────────

test("Story 1.3 SupabaseProofSessionRepository.update persists challenge_nonce_hash", () => {
  const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
  assert.match(src, /challenge_nonce_hash/, "update() must persist challenge_nonce_hash");
});

test("Story 1.3 SupabaseProofSessionRepository.update persists challenge_created_at", () => {
  const src = readText("src/shared/infra/repositories/SupabaseProofSessionRepository.ts");
  assert.match(src, /challenge_created_at/, "update() must persist challenge_created_at");
});

// ── tela coringa regression fix (review patch) ────────────────────────────────

test("Story 1.3 tela coringa builds deep link from sessionToken param, not session.deepLinkUrl", () => {
  const src = readText("app/v/[sessionToken]/page.tsx");
  assert.equal(src.includes("session.deepLinkUrl"), false, "page must not read session.deepLinkUrl (field removed from DTO)");
  assert.match(src, /yaid:\/\/verify\?session=/, "page must build deep link URI from sessionToken URL param");
});

test("Story 1.3 tela coringa local ProofSession type does not include URL fields", () => {
  const src = readText("app/v/[sessionToken]/page.tsx");
  assert.equal(src.includes("verificationPageUrl"), false, "local ProofSession type must not include verificationPageUrl");
  assert.equal(src.includes("deepLinkUrl"), false, "local ProofSession type must not include deepLinkUrl");
});
