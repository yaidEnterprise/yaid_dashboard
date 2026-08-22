import * as ed from "@noble/ed25519";

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
  constructor(private readonly webhookSigningPrivateKey: string) {}

  async execute(): Promise<GetWebhookPublicKeyOutput> {
    const privateKeyBytes = hexToBytes(this.webhookSigningPrivateKey);
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

    return {
      publicKey: Buffer.from(publicKeyBytes).toString("base64"),
      algorithm: "Ed25519",
    };
  }
}
