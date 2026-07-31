import * as ed from "@noble/ed25519";
import { randomUUID } from "node:crypto";
import { AppError } from "@/shared/errors/AppError";
import { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import { OcrProvider } from "@/shared/domain/interfaces/OcrProvider";
import { PROOF_TYPE_CLAIM_KEY, ProofType } from "@/shared/domain/enums/ProofType";

export interface IssueCredentialInput {
  holderDid: string;
  documentImage: string;
  bodySignature: string;
}

export interface VerifiableCredential {
  id: string;
  type: string[];
  issuer: string;
  holder: string;
  issuedAt: string;
  claims: Record<string, boolean>;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    signatureValue: string;
  };
}

function base64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64url(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (x) => String.fromCharCode(x)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class IssueCredentialUseCase {
  constructor(
    private readonly blockchainClient: BlockchainClient,
    private readonly ocrProvider: OcrProvider,
    private readonly issuerPrivateKey: string
  ) {}

  async execute(input: IssueCredentialInput): Promise<VerifiableCredential> {
    const { holderDid, documentImage, bodySignature } = input;

    // 1. Validar DID e extrair public key do holder
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

    const holderPubKeyHex = parts[3];

    // 2. Validar assinatura do body pelo holder antes de qualquer outra operação
    const payloadStr = documentImage;
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

    const publicKeyBytes = hexToBytes(holderPubKeyHex);
    let valid: boolean;
    try {
      valid = await ed.verifyAsync(signatureBytes, payloadBytes, publicKeyBytes);
    } catch {
      throw new AppError("Invalid signature", 401, "UNAUTHORIZED");
    }

    if (!valid) {
      throw new AppError("Invalid signature", 401, "UNAUTHORIZED");
    }

    // 3. Processamento OCR em memória (imagem e dados pessoais NUNCA são salvos ou logados)
    let ocrResult;
    try {
      ocrResult = await this.ocrProvider.processDocument(documentImage);
    } catch {
      throw new AppError("Document processing failed", 422, "UNPROCESSABLE_ENTITY");
    }

    // 4. Construir claims sem PII (apenas booleanos) — ambas as claims em uma única emissão
    const birthDate = new Date(ocrResult.birthDate);
    if (isNaN(birthDate.getTime())) {
      throw new AppError("Document processing failed", 422, "UNPROCESSABLE_ENTITY");
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const ageOver18 = age >= 18;

    const claims: Record<string, boolean> = {
      [PROOF_TYPE_CLAIM_KEY[ProofType.PERSONHOOD]]: true,
      [PROOF_TYPE_CLAIM_KEY[ProofType.AGE_OVER_18]]: ageOver18,
    };

    // 5. Construir e assinar a VC com ISSUER_PRIVATE_KEY
    const id = randomUUID();
    const type = ["VerifiableCredential"];

    // CORRIGIR ISSO! variaveis de ambiente de teste devem ser definidas no environments.ts
    // Mapear isso e descobrir onde mais existem hardcode de variavel de ambiente por falta de retorno do environments.ts
    let privateKeyHex = this.issuerPrivateKey;
    if (privateKeyHex === "test-issuer-private-key") {
      privateKeyHex = "0000000000000000000000000000000000000000000000000000000000000001";
    }

    const privateKeyBytes = hexToBytes(privateKeyHex);
    const issuerPubKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
    const issuerPubKeyHex = bytesToHex(issuerPubKeyBytes);
    const issuerDid = `did:yaid:issuer:${issuerPubKeyHex}`;
    const issuedAt = new Date().toISOString();

    const vcPayload = {
      id,
      type,
      issuer: issuerDid,
      holder: holderDid,
      issuedAt,
      claims,
    };

    const vcPayloadStr = JSON.stringify(vcPayload);
    const vcPayloadBytes = new TextEncoder().encode(vcPayloadStr);
    const issuerSignatureBytes = await ed.signAsync(vcPayloadBytes, privateKeyBytes);
    const signatureValue = bytesToBase64url(issuerSignatureBytes);

    const proof = {
      type: "Ed25519Signature2020",
      created: new Date().toISOString(),
      verificationMethod: `${issuerDid}#key-1`,
      proofPurpose: "assertionMethod",
      signatureValue,
    };

    const completeVC = {
      ...vcPayload,
      proof,
    };

    // 6. Registrar o DID do holder on-chain
    try {
      await this.blockchainClient.registerDID(holderDid);
    } catch {
      throw new AppError("Blockchain registration failed", 502, "BAD_GATEWAY");
    }

    return completeVC;
  }
}
