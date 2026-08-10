import { NextRequest, NextResponse } from "next/server";
import * as ed from "@noble/ed25519";

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function base64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function withDIDAuth(request: NextRequest): Promise<NextResponse> {
  const did = request.headers.get("X-YaID-DID");
  const sigHeader = request.headers.get("X-YaID-Signature");
  const tsHeader = request.headers.get("X-YaID-Timestamp");

  if (!did || !sigHeader || !tsHeader) {
    return NextResponse.json({ error: "Missing auth headers" }, { status: 401 });
  }

  // Validate timestamp (±5 minutes = 300 000 ms); reject non-integer strings (review patch)
  const timestamp = Number(tsHeader);
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 300_000) {
    return NextResponse.json({ error: "Request expired" }, { status: 401 });
  }

  // Extract public key from DID: did:yaid:user:<hex-32-bytes>
  const parts = did.split(":");
  const hexPubKey = parts.length === 4 ? parts[3] : null;
  if (
    parts.length !== 4 ||
    parts[0] !== "did" ||
    parts[1] !== "yaid" ||
    parts[2] !== "user" ||
    !hexPubKey ||
    !/^[0-9a-f]{64}$/.test(hexPubKey)
  ) {
    return NextResponse.json({ error: "Invalid DID" }, { status: 401 });
  }

  const publicKeyBytes = hexToBytes(hexPubKey);

  // Build canonical payload: {timestamp}:{method}:{pathname}
  // Note: request.method is always uppercase in Next.js; mobile client must sign with uppercase method
  const pathname = request.nextUrl.pathname;
  const payload = `${tsHeader}:${request.method}:${pathname}`;
  const payloadBytes = new TextEncoder().encode(payload);

  // Decode base64url signature
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64urlToBytes(sigHeader);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Reject signatures that are not exactly 64 bytes before passing to crypto (review patch)
  if (signatureBytes.length !== 64) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Verify Ed25519 signature
  let valid: boolean;
  try {
    valid = await ed.verifyAsync(signatureBytes, payloadBytes, publicKeyBytes);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Attach authenticated DID to request context (same pattern as withSessionAuth → x-company-id)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-holder-did", did);

  return NextResponse.next({ request: { headers: requestHeaders } });
}
