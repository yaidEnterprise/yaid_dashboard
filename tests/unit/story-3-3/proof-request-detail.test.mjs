/**
 * Story 3.3: Detalhe de Proof Request
 *
 * Contract tests (source-inspection, no TypeScript execution) covering:
 * - AC #1: detail page fetches GET /api/proof-requests/{id} via fetchWithAuth; renders
 *          summary / attributes / privacy card; NO timeline (FR8). Raw API JSON block
 *          removed by Story 7.6.
 * - AC #2: confirmed claims derived from proofType when status === approved.
 * - AC #3: status-specific messages for non-approved statuses.
 * - AC #4: backend returns 404 (NotFoundError) — never 403 (ForbiddenError) — on company mismatch.
 * - AC #5: loading + not-found/error states.
 * - Task 2: GET DTO exposes externalReference + updatedAt (additive).
 * - Task 6: CompanyApp has no separate app_id column — company_apps.id is the
 *   only identifier (confirmed against the live schema; superseded the earlier
 *   first-class-appId design).
 * - Review patch: claims guarded by result !== false.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const USECASE = "src/modules/proof-request/app/get_proof_request_usecase.ts";
const VIEWMODEL = "src/modules/proof-request/app/get_proof_request_viewmodel.ts";
const STORE = "utils/proof-requests-store.ts";
const PAGE = "app/(dashboard)/proof-requests/[requestId]/page.tsx";
const ENTITY = "src/shared/domain/entities/CompanyApp.ts";
const MAPPER = "src/shared/infra/dto/CompanyAppMapper.ts";
const CREATE_APP = "src/modules/company-app/app/create_company_app_usecase.ts";

// ── AC #4: 404 anti-enumeration (backend use case) ─────────────────────────────

describe("Story 3.3 — GetProofRequestUseCase (AC #4: 404 not 403)", () => {
  test("throws NotFoundError on company mismatch (never 403)", () => {
    const src = readText(USECASE);
    assert.match(src, /NotFoundError/, "must throw NotFoundError");
    assert.equal(
      src.includes("ForbiddenError"),
      false,
      "must NOT reference ForbiddenError — company mismatch converges to 404 (NFR6)"
    );
  });

  test("company mismatch and not-found both converge to NotFoundError", () => {
    const src = readText(USECASE);
    // A single guard covering both !row and companyId mismatch.
    assert.match(
      src,
      /!row\s*\|\|\s*row\.app\.companyId !== input\.companyId/,
      "both 'not found' and 'wrong company' must throw the same 404"
    );
  });
});

// ── AC #1 / Task 2: GET DTO fields ─────────────────────────────────────────────

describe("Story 3.3 — GetProofRequest DTO (Task 2)", () => {
  test("ProofRequestOutputDTO exposes externalReference", () => {
    assert.match(readText(VIEWMODEL), /externalReference/, "DTO must expose externalReference");
  });

  test("ProofRequestOutputDTO exposes updatedAt", () => {
    assert.match(readText(VIEWMODEL), /updatedAt/, "DTO must expose updatedAt");
  });

  test("legacy fields (externalRef, validatedAt) are preserved (additive change)", () => {
    const src = readText(VIEWMODEL);
    assert.match(src, /externalRef/, "externalRef must remain for non-breaking change");
    assert.match(src, /validatedAt/, "validatedAt must remain for non-breaking change");
  });

  test("use case populates externalReference and updatedAt", () => {
    const src = readText(USECASE);
    assert.match(src, /externalReference:/, "use case must set externalReference");
    assert.match(src, /updatedAt:/, "use case must set updatedAt");
  });
});

// ── AC #1 / #5 / FR8: client store ─────────────────────────────────────────────

describe("Story 3.3 — proof-requests-store", () => {
  test("getProofRequest uses fetchWithAuth against /api/proof-requests/{id} with no-store", () => {
    const src = readText(STORE);
    assert.match(src, /import\s*\{\s*fetchWithAuth\s*\}/, "must import fetchWithAuth");
    assert.match(src, /\/api\/proof-requests\/\$\{requestId\}/, "must call GET /api/proof-requests/{id}");
    assert.match(src, /cache:\s*"no-store"/, "must use cache: no-store");
  });

  test("asJson surfaces backend error.message shape { error: { code, message } }", () => {
    assert.match(readText(STORE), /json\.error\?\.message/, "must read json.error?.message");
  });

  test("confirmedClaims derives personhood and ageOver18 claims", () => {
    const src = readText(STORE);
    assert.match(src, /personhood/, "must derive personhood claim");
    assert.match(src, /ageOver18/, "must derive ageOver18 claim for age_over_18 proofType");
  });

  test("provides PT-BR status labels for every backend status", () => {
    const src = readText(STORE);
    for (const s of ["pending_user", "processing", "approved", "rejected", "expired"]) {
      assert.match(src, new RegExp(s), `status label map must include ${s}`);
    }
  });
});

// ── AC #1..#5: detail page ─────────────────────────────────────────────────────

describe("Story 3.3 — detail page", () => {
  test("fetches real data via getProofRequest (no hardcoded mocks)", () => {
    const src = readText(PAGE);
    assert.match(src, /getProofRequest/, "page must call getProofRequest");
    assert.equal(
      src.includes("https://verify.yaid.app"),
      false,
      "page must not contain the fake hardcoded verification URL"
    );
  });

  test("has NO timeline (FR8: sem timeline no MVP)", () => {
    const src = readText(PAGE);
    assert.equal(src.includes("const timeline"), false, "timeline mock must be removed");
    assert.equal(/Linha do tempo/.test(src), false, "timeline UI must be removed");
  });

  test("renders loading and not-found states (AC #5)", () => {
    const src = readText(PAGE);
    assert.match(src, /animate-spin/, "must render a loading spinner");
    assert.match(src, /Solicitação não encontrada/, "must render a not-found state");
    assert.match(src, /href="\/proof-requests"/, "not-found state must link back to the list");
  });

  test("maps backend status pending_user → StatusBadge 'pending' (AC #1/#3)", () => {
    const src = readText(PAGE);
    assert.match(src, /"pending_user"\s*\?\s*"pending"/, "must map pending_user to pending");
  });

  test("shows confirmed claims only when approved, else status message (AC #2/#3)", () => {
    const src = readText(PAGE);
    assert.match(src, /status === "approved"/, "must gate claims on approved status");
    assert.match(src, /NON_APPROVED_MESSAGES/, "must show a status message for non-approved states");
  });

  test("review patch: claims guarded against result === false", () => {
    const src = readText(PAGE);
    assert.match(src, /result !== false/, "claims must be guarded by result !== false");
  });

  test("keeps the privacy card and no longer exposes the raw API JSON (Story 7.6)", () => {
    const src = readText(PAGE);
    assert.equal(src.includes("CodeBlock"), false, "raw response CodeBlock was removed by Story 7.6");
    assert.equal(src.includes("JSON.stringify"), false, "raw payload serialization was removed by Story 7.6");
    assert.match(src, /Privacidade/, "must keep the privacy card");
  });
});

// ── Task 6: CompanyApp has no separate app_id column ────────────────────────────

describe("Story 3.3 — Task 6: company_apps.id is the only identifier", () => {
  test("entity does not declare a separate appId prop/getter", () => {
    const src = readText(ENTITY);
    assert.equal(src.includes("appId"), false, "entity must not have a redundant appId field");
  });

  test("mapper has no app_id mapping (column does not exist)", () => {
    const src = readText(MAPPER);
    assert.equal(src.includes("app_id"), false, "mapper must not reference app_id");
  });

  test("create use case exposes appId in the response DTO mirroring app.id", () => {
    assert.match(readText(CREATE_APP), /appId:\s*app\.id/, "response DTO must set appId: app.id");
  });
});
