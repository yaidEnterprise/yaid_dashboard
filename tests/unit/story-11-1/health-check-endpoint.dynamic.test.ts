/**
 * Story 11.1: Health Check Endpoint (dynamic/behavioral)
 *
 * Runtime coverage complementing the structural tests in
 * tests/unit/story-11-1/health-check-endpoint.test.mjs — actually invokes
 * GET() and inspects the real NextResponse instead of grepping source text.
 *
 * - AC #1: response body/status/header are correct at runtime
 * - AC #5: GET() completes without any await (no blocking network/IO in the handler path)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET, dynamic } from "../../../app/api/health/route";

describe("Story 11.1 (dynamic) — GET /api/health runtime behavior", () => {
  test("returns a Response with status 200 and { status: 'ok' } body", async () => {
    const response = GET();
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(body, { status: "ok" });
  });

  test("sets Cache-Control: no-store on the real response headers", () => {
    const response = GET();
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  test("GET() is synchronous — no await/Promise in the handler path (AC #5)", () => {
    const result = GET();
    assert.equal(
      result instanceof Promise,
      false,
      "GET() must not return a Promise — any awaited call would risk blocking IO in the smoke-test path"
    );
  });

  test("exports dynamic = 'force-dynamic' as a real runtime binding", () => {
    assert.equal(dynamic, "force-dynamic");
  });
});
