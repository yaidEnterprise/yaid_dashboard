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

  async execute(input: IssueCredentialInput): Promise<string> {
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
    } catch (err) {
      // TODO(debug-422-mobile): remover após diagnosticar a causa do 422 no fluxo smartphone.
      // Loga só metadados não sensíveis do payload (tamanho, prefixo) + o erro real do OCR.
      console.error("[issue-credential][ocr-failure]", {
        errorMessage: err instanceof Error ? err.message : String(err),
        documentImageLength: documentImage.length,
        documentImagePrefix: documentImage.slice(0, 30),
      });
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

    const privateKeyBytes = hexToBytes(this.issuerPrivateKey);
    const issuerPubKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
    const issuerPubKeyHex = bytesToHex(issuerPubKeyBytes);
    const issuerDid = `did:yaid:issuer:${issuerPubKeyHex}`;

    // VC-JWT compacto (EdDSA) — substitui a antiga assinatura JSON-LD embutida em "proof" (Epic 9)
    const header = { alg: "EdDSA", typ: "JWT", kid: `${issuerDid}#key-1` };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerDid,
      sub: holderDid,
      jti: id,
      iat: now,
      nbf: now,
      vc: claims,
    };

    const signingInput = `${bytesToBase64url(new TextEncoder().encode(JSON.stringify(header)))}.${bytesToBase64url(
      new TextEncoder().encode(JSON.stringify(payload))
    )}`;
    const jwtSignatureBytes = await ed.signAsync(new TextEncoder().encode(signingInput), privateKeyBytes);
    const vcJwt = `${signingInput}.${bytesToBase64url(jwtSignatureBytes)}`;

    // 6. Registrar o DID do holder on-chain
    try {
      await this.blockchainClient.registerDID(holderDid);
    } catch {
      throw new AppError("Blockchain registration failed", 502, "BAD_GATEWAY");
    }

    return vcJwt;
  }
}
