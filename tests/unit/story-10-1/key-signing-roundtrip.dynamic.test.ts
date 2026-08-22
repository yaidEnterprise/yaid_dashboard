/**
 * Story 10.1 (QA) — teste dinâmico/comportamental: prova que as classes de produção
 * (`Ed25519WebhookSigner`, `GetWebhookPublicKeyUseCase`) continuam assinando/verificando
 * corretamente quando construídas com o valor hex que `environments.ts` agora fornece
 * diretamente (construtor de um único argumento, sem o remendo de placeholder nem o
 * parâmetro `stage` removidos por esta story).
 *
 * Fecha uma lacuna real: a suíte estática (`key-centralization.test.mjs`) prova via regex
 * que o remendo foi removido do source, e `tests/unit/story-6-2/webhook-public-key.test.mjs`
 * já fazia um round-trip Ed25519 real — mas chamando `ed.signAsync`/`ed.verifyAsync`
 * diretamente com o hex hardcoded, nunca através das classes de produção simplificadas.
 * Nenhum teste anterior instanciava `Ed25519WebhookSigner`/`GetWebhookPublicKeyUseCase` reais
 * com o valor final pós-Story 10.1 para confirmar que o construtor de um argumento (sem
 * `stage`) produz o mesmo par de chaves funcional que o remendo de dois argumentos produzia.
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as ed from "@noble/ed25519";

import { Ed25519WebhookSigner } from "@/shared/infra/providers/Ed25519WebhookSigner";
import { GetWebhookPublicKeyUseCase } from "@/modules/webhook/app/get_webhook_public_key_usecase";

const WEBHOOK_HEX =
  "0000000000000000000000000000000000000000000000000000000000000002";

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

test("Story 10.1 (QA) — Ed25519WebhookSigner + GetWebhookPublicKeyUseCase round-trip using the exact environments.ts TEST_ENV value", async () => {
  const signer = new Ed25519WebhookSigner(WEBHOOK_HEX);
  const publicKeyUseCase = new GetWebhookPublicKeyUseCase(WEBHOOK_HEX);

  const { publicKey, algorithm } = await publicKeyUseCase.execute();
  assert.equal(algorithm, "Ed25519");

  const payload = JSON.stringify({ proofRequestId: "abc-123", status: "approved" });
  const { signature } = await signer.sign(payload);

  const isValid = await ed.verifyAsync(
    base64ToBytes(signature),
    new TextEncoder().encode(payload),
    base64ToBytes(publicKey)
  );

  assert.equal(isValid, true);
});

test("Story 10.1 (QA) — a tampered payload fails verification against the same real-value-derived key pair", async () => {
  const signer = new Ed25519WebhookSigner(WEBHOOK_HEX);
  const publicKeyUseCase = new GetWebhookPublicKeyUseCase(WEBHOOK_HEX);

  const { publicKey } = await publicKeyUseCase.execute();
  const payload = JSON.stringify({ proofRequestId: "abc-123", status: "approved" });
  const { signature } = await signer.sign(payload);
  const tampered = JSON.stringify({ proofRequestId: "abc-123", status: "rejected" });

  const isValid = await ed.verifyAsync(
    base64ToBytes(signature),
    new TextEncoder().encode(tampered),
    base64ToBytes(publicKey)
  );

  assert.equal(isValid, false);
});
