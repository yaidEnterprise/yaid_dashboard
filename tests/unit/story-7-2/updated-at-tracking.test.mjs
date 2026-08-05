/**
 * Story 7.2: Coluna `updated_at` e Gravação em Toda Transição
 *
 * Contract tests (source-inspection, no TypeScript execution) covering:
 * - AC #1: forward migration adds proof_request.updated_at, backfilled from created_at,
 *   NOT NULL DEFAULT now().
 * - AC #2: ProofRequest entity and ProofRequestMapper carry updatedAt/updated_at.
 * - AC #3: SupabaseProofRequestRepository.updateStatus() writes status and updated_at
 *   in the same operation.
 * - AC #4: GetProofRequestUseCase maps updatedAt from the real column, not validatedAt;
 *   the DTO type is no longer nullable.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const MIGRATIONS_DIR = "supabase/migrations";
const ENTITY = "src/shared/domain/entities/ProofRequest.ts";
const MAPPER = "src/shared/infra/dto/ProofRequestMapper.ts";
const REPOSITORY = "src/shared/infra/repositories/SupabaseProofRequestRepository.ts";
const CREATE_USECASE = "src/modules/proof-request/app/create_proof_request_usecase.ts";
const GET_USECASE = "src/modules/proof-request/app/get_proof_request_usecase.ts";
const GET_VIEWMODEL = "src/modules/proof-request/app/get_proof_request_viewmodel.ts";

function findUpdatedAtMigration() {
  const files = readdirSync(resolve(ROOT, MIGRATIONS_DIR)).sort();
  const match = files.find((f) => f.endsWith("_add_updated_at_to_proof_requests.sql"));
  assert.ok(match, "a migration file ending in _add_updated_at_to_proof_requests.sql must exist");
  return `${MIGRATIONS_DIR}/${match}`;
}

// ── AC #1: forward migration ────────────────────────────────────────────────

describe("Story 7.2 — forward migration add_updated_at_to_proof_requests", () => {
  test("adds updated_at column to proof_request", () => {
    const src = readText(findUpdatedAtMigration());
    assert.match(
      src,
      /alter table "public"\."proof_request"\s+add column "updated_at" timestamptz/,
      "must add updated_at timestamptz column to proof_request",
    );
  });

  test("backfills updated_at = created_at for existing rows", () => {
    const src = readText(findUpdatedAtMigration());
    assert.match(
      src,
      /update "public"\."proof_request"\s+set "updated_at" = "created_at"/,
      "must backfill updated_at from created_at",
    );
  });

  test("column ends up NOT NULL with DEFAULT now()", () => {
    const src = readText(findUpdatedAtMigration());
    assert.match(src, /set default now\(\)/, "must set default now()");
    assert.match(src, /set not null/, "must set column not null");
  });

  test("does not touch any other table", () => {
    const src = readText(findUpdatedAtMigration());
    assert.equal(
      /alter table "public"\.(?!"proof_request")/.test(src),
      false,
      "migration must only alter proof_request",
    );
  });
});

// ── AC #2: entity + mapper ──────────────────────────────────────────────────

describe("Story 7.2 — ProofRequest entity carries updatedAt", () => {
  test("ProofRequestProps declares updatedAt: Date", () => {
    const src = readText(ENTITY);
    assert.match(src, /updatedAt:\s*Date;/, "props must declare updatedAt: Date");
  });

  test("entity exposes an updatedAt getter", () => {
    const src = readText(ENTITY);
    assert.match(src, /get updatedAt\(\)\s*\{\s*return this\.props\.updatedAt;/, "must expose updatedAt getter");
  });
});

describe("Story 7.2 — ProofRequestMapper maps updated_at", () => {
  test("ProofRequestPersistence declares updated_at: string", () => {
    const src = readText(MAPPER);
    assert.match(src, /updated_at:\s*string;/, "persistence type must declare updated_at: string (non-nullable)");
  });

  test("toDomain maps updated_at to updatedAt", () => {
    const src = readText(MAPPER);
    assert.match(src, /updatedAt:\s*new Date\(raw\.updated_at\)/, "toDomain must map raw.updated_at");
  });

  test("toPersistence maps updatedAt to updated_at", () => {
    const src = readText(MAPPER);
    assert.match(
      src,
      /updated_at:\s*request\.updatedAt\.toISOString\(\)/,
      "toPersistence must serialize updatedAt",
    );
  });
});

// ── AC #3: updateStatus writes status + updated_at atomically ──────────────

describe("Story 7.2 — SupabaseProofRequestRepository.updateStatus", () => {
  test("writes both status and updated_at in the same .update() call", () => {
    const src = readText(REPOSITORY);
    const match = src.match(/async updateStatus\([^)]*\)[\s\S]*?\.update\(\{([^}]*)\}\)/);
    assert.ok(match, "updateStatus must call .update({...})");
    assert.match(match[1], /status/, "update payload must include status");
    assert.match(match[1], /updated_at:\s*new Date\(\)\.toISOString\(\)/, "update payload must include updated_at: now()");
  });
});

// ── create_proof_request_usecase: entity instantiation stays valid ─────────

describe("Story 7.2 — CreateProofRequestUseCase sets updatedAt on creation", () => {
  test("new ProofRequest(...) includes updatedAt", () => {
    const src = readText(CREATE_USECASE);
    const ctor = src.match(/new ProofRequest\(\{[\s\S]*?\}\);/);
    assert.ok(ctor, "must instantiate ProofRequest");
    assert.match(ctor[0], /updatedAt:/, "constructor call must set updatedAt");
  });
});

// ── AC #4: GetProofRequestUseCase + viewmodel ───────────────────────────────

describe("Story 7.2 — GetProofRequestUseCase maps real updatedAt", () => {
  test("updatedAt is sourced from row.request.updatedAt, not validatedAt", () => {
    const src = readText(GET_USECASE);
    assert.match(
      src,
      /updatedAt:\s*row\.request\.updatedAt\.toISOString\(\)/,
      "must map updatedAt from the real column",
    );
    assert.equal(
      /updatedAt:\s*row\.request\.validatedAt/.test(src),
      false,
      "must no longer alias updatedAt from validatedAt",
    );
  });

  test("validatedAt is still mapped separately (non-breaking)", () => {
    const src = readText(GET_USECASE);
    assert.match(src, /validatedAt:\s*row\.request\.validatedAt\?\.toISOString\(\) \?\? null/);
  });
});

describe("Story 7.2 — ProofRequestOutputDTO.updatedAt is non-nullable", () => {
  test("updatedAt type is string, not string | null", () => {
    const src = readText(GET_VIEWMODEL);
    assert.match(src, /updatedAt:\s*string;/, "updatedAt must be a required string");
    assert.equal(
      /updatedAt:\s*string\s*\|\s*null/.test(src),
      false,
      "updatedAt must no longer be nullable",
    );
  });
});
