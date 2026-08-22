/**
 * Story 10.2 — teste dinâmico/comportamental: exercita `envSchema.parse()` de verdade
 * via `new Environments().loadEnvs()` (bypassando o cache do singleton estático
 * `Environments.getEnvs()`), provando em runtime que o boot rejeita chaves malformadas
 * e valores de placeholder do TEST_ENV, em qualquer stage exceto TEST — e que TEST/DOTENV
 * sem chaves definidas continuam funcionando exatamente como antes.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { Environments, Stage } from "@/shared/environments";

const REAL_ISSUER_TEST_HEX =
  "0000000000000000000000000000000000000000000000000000000000000001";
const REAL_WEBHOOK_TEST_HEX =
  "0000000000000000000000000000000000000000000000000000000000000002";
const REAL_CONTRACT_TEST_ADDRESS =
  "0x0000000000000000000000000000000000000001";

const VALID_ISSUER_HEX = "11".repeat(32);
const VALID_WEBHOOK_HEX = "22".repeat(32);
const VALID_WALLET_HEX = "33".repeat(32);
const VALID_CONTRACT_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
};

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const snapshot = { ...process.env };
  try {
    for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in snapshot)) delete process.env[key];
    }
    Object.assign(process.env, snapshot);
  }
}

// ── AC #1: formato hex das chaves de assinatura ─────────────────────────────

test("Story 10.2 — ISSUER_PRIVATE_KEY malformed (typo/wrong length/non-hex) fails boot naming the variable", () => {
  const cases = [
    "0000000000000000000000000000000000000000000000000000000000000zz1", // non-hex chars
    "00000000000000000000000000000000000000000000000000000000000000011", // 65 chars (one char too many)
    "not-a-hex-key",
  ];

  for (const malformed of cases) {
    withEnv(
      {
        STAGE: Stage.PROD,
        ISSUER_PRIVATE_KEY: malformed,
        WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
        BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
        BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
      },
      () => {
        assert.throws(
          () => new Environments().loadEnvs(),
          /ISSUER_PRIVATE_KEY must be exactly 64 hexadecimal characters/,
          `expected the format-validation message naming ISSUER_PRIVATE_KEY for malformed value: ${malformed}`
        );
      }
    );
  }
});

test("Story 10.2 — WEBHOOK_SIGNING_PRIVATE_KEY malformed fails boot naming the variable", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: "zz",
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /WEBHOOK_SIGNING_PRIVATE_KEY must be exactly 64 hexadecimal characters/
      );
    }
  );
});

test("Story 10.2 — ISSUER_PRIVATE_KEY defined as an empty string fails boot instead of being treated as absent (review patch)", () => {
  withEnv(
    {
      STAGE: Stage.DEV,
      ISSUER_PRIVATE_KEY: "",
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /ISSUER_PRIVATE_KEY must be exactly 64 hexadecimal characters/,
        "an explicitly-set empty string must fail format validation, not silently pass as if absent"
      );
    }
  );
});

test("Story 10.2 — all 4 keys with valid, non-placeholder values do not throw in PROD", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.doesNotThrow(() => new Environments().loadEnvs());
    }
  );
});

// ── AC #2: BLOCKCHAIN_WALLET_PRIVATE_KEY e BLOCKCHAIN_CONTRACT_ADDRESS ──────

test("Story 10.2 — BLOCKCHAIN_WALLET_PRIVATE_KEY malformed fails boot naming the variable", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: "too-short",
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /BLOCKCHAIN_WALLET_PRIVATE_KEY must be exactly 64 hexadecimal characters/
      );
    }
  );
});

test("Story 10.2 — BLOCKCHAIN_CONTRACT_ADDRESS invalid fails boot naming the variable", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: "not-an-address",
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /BLOCKCHAIN_CONTRACT_ADDRESS must be a valid Ethereum address/
      );
    }
  );
});

// ── AC #3: valores de placeholder do TEST_ENV rejeitados fora do TEST ───────

test("Story 10.2 — ISSUER_PRIVATE_KEY equal to the exact TEST_ENV value fails boot in PROD", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: REAL_ISSUER_TEST_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /ISSUER_PRIVATE_KEY is set to a known TEST_ENV placeholder value/
      );
    }
  );
});

test("Story 10.2 — WEBHOOK_SIGNING_PRIVATE_KEY equal to the exact TEST_ENV value fails boot in HOMOLOG", () => {
  withEnv(
    {
      STAGE: Stage.HOMOLOG,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: REAL_WEBHOOK_TEST_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /WEBHOOK_SIGNING_PRIVATE_KEY is set to a known TEST_ENV placeholder value/
      );
    }
  );
});

test("Story 10.2 — the TEST_ENV placeholder check is NOT gated to PROD/HOMOLOG: also fails boot in DEV", () => {
  withEnv(
    {
      STAGE: Stage.DEV,
      ISSUER_PRIVATE_KEY: REAL_ISSUER_TEST_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /ISSUER_PRIVATE_KEY is set to a known TEST_ENV placeholder value/
      );
    }
  );
});

test("Story 10.2 — BLOCKCHAIN_CONTRACT_ADDRESS equal to the exact TEST_ENV value fails boot in DOTENV", () => {
  withEnv(
    {
      STAGE: Stage.DOTENV,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: REAL_CONTRACT_TEST_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /BLOCKCHAIN_CONTRACT_ADDRESS is set to a known TEST_ENV placeholder value/
      );
    }
  );
});

test("Story 10.2 — a known TEST_ENV value leaked under a DIFFERENT field's name is still rejected (review patch: cross-field placeholder detection)", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      // The issuer's known TEST_ENV hex value, copy-pasted into the wrong field.
      WEBHOOK_SIGNING_PRIVATE_KEY: REAL_ISSUER_TEST_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /WEBHOOK_SIGNING_PRIVATE_KEY is set to a known TEST_ENV placeholder value/,
        "a leaked TEST_ENV secret must be rejected even when it lands under a different field's name than the one it normally occupies"
      );
    }
  );
});

test("Story 10.2 — BLOCKCHAIN_WALLET_PRIVATE_KEY equal to a hex TEST_ENV value from another field is rejected", () => {
  withEnv(
    {
      STAGE: Stage.HOMOLOG,
      ISSUER_PRIVATE_KEY: VALID_ISSUER_HEX,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      // BLOCKCHAIN_WALLET_PRIVATE_KEY's own TEST_ENV placeholder is a non-hex
      // string ("test-blockchain-wallet-private-key"), so it always fails the
      // hex-format check first; this proves the placeholder check ALSO fires
      // for this field when a valid-format leaked value from another slot is used.
      BLOCKCHAIN_WALLET_PRIVATE_KEY: REAL_WEBHOOK_TEST_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /BLOCKCHAIN_WALLET_PRIVATE_KEY is set to a known TEST_ENV placeholder value/
      );
    }
  );
});

// ── AC #4: stage TEST aceita as chaves do TEST_ENV normalmente ─────────────

test("Story 10.2 — STAGE=TEST accepts TEST_ENV keys normally, bypassing the new validation entirely", () => {
  withEnv(
    {
      STAGE: Stage.TEST,
      ISSUER_PRIVATE_KEY: undefined,
      WEBHOOK_SIGNING_PRIVATE_KEY: undefined,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: undefined,
      BLOCKCHAIN_CONTRACT_ADDRESS: undefined,
    },
    () => {
      const envs = new Environments();
      assert.doesNotThrow(() => envs.loadEnvs());
      assert.equal(envs.ISSUER_PRIVATE_KEY, REAL_ISSUER_TEST_HEX);
      assert.equal(envs.WEBHOOK_SIGNING_PRIVATE_KEY, REAL_WEBHOOK_TEST_HEX);
    }
  );
});

// ── AC #5: DOTENV/DEV sem as chaves definidas continua tolerado ────────────

test("Story 10.2 — STAGE=DEV without any of the 4 keys defined does not throw (absence still tolerated)", () => {
  withEnv(
    {
      STAGE: Stage.DEV,
      ISSUER_PRIVATE_KEY: undefined,
      WEBHOOK_SIGNING_PRIVATE_KEY: undefined,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: undefined,
      BLOCKCHAIN_CONTRACT_ADDRESS: undefined,
    },
    () => {
      assert.doesNotThrow(() => new Environments().loadEnvs());
    }
  );
});

// ── Regressão: checagem de presença em PROD continua funcionando ──────────

test("Story 10.2 (regression) — STAGE=PROD without ISSUER_PRIVATE_KEY at all still fails with the pre-existing presence message", () => {
  withEnv(
    {
      STAGE: Stage.PROD,
      ISSUER_PRIVATE_KEY: undefined,
      WEBHOOK_SIGNING_PRIVATE_KEY: VALID_WEBHOOK_HEX,
      BLOCKCHAIN_WALLET_PRIVATE_KEY: VALID_WALLET_HEX,
      BLOCKCHAIN_CONTRACT_ADDRESS: VALID_CONTRACT_ADDRESS,
    },
    () => {
      assert.throws(
        () => new Environments().loadEnvs(),
        /ISSUER_PRIVATE_KEY is required for PROD/
      );
    }
  );
});
