/**
 * Story 10.1 — teste dinâmico/comportamental: confirma em runtime que
 * `Environments.getEnvs()` sob STAGE=TEST retorna exatamente os mesmos valores
 * hex que os quatro consumidores produziam via substituição local (AC #1 —
 * "nenhuma assinatura muda"). Executado via `tsx` para resolver os aliases
 * `@/...` do tsconfig, mesmo padrão estabelecido pela Story 5.8.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { Environments } from "@/shared/environments";

const ISSUER_HEX =
  "0000000000000000000000000000000000000000000000000000000000000001";
const WEBHOOK_HEX =
  "0000000000000000000000000000000000000000000000000000000000000002";

test("Story 10.1 — Environments.getEnvs() under STAGE=TEST returns the exact hex keys previously produced by consumer-side substitution", () => {
  process.env.STAGE = "TEST";
  const envs = Environments.getEnvs();

  assert.equal(envs.ISSUER_PRIVATE_KEY, ISSUER_HEX);
  assert.equal(envs.WEBHOOK_SIGNING_PRIVATE_KEY, WEBHOOK_HEX);
});
