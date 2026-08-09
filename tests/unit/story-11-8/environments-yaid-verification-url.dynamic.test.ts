/**
 * Story 11.8: `YAID_VERIFICATION_BASE_URL` — derivada, não sincronizada (AC #6)
 *
 * Runtime coverage complementing the structural tests in
 * tests/unit/story-11-8/env-var-sync-authoritative.test.mjs — actually
 * instantiates `Environments` and inspects the real getter, instead of
 * grepping source text.
 *
 * - AC #6: `YAID_VERIFICATION_BASE_URL` é derivada como
 *   `${NEXT_PUBLIC_APP_URL}/v` e NÃO é mais lida de `process.env`.
 * - Review patch #1 (double-slash bug): `NEXT_PUBLIC_APP_URL` com barra final
 *   deve produzir `.../v` (uma barra só), nunca `..//v`. TEST_ENV fixa
 *   `NEXT_PUBLIC_APP_URL` sem barra final, então esse caso usa STAGE=DEV com
 *   `process.env.NEXT_PUBLIC_APP_URL` sobrescrito diretamente (a TEST stage
 *   ignora process.env e usaria o TEST_ENV fixo, mascarando o bug).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Environments, Stage } from "../../../src/shared/environments";

describe("Story 11.8 (dynamic) — YAID_VERIFICATION_BASE_URL is derived, not read from env", () => {
  test("STAGE=TEST fixture: equals `${NEXT_PUBLIC_APP_URL}/v`", () => {
    process.env.STAGE = Stage.TEST;
    const environments = new Environments();
    environments.loadEnvs();

    assert.equal(
      environments.YAID_VERIFICATION_BASE_URL,
      `${environments.NEXT_PUBLIC_APP_URL}/v`,
    );
    assert.equal(environments.YAID_VERIFICATION_BASE_URL, "http://localhost:3000/v");
  });

  test("ignores process.env.YAID_VERIFICATION_BASE_URL entirely (no longer read from it)", () => {
    process.env.STAGE = Stage.TEST;
    process.env.YAID_VERIFICATION_BASE_URL = "https://should-be-ignored.example/v";

    const environments = new Environments();
    environments.loadEnvs();

    assert.notEqual(
      environments.YAID_VERIFICATION_BASE_URL,
      "https://should-be-ignored.example/v",
    );
    assert.equal(
      environments.YAID_VERIFICATION_BASE_URL,
      `${environments.NEXT_PUBLIC_APP_URL}/v`,
    );

    delete process.env.YAID_VERIFICATION_BASE_URL;
  });
});

describe("Story 11.8 (dynamic) — review patch #1: sem barra dupla quando NEXT_PUBLIC_APP_URL termina em '/'", () => {
  // TEST stage usa o TEST_ENV fixo (NEXT_PUBLIC_APP_URL sem barra final) e
  // ignora process.env — não é possível reproduzir o bug da barra dupla por
  // ele. Usa-se STAGE=DEV, que lê de fato de `process.env` via
  // `readProcessEnv()`/`envSchema.parse()`, para exercitar o `.replace(/\/+$/, "")`
  // real do getter contra um valor de barra final controlado.
  const originalEnv = { ...process.env };

  function resetEnv() {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }

  test("NEXT_PUBLIC_APP_URL com UMA barra final -> YAID_VERIFICATION_BASE_URL tem uma única barra antes de /v", () => {
    process.env.STAGE = Stage.DEV;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dev-publishable-key";
    process.env.SUPABASE_SECRET_KEY = "dev-secret-key";

    try {
      const environments = new Environments();
      environments.loadEnvs();

      assert.equal(
        environments.YAID_VERIFICATION_BASE_URL,
        "https://app.example.com/v",
      );
      assert.ok(
        !environments.YAID_VERIFICATION_BASE_URL.includes("//v"),
        "não pode haver barra dupla antes de /v",
      );
    } finally {
      resetEnv();
    }
  });

  test("NEXT_PUBLIC_APP_URL com MÚLTIPLAS barras finais (////) -> ainda assim uma única barra antes de /v", () => {
    process.env.STAGE = Stage.DEV;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com////";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dev-publishable-key";
    process.env.SUPABASE_SECRET_KEY = "dev-secret-key";

    try {
      const environments = new Environments();
      environments.loadEnvs();

      assert.equal(
        environments.YAID_VERIFICATION_BASE_URL,
        "https://app.example.com/v",
      );
    } finally {
      resetEnv();
    }
  });

  test("NEXT_PUBLIC_APP_URL SEM barra final continua correta (regressão do caminho já coberto)", () => {
    process.env.STAGE = Stage.DEV;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dev-publishable-key";
    process.env.SUPABASE_SECRET_KEY = "dev-secret-key";

    try {
      const environments = new Environments();
      environments.loadEnvs();

      assert.equal(
        environments.YAID_VERIFICATION_BASE_URL,
        "https://app.example.com/v",
      );
    } finally {
      resetEnv();
    }
  });
});
