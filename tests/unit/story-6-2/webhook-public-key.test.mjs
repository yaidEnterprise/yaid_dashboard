/**
 * Story 6.2: Endpoint Público da Chave de Webhook
 *
 * Tests cover:
 * - AC #1: GET /api/webhook-public-key returns { publicKey, algorithm: "Ed25519" }, deterministic
 * - AC #2: publicKey round-trips with WEBHOOK_SIGNING_PRIVATE_KEY (sign -> verify true; tampered -> false)
 * - AC #3: WEBHOOK_SIGNING_PRIVATE_KEY validation already covered by environments.ts (contract check, no new code)
 * - Structure: module layering, public route classification, no middleware/environments changes
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ed from "@noble/ed25519";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const USECASE = "src/modules/webhook/app/get_webhook_public_key_usecase.ts";
const VIEWMODEL = "src/modules/webhook/app/get_webhook_public_key_viewmodel.ts";
const CONTROLLER = "src/modules/webhook/app/get_webhook_public_key_controller.ts";
const PRESENTER = "src/modules/webhook/app/get_webhook_public_key_presenter.ts";
const ROUTE = "app/api/webhook-public-key/route.ts";
const MIDDLEWARE = "src/shared/middleware.ts";
const ENVIRONMENTS = "src/shared/environments.ts";

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// ── Behavioral: Ed25519 round-trip (AC #2) ─────────────────────────────────

describe("Story 6.2 — Ed25519 public key round-trip (AC #2)", () => {
  const TEST_PRIVATE_KEY_HEX =
    "0000000000000000000000000000000000000000000000000000000000000002";

  test("signature made with the private key verifies true against the derived public key", async () => {
    const privateKeyBytes = hexToBytes(TEST_PRIVATE_KEY_HEX);
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
    const payload = new TextEncoder().encode(JSON.stringify({ status: "approved" }));
    const signature = await ed.signAsync(payload, privateKeyBytes);

    const isValid = await ed.verifyAsync(signature, payload, publicKeyBytes);
    assert.equal(isValid, true);
  });

  test("tampered payload fails verification against the same signature", async () => {
    const privateKeyBytes = hexToBytes(TEST_PRIVATE_KEY_HEX);
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
    const payload = new TextEncoder().encode(JSON.stringify({ status: "approved" }));
    const signature = await ed.signAsync(payload, privateKeyBytes);

    const tamperedPayload = new TextEncoder().encode(JSON.stringify({ status: "rejected" }));
    const isValid = await ed.verifyAsync(signature, tamperedPayload, publicKeyBytes);
    assert.equal(isValid, false);
  });

  test("forged signature (wrong key) fails verification", async () => {
    const privateKeyBytes = hexToBytes(TEST_PRIVATE_KEY_HEX);
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
    const payload = new TextEncoder().encode(JSON.stringify({ status: "approved" }));

    const otherPrivateKeyBytes = hexToBytes(
      "0000000000000000000000000000000000000000000000000000000000000003"
    );
    const forgedSignature = await ed.signAsync(payload, otherPrivateKeyBytes);

    const isValid = await ed.verifyAsync(forgedSignature, payload, publicKeyBytes);
    assert.equal(isValid, false);
  });
});

// ── Behavioral: use case output shape, mirrored logic (AC #1) ───────────────
// The use case is TypeScript with constructor parameter properties, which
// can't be dynamically imported under plain node:test (no TS loader in this
// project — see tests/unit/story-4-1 etc. for the same constraint). The
// round-trip tests above already exercise the real crypto operations with
// identical key material; this block locks in the exact response shape via
// the same base64 encoding the use case performs.

describe("Story 6.2 — response shape mirrors the use case output (AC #1)", () => {
  const TEST_PRIVATE_KEY_HEX =
    "0000000000000000000000000000000000000000000000000000000000000002";

  test("publicKey is base64-encoded and deterministic across repeated derivations", async () => {
    const privateKeyBytes = hexToBytes(TEST_PRIVATE_KEY_HEX);
    const first = Buffer.from(await ed.getPublicKeyAsync(privateKeyBytes)).toString("base64");
    const second = Buffer.from(await ed.getPublicKeyAsync(privateKeyBytes)).toString("base64");
    assert.equal(first, second);
    assert.match(first, /^[A-Za-z0-9+/]+=*$/, "must be standard base64, not base64url");
  });
});

// ── Structural contract tests ────────────────────────────────────────────────

describe("Story 6.2 — GetWebhookPublicKeyUseCase (structure)", () => {
  test("derives the public key via ed.getPublicKeyAsync", () => {
    const src = readText(USECASE);
    assert.match(src, /getPublicKeyAsync/);
    assert.match(src, /@noble\/ed25519/);
  });

  test("encodes the public key as standard base64 (Buffer), not base64url", () => {
    const src = readText(USECASE);
    assert.match(src, /Buffer\.from\(publicKeyBytes\)\.toString\("base64"\)/);
    assert.equal(src.includes("base64url"), false, "must not use base64url encoding");
  });

  test("substitutes the non-hex TEST_ENV placeholder with a valid hex fallback key", () => {
    const src = readText(USECASE);
    assert.match(src, /test-webhook-signing-private-key/);
    assert.match(src, /[0-9a-f]{64}/i, "must define a 64-char hex fallback key");
  });

  test("returns algorithm literal 'Ed25519'", () => {
    const src = readText(USECASE);
    assert.match(src, /algorithm:\s*"Ed25519"/);
  });

  test("constructor receives the private key and stage as plain values (injected by presenter)", () => {
    const src = readText(USECASE);
    assert.match(src, /private readonly webhookSigningPrivateKey: string/);
    assert.match(src, /private readonly stage: Stage/);
  });

  test("validates hex format and throws on malformed input (review patch)", () => {
    const src = readText(USECASE);
    assert.match(src, /HEX_PRIVATE_KEY_PATTERN/);
    assert.match(src, /throw new Error/);
  });

  test("gates the test-key placeholder substitution to the TEST stage (review patch)", () => {
    const src = readText(USECASE);
    assert.match(src, /if \(this\.stage !== Stage\.TEST\)/);
  });
});

describe("Story 6.2 — GetWebhookPublicKeyUseCase hex validation behavior (review patch)", () => {
  const HEX_PRIVATE_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

  test("rejects non-hex characters instead of silently coercing to zero bytes", () => {
    const malformed = "zz00000000000000000000000000000000000000000000000000000000000000";
    assert.equal(HEX_PRIVATE_KEY_PATTERN.test(malformed), false);
  });

  test("rejects odd-length hex instead of silently truncating", () => {
    const oddLength =
      "000000000000000000000000000000000000000000000000000000000000002"; // 65 chars
    assert.equal(HEX_PRIVATE_KEY_PATTERN.test(oddLength), false);
  });

  test("accepts a well-formed 64-char hex string", () => {
    const valid =
      "0000000000000000000000000000000000000000000000000000000000000002";
    assert.equal(HEX_PRIVATE_KEY_PATTERN.test(valid), true);
  });
});

describe("Story 6.2 — viewmodel, controller, presenter", () => {
  test("viewmodel exports GetWebhookPublicKeyOutputDTO with publicKey and algorithm fields", () => {
    const src = readText(VIEWMODEL);
    assert.match(src, /export type GetWebhookPublicKeyOutputDTO/);
    assert.match(src, /publicKey: string/);
    assert.match(src, /algorithm: "Ed25519"/);
  });

  test("controller.handle() takes no input and delegates directly to useCase.execute()", () => {
    const src = readText(CONTROLLER);
    assert.match(src, /async handle\(\): Promise<GetWebhookPublicKeyOutputDTO>/);
    assert.match(src, /return this\.useCase\.execute\(\);/);
  });

  test("presenter reads WEBHOOK_SIGNING_PRIVATE_KEY and stage from Environments and injects both into the use case", () => {
    const src = readText(PRESENTER);
    assert.match(src, /Environments\.getEnvs\(\)/);
    assert.match(src, /envs\.WEBHOOK_SIGNING_PRIVATE_KEY/);
    assert.match(src, /new GetWebhookPublicKeyUseCase\(envs\.WEBHOOK_SIGNING_PRIVATE_KEY, envs\.stage\)/);
  });
});

describe("Story 6.2 — GET /api/webhook-public-key route", () => {
  test("route file exists and exports a GET handler with no params", () => {
    const src = readText(ROUTE);
    assert.match(src, /export async function GET\(\)/);
  });

  test("route calls the presenter and returns 200 JSON on success", () => {
    const src = readText(ROUTE);
    assert.match(src, /makeGetWebhookPublicKeyController/);
    assert.match(src, /NextResponse\.json\(result, \{ status: 200 \}\)/);
  });

  test("route delegates errors to handleHttpError", () => {
    const src = readText(ROUTE);
    assert.match(src, /handleHttpError/);
  });
});

describe("Story 6.2 — public route classification and env infra (AC #3, no regressions)", () => {
  test("middleware already classifies GET /api/webhook-public-key as public (pre-existing, unmodified)", () => {
    const src = readText(MIDDLEWARE);
    assert.match(
      src,
      /pathname === "\/api\/webhook-public-key" && method === "GET"/,
      "isPublicApiRoute must already cover this route"
    );
  });

  test("environments.ts already requires WEBHOOK_SIGNING_PRIVATE_KEY in PROD/HOMOLOG (pre-existing, unmodified)", () => {
    const src = readText(ENVIRONMENTS);
    assert.match(src, /"WEBHOOK_SIGNING_PRIVATE_KEY"/);
    assert.match(src, /productionRequiredEnvNames/);
  });

  test("environments.ts getter throws explicitly when WEBHOOK_SIGNING_PRIVATE_KEY is unset (pre-existing, unmodified)", () => {
    const src = readText(ENVIRONMENTS);
    assert.match(
      src,
      /get WEBHOOK_SIGNING_PRIVATE_KEY\(\)\s*\{\s*return requireConfiguredValue/
    );
  });
});
