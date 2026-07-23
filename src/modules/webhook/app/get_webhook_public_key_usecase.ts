import * as ed from "@noble/ed25519";
import { Stage } from "@/shared/environments";

const TEST_PRIVATE_KEY_PLACEHOLDER = "test-webhook-signing-private-key";
const TEST_PRIVATE_KEY_HEX =
  "0000000000000000000000000000000000000000000000000000000000000002";
const HEX_PRIVATE_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function hexToBytes(hex: string): Uint8Array {
  if (!HEX_PRIVATE_KEY_PATTERN.test(hex)) {
    throw new Error(
      "WEBHOOK_SIGNING_PRIVATE_KEY is not a valid 32-byte (64 hex char) private key"
    );
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export interface GetWebhookPublicKeyOutput {
  publicKey: string;
  algorithm: "Ed25519";
}

export class GetWebhookPublicKeyUseCase {
  constructor(
    private readonly webhookSigningPrivateKey: string,
    private readonly stage: Stage
  ) {}

  async execute(): Promise<GetWebhookPublicKeyOutput> {
    let privateKeyHex = this.webhookSigningPrivateKey;
    if (privateKeyHex === TEST_PRIVATE_KEY_PLACEHOLDER) {
      if (this.stage !== Stage.TEST) {
        throw new Error(
          "WEBHOOK_SIGNING_PRIVATE_KEY is set to the TEST_ENV placeholder outside the TEST stage"
        );
      }
      privateKeyHex = TEST_PRIVATE_KEY_HEX;
    }

    const privateKeyBytes = hexToBytes(privateKeyHex);
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

    return {
      publicKey: Buffer.from(publicKeyBytes).toString("base64"),
      algorithm: "Ed25519",
    };
  }
}
