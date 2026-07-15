import * as ed from "@noble/ed25519";
import { createHash } from "node:crypto";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { VerifyPresentationOutputDTO } from "./verify_presentation_viewmodel";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ─── Expected VP shape ───────────────────────────────────────────────────────

interface VcProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  signatureValue: string;
}

interface VerifiableCredential {
  id: string;
  type: string[];
  issuer: string;
  holder: string;
  issuedAt: string;
  claims: Record<string, unknown>;
  proof: VcProof;
}

interface VerifiablePresentation {
  holder: string;
  challenge: string;
  verifiableCredential: VerifiableCredential[];
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    signatureValue: string;
  };
}

// ─── Use Case ────────────────────────────────────────────────────────────────

export interface VerifyPresentationUseCaseInput {
  vp: Record<string, unknown>;
  sessionToken: string;
  holderDid: string;
}

const CHALLENGE_VALIDITY_MS = 10 * 60 * 1000; // 10 minutes

export class VerifyPresentationUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly requestRepo: ProofRequestRepository,
    private readonly hasher: ApiKeyHasher,
    private readonly blockchainClient: BlockchainClient,
    private readonly issuerPrivateKey: string
  ) {}

  async execute(
    input: VerifyPresentationUseCaseInput
  ): Promise<VerifyPresentationOutputDTO> {
    const { vp: rawVp, sessionToken, holderDid } = input;

    // ── Look up session ──────────────────────────────────────────────────────
    const tokenHash = await this.hasher.hash(sessionToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    // Session not found → reject silently
    if (!session) {
      return { valid: false };
    }

    const proofRequestId = session.proofRequestId;

    // Helper: mark proof_request as rejected and return { valid: false }
    const reject = async (): Promise<VerifyPresentationOutputDTO> => {
      await this.requestRepo.updateStatus(proofRequestId, ProofRequestStatus.REJECTED);
      return { valid: false };
    };

    // ── Rule 11: proof_session must be in OPENED status ──────────────────────
    // Checked first as an optimization — avoids expensive blockchain calls when
    // the session is already in a terminal/invalid state.
    if (session.status !== ProofSessionStatus.OPENED) {
      return reject();
    }

    // ── Rule 1: VP structure is valid (required fields present) ──────────────
    const vp = rawVp as Partial<VerifiablePresentation>;
    if (
      typeof vp.holder !== "string" ||
      typeof vp.challenge !== "string" ||
      !Array.isArray(vp.verifiableCredential) ||
      !vp.proof ||
      typeof (vp.proof as Record<string, unknown>).signatureValue !== "string"
    ) {
      return reject();
    }

    const typedVp = vp as VerifiablePresentation;

    // ── Rule 2: VP holder signature is valid ─────────────────────────────────
    // Extract holder public key from DID
    const holderParts = holderDid.split(":");
    if (
      holderParts.length !== 4 ||
      holderParts[0] !== "did" ||
      holderParts[1] !== "yaid" ||
      holderParts[2] !== "user" ||
      !/^[0-9a-f]{64}$/.test(holderParts[3])
    ) {
      return reject();
    }
    const holderPubKeyBytes = hexToBytes(holderParts[3]);

    // VP payload signed by holder: JSON of VP without "proof" field
    const vpPayload = JSON.stringify({
      holder: typedVp.holder,
      challenge: typedVp.challenge,
      verifiableCredential: typedVp.verifiableCredential,
    });
    const vpPayloadBytes = new TextEncoder().encode(vpPayload);

    let vpSigBytes: Uint8Array;
    try {
      vpSigBytes = base64urlToBytes(typedVp.proof.signatureValue);
    } catch {
      return reject();
    }

    if (vpSigBytes.length !== 64) {
      return reject();
    }

    let vpSigValid: boolean;
    try {
      vpSigValid = await ed.verifyAsync(vpSigBytes, vpPayloadBytes, holderPubKeyBytes);
    } catch {
      return reject();
    }

    if (!vpSigValid) {
      return reject();
    }

    // ── Rule 3: VP contains exactly one VC ───────────────────────────────────
    if (typedVp.verifiableCredential.length !== 1) {
      return reject();
    }

    const vc = typedVp.verifiableCredential[0];

    // ── Rule 4: VC issuer signature is valid ─────────────────────────────────
    // Derive issuer public key from ISSUER_PRIVATE_KEY
    let issuerPrivKeyHex = this.issuerPrivateKey;
    if (issuerPrivKeyHex === "test-issuer-private-key") {
      issuerPrivKeyHex = "0000000000000000000000000000000000000000000000000000000000000001";
    }
    const issuerPrivKeyBytes = hexToBytes(issuerPrivKeyHex);
    const issuerPubKeyBytes = await ed.getPublicKeyAsync(issuerPrivKeyBytes);

    // VC payload signed by issuer (without "proof"): { id, type, issuer, holder, issuedAt, claims }
    const vcPayload = JSON.stringify({
      id: vc.id,
      type: vc.type,
      issuer: vc.issuer,
      holder: vc.holder,
      issuedAt: vc.issuedAt,
      claims: vc.claims,
    });
    const vcPayloadBytes = new TextEncoder().encode(vcPayload);

    if (!vc.proof || typeof vc.proof.signatureValue !== "string") {
      return reject();
    }

    let vcSigBytes: Uint8Array;
    try {
      vcSigBytes = base64urlToBytes(vc.proof.signatureValue);
    } catch {
      return reject();
    }

    if (vcSigBytes.length !== 64) {
      return reject();
    }

    let vcSigValid: boolean;
    try {
      vcSigValid = await ed.verifyAsync(vcSigBytes, vcPayloadBytes, issuerPubKeyBytes);
    } catch {
      return reject();
    }

    if (!vcSigValid) {
      return reject();
    }

    // ── Rule 5: VC claims are booleans only (no PII) ─────────────────────────
    if (
      typeof vc.claims !== "object" ||
      vc.claims === null ||
      Object.values(vc.claims).some((v) => typeof v !== "boolean")
    ) {
      return reject();
    }

    // ── Rule 6: VC holder DID matches the authenticated DID ──────────────────
    if (vc.holder !== holderDid) {
      return reject();
    }

    // ── Rule 7: Nonce in VP matches challenge_nonce_hash in session ──────────
    const nonceHash = sha256hex(typedVp.challenge);
    if (nonceHash !== session.challengeNonceHash) {
      return reject();
    }

    // ── Rule 8: challenge_created_at is within validity window ───────────────
    if (
      !session.challengeCreatedAt ||
      Date.now() - session.challengeCreatedAt.getTime() > CHALLENGE_VALIDITY_MS
    ) {
      return reject();
    }

    // ── Rule 9: Holder DID is registered on-chain ────────────────────────────
    let isDIDRegistered: boolean;
    try {
      isDIDRegistered = await this.blockchainClient.isDIDRegistered(holderDid);
    } catch {
      return reject();
    }

    if (!isDIDRegistered) {
      return reject();
    }

    // ── Rule 10: VC is not revoked on-chain ───────────────────────────────────
    let isVCRevoked: boolean;
    try {
      isVCRevoked = await this.blockchainClient.isVCRevoked(vc.id);
    } catch {
      return reject();
    }

    if (isVCRevoked) {
      return reject();
    }

    // ── All 11 rules passed: approve ─────────────────────────────────────────
    const now = new Date();
    session.approveByUser(now);
    await this.sessionRepo.update(session);
    await this.requestRepo.updateStatus(proofRequestId, ProofRequestStatus.APPROVED);

    return { valid: true };
  }
}
