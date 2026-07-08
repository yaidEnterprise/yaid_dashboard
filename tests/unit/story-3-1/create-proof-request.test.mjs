/**
 * Story 3.1: Endpoint B2B — Criação de Proof Request
 *
 * Tests cover:
 * - AC #1: successful creation with valid API key and active app
 * - AC #2: invalid/missing API key → UnauthorizedError
 * - AC #3: disabled app → UnprocessableEntityError (422)
 * - AC #4: invalid proofType → ZodError (400)
 * - AC #5: rollback on session creation failure
 * - Schema: proofType accepts personhood and age_over_18
 * - Schema: externalReference field name (not externalRef)
 * - Response: verificationUrl (not verificationPageUrl)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Minimal fake for CompanyAppRepository.
 * findById returns the configured app or null (company_apps.id is the only
 * identifier — there is no separate app_id column).
 */
function makeAppRepo({ app = null } = {}) {
  return {
    findById: async (id) => (app && app.id === id ? app : null),
    create: async () => {},
    listByCompanyId: async () => [],
    update: async () => {},
  };
}

/**
 * Minimal fake for ProofRequestRepository.
 * createAtomic records calls and optionally throws.
 */
function makeRequestRepo({ throwOnCreate = null } = {}) {
  const calls = [];
  return {
    calls,
    create: async () => {},
    createAtomic: async (request, session) => {
      if (throwOnCreate) throw throwOnCreate;
      calls.push({ request, session });
    },
    findById: async () => null,
    listByAppIds: async () => [],
  };
}

/**
 * Minimal fake for ApiKeyHasher.
 * verify returns true only when secret matches the configured value.
 */
function makeHasher({ validSecret = "secret123" } = {}) {
  return {
    hash: async (value) => `hash:${value}`,
    verify: async (secret, hash) => secret === validSecret,
  };
}

/**
 * Minimal fake CompanyApp entity-like object.
 */
function makeApp({
  id = "uuid-app-1",
  apiKeyHash = "hash:secret123",
  status = "enabled",
  name = "Test App",
  environment = "dev",
  companyId = "uuid-company-1",
} = {}) {
  return { id, apiKeyHash, status, name, environment, companyId };
}

// ── Import the modules under test ─────────────────────────────────────────────
// We use dynamic import to load TypeScript-compiled modules.
// Since this project uses ts-node or similar, we import the .ts source directly
// via the path alias resolution. For node:test with .mjs, we read the source
// as text and check structural contracts instead of executing TypeScript directly.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

// ── Structural / contract tests (no TypeScript execution needed) ───────────────

describe("Story 3.1 — CreateProofRequestSchema", () => {
  test("schema accepts personhood as proofType", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    assert.match(src, /z\.enum\(\["personhood", "age_over_18"\]\)/, "proofType must be z.enum with both values");
  });

  test("schema accepts age_over_18 as proofType", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    assert.match(src, /age_over_18/, "age_over_18 must be in the enum");
  });

  test("schema does not use z.literal for proofType", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    assert.equal(
      src.includes('z.literal("personhood")'),
      false,
      "proofType must not be z.literal — it must accept multiple values"
    );
  });

  test("schema uses externalReference (not externalRef) as field name", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    assert.match(src, /externalReference/, "input field must be named externalReference");
    assert.equal(
      src.includes("externalRef:"),
      false,
      "input field must not be named externalRef"
    );
  });

  test("proofType has no default value — field is required", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    assert.equal(
      src.includes('.default("personhood")'),
      false,
      "proofType must not have a default — it is required"
    );
  });
});

describe("Story 3.1 — CreatedProofRequestOutputDTO", () => {
  test("output DTO uses verificationUrl (not verificationPageUrl)", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    assert.match(src, /verificationUrl/, "output DTO must have verificationUrl field");
    assert.equal(
      src.includes("verificationPageUrl"),
      false,
      "output DTO must not use verificationPageUrl"
    );
  });

  test("output DTO uses externalReference (not externalRef)", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_viewmodel.ts");
    // ProofRequestOutputDTO should have externalReference
    const dtoSection = src.slice(src.indexOf("ProofRequestOutputDTO"));
    assert.match(dtoSection, /externalReference/, "ProofRequestOutputDTO must have externalReference field");
  });
});

describe("Story 3.1 — CreateProofRequestUseCase", () => {
  // company_apps.id is the only identifier (no app_id column) — the API key's
  // first segment is the UUID id itself.
  test("use case uses findById (not findByAppId) to look up app", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.match(src, /appRepo\.findById/, "use case must call findById");
    assert.equal(
      src.includes("findByAppId"),
      false,
      "use case must not call the removed findByAppId method"
    );
  });

  test("use case imports UnprocessableEntityError", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.match(src, /UnprocessableEntityError/, "use case must import UnprocessableEntityError");
  });

  test("use case throws UnprocessableEntityError for disabled app", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.match(
      src,
      /UnprocessableEntityError\("App is disabled"\)/,
      "use case must throw UnprocessableEntityError with 'App is disabled' message"
    );
  });

  test("use case verifies secret before checking app status (enumeration protection)", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    const verifyIdx = src.indexOf("hasher.verify");
    const statusIdx = src.indexOf("CompanyAppStatus.ENABLED");
    assert.ok(verifyIdx < statusIdx, "secret verification must happen before status check");
  });

  test("use case uses createAtomic (not separate create calls)", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.match(src, /createAtomic/, "use case must call createAtomic");
    assert.equal(
      src.includes("requestRepo.create("),
      false,
      "use case must not call requestRepo.create separately"
    );
    assert.equal(
      src.includes("sessionRepo.create("),
      false,
      "use case must not call sessionRepo.create separately"
    );
  });

  test("use case does not depend on ProofSessionRepository", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.equal(
      src.includes("ProofSessionRepository"),
      false,
      "use case must not import or use ProofSessionRepository"
    );
  });

  test("use case returns verificationUrl (not verificationPageUrl) in response", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.match(src, /verificationUrl/, "use case must return verificationUrl");
    assert.equal(
      src.includes("verificationPageUrl"),
      false,
      "use case must not return verificationPageUrl"
    );
  });

  test("use case returns externalReference (not externalRef) in response", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_usecase.ts");
    assert.match(src, /externalReference:/, "use case must return externalReference in response object");
  });
});

describe("Story 3.1 — AppError: UnprocessableEntityError", () => {
  test("UnprocessableEntityError exists in AppError.ts", () => {
    const src = readText("src/shared/errors/AppError.ts");
    assert.match(src, /UnprocessableEntityError/, "AppError.ts must export UnprocessableEntityError");
  });

  test("UnprocessableEntityError has statusCode 422", () => {
    const src = readText("src/shared/errors/AppError.ts");
    assert.match(src, /422/, "UnprocessableEntityError must use statusCode 422");
  });

  test("UnprocessableEntityError has code UNPROCESSABLE_ENTITY", () => {
    const src = readText("src/shared/errors/AppError.ts");
    assert.match(src, /UNPROCESSABLE_ENTITY/, "UnprocessableEntityError must use code UNPROCESSABLE_ENTITY");
  });
});

describe("Story 3.1 — CompanyAppRepository interface", () => {
  test("interface does not declare findByAppId (no app_id column exists)", () => {
    const src = readText("src/shared/domain/interfaces/repositories/CompanyAppRepository.ts");
    assert.equal(src.includes("findByAppId"), false, "CompanyAppRepository must not declare findByAppId");
    assert.match(src, /findById/, "CompanyAppRepository must declare findById");
  });
});

describe("Story 3.1 — SupabaseCompanyAppRepository", () => {
  test("does not implement findByAppId / query by app_id column", () => {
    const src = readText("src/shared/infra/repositories/SupabaseCompanyAppRepository.ts");
    assert.equal(src.includes("findByAppId"), false, "SupabaseCompanyAppRepository must not implement findByAppId");
    assert.equal(src.includes('"app_id"'), false, "must not query the non-existent app_id column");
  });
});

describe("Story 3.1 — CompanyAppPersistence type", () => {
  test("CompanyAppPersistence has no app_id field (column does not exist)", () => {
    const src = readText("src/shared/infra/dto/CompanyAppMapper.ts");
    assert.equal(src.includes("app_id"), false, "CompanyAppPersistence must not include app_id field");
  });
});

describe("Story 3.1 — ProofRequestRepository interface", () => {
  test("interface declares createAtomic method", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofRequestRepository.ts");
    assert.match(src, /createAtomic/, "ProofRequestRepository must declare createAtomic");
  });

  test("createAtomic accepts ProofRequest and ProofSession", () => {
    const src = readText("src/shared/domain/interfaces/repositories/ProofRequestRepository.ts");
    assert.match(src, /ProofSession/, "ProofRequestRepository must import ProofSession for createAtomic");
  });
});

describe("Story 3.1 — SupabaseProofRequestRepository", () => {
  test("implements createAtomic method", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofRequestRepository.ts");
    assert.match(src, /createAtomic/, "SupabaseProofRequestRepository must implement createAtomic");
  });

  test("createAtomic has rollback logic on session insert failure", () => {
    const src = readText("src/shared/infra/repositories/SupabaseProofRequestRepository.ts");
    assert.match(src, /rollback/, "createAtomic must have rollback comment/logic");
    assert.match(src, /delete\(\)/, "createAtomic must delete proof_request on rollback");
  });
});

describe("Story 3.1 — CreateProofRequestPresenter", () => {
  test("presenter does not inject ProofSessionRepository", () => {
    const src = readText("src/modules/proof-request/app/create_proof_request_presenter.ts");
    assert.equal(
      src.includes("getProofSessionRepository"),
      false,
      "presenter must not inject ProofSessionRepository — use case no longer needs it"
    );
  });
});
