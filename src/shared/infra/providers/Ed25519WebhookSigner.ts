import * as ed from "@noble/ed25519";
import type { WebhookSigner, WebhookSignResult } from "@/shared/domain/interfaces/WebhookSigner";

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const TEST_KEY_PLACEHOLDER = "test-webhook-signing-private-key";
const TEST_KEY_HEX =
  "0000000000000000000000000000000000000000000000000000000000000002";

export class Ed25519WebhookSigner implements WebhookSigner {
  private readonly privateKeyBytes: Uint8Array;

  constructor(privateKeyHex: string) {
    const hex =
      privateKeyHex === TEST_KEY_PLACEHOLDER ? TEST_KEY_HEX : privateKeyHex;
    this.privateKeyBytes = hexToBytes(hex);
  }

  async sign(payload: string): Promise<WebhookSignResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const messageBytes = new TextEncoder().encode(payload);
    const signatureBytes = await ed.signAsync(
      messageBytes,
      this.privateKeyBytes
    );
    const signature = bytesToBase64(signatureBytes);
    return { signature, timestamp };
  }
}
