/**
 * DeliverWebhookUseCase — retry/backoff e logging com fetch mockado.
 */

import assert from "node:assert/strict";
import test, { afterEach, beforeEach, describe, mock } from "node:test";

import { DeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_usecase";
import { Environments } from "@/shared/environments";

const INPUT = {
  proofRequestId: "req-1",
  status: "APPROVED",
  proofType: "verification",
  externalReference: "ext-1",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const URL = "https://example.ngrok-free.app/hook";

function makeUseCase() {
  const requestRepo = {
    findById: async () => ({ request: {}, app: { id: "app-1" } }),
  };
  const signer = { sign: async () => ({ signature: "sig", timestamp: 1 }) };
  return new DeliverWebhookUseCase(requestRepo as never, signer as never);
}

describe("DeliverWebhookUseCase retry", () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalFetch = globalThis.fetch;
  const originalGetEnvs = Environments.getEnvs;
  let errors: string[];
  let warns: string[];

  beforeEach(() => {
    errors = [];
    warns = [];
    mock.method(console, "error", (m: string) => errors.push(m));
    mock.method(console, "warn", (m: string) => warns.push(m));
    // Skip real backoff delays only (the 5s abort timer stays real).
    mock.method(globalThis, "setTimeout", ((fn: () => void, ms?: number) =>
      originalSetTimeout(fn, ms === 500 || ms === 1_500 ? 0 : ms)) as never);
    (Environments as unknown as { getEnvs: () => unknown }).getEnvs = () => ({
      getCompanyAppRepository: async () => ({
        findById: async () => ({ webhookUrl: URL }),
      }),
    });
  });

  afterEach(() => {
    mock.restoreAll();
    globalThis.fetch = originalFetch;
    (Environments as unknown as { getEnvs: unknown }).getEnvs = originalGetEnvs;
  });


  test("success: single fetch call, no error log", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return { ok: true } as Response;
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.equal(calls, 1);
    assert.equal(errors.length, 0);
  });

  test("transient failure: retries and succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) throw new TypeError("fetch failed");
      return { ok: true } as Response;
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.equal(calls, 2);
    assert.equal(warns.length, 1);
    assert.equal(errors.length, 0);
  });

  test("persistent failure: 3 attempts, never throws, logs cause and webhookUrl", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
      });
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.equal(calls, 3);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /delivery error/);
    assert.ok(errors[0].includes(URL));
    assert.match(errors[0], /attempts=3/);
    assert.match(errors[0], /ECONNRESET/);
  });

  test("timeout abort is retried like any network failure", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new DOMException("This operation was aborted", "AbortError");
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.equal(calls, 3);
    assert.match(errors[0], /attempts=3/);
  });

  test("AggregateError cause is described by inner codes", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed", {
        cause: new AggregateError([
          Object.assign(new Error(""), { code: "ECONNREFUSED" }),
          Object.assign(new Error(""), { code: "ENETUNREACH" }),
        ]),
      });
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.match(errors[0], /ECONNREFUSED,ENETUNREACH/);
  });

  test("no webhookUrl configured: fetch never called", async () => {
    (Environments as unknown as { getEnvs: () => unknown }).getEnvs = () => ({
      getCompanyAppRepository: async () => ({
        findById: async () => ({ webhookUrl: "  " }),
      }),
    });
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return { ok: true } as Response;
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.equal(calls, 0);
  });

  test("HTTP non-2xx: no retry, logs delivery failed", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return { ok: false, status: 500, statusText: "ERR" } as Response;
    }) as typeof fetch;
    await makeUseCase().execute(INPUT);
    assert.equal(calls, 1);
    assert.match(errors[0], /delivery failed/);
  });
});
