import * as ed from "@noble/ed25519";
import { AppError } from "@/shared/errors/AppError";
import { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";

function base64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export class RevokeCredentialUseCase {
  constructor(private readonly blockchainClient: BlockchainClient) {}

  async execute(input: { holderDid: string; vcId: string; bodySignature: string }) {
    const { holderDid, vcId, bodySignature } = input;

    const parts = holderDid.split(":");
    if (
      parts.length !== 4 ||
      parts[0] !== "did" ||
      parts[1] !== "yaid" ||
      parts[2] !== "user" ||
      !parts[3] ||
      !/^[0-9a-f]{64}$/.test(parts[3])
    ) {
      throw new AppError("Invalid DID", 401, "UNAUTHORIZED");
    }

    const payloadStr = `${vcId}`;
    const payloadBytes = new TextEncoder().encode(payloadStr);

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = base64urlToBytes(bodySignature);
    } catch {
      throw new AppError("Invalid signature", 401, "UNAUTHORIZED");
    }

    if (signatureBytes.length !== 64) {
      throw new AppError("Invalid signature", 401, "UNAUTHORIZED");
    }

    const publicKeyBytes = hexToBytes(parts[3]);
    let valid: boolean;
    try {
      valid = await ed.verifyAsync(signatureBytes, payloadBytes, publicKeyBytes);
    } catch {
      throw new AppError("Invalid signature", 401, "UNAUTHORIZED");
    }

    if (!valid) {
      throw new AppError("Invalid signature", 401, "UNAUTHORIZED");
    }

    try {
      await this.blockchainClient.revokeVC(vcId);
    } catch {
      throw new AppError("Blockchain revocation failed", 502, "BAD_GATEWAY");
    }

    return { revoked: true };
  }
}
