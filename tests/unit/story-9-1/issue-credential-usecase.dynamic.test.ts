/**
 * Story 9.1 — teste dinâmico/comportamental do IssueCredentialUseCase.
 *
 * Diferente do teste estrutural de `vc-jwt-issuance.test.mjs` (regex sobre o
 * source), este arquivo instancia o use case real com dependências fake e
 * verifica o JWT efetivamente retornado em runtime: header/payload no formato
 * prescrito e assinatura EdDSA válida contra a public key do issuer.
 *
 * Executado via `tsx` (não `node --test` puro) porque importa os módulos
 * TypeScript reais do projeto, incluindo os aliases `@/...` do tsconfig —
 * mesmo padrão estabelecido pela Story 5.8.
 */

import * as ed from "@noble/ed25519";
import assert from "node:assert/strict";
import test from "node:test";

import { IssueCredentialUseCase } from "@/modules/credential/app/issue_credential_usecase";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import type { OcrProvider, OcrResult } from "@/shared/domain/interfaces/OcrProvider";

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

function bytesToBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const HOLDER_PRIVATE_KEY_HEX = "11".repeat(32);
const ISSUER_PRIVATE_KEY_HEX = "22".repeat(32);

class FakeBlockchainClient implements BlockchainClient {
  public registeredDids: string[] = [];
  async registerDID(did: string): Promise<void> {
    this.registeredDids.push(did);
  }
  async revokeVC(): Promise<void> {}
  async isDIDRegistered(): Promise<boolean> {
    return true;
  }
  async isVCRevoked(): Promise<boolean> {
    return false;
  }
}

class FakeOcrProvider implements OcrProvider {
  constructor(private readonly result: OcrResult) {}
  async processDocument(): Promise<OcrResult> {
    return this.result;
  }
}

async function buildHolderDidAndSignature(documentImage: string) {
  const holderPubKeyBytes = await ed.getPublicKeyAsync(hexToBytes(HOLDER_PRIVATE_KEY_HEX));
  const holderDid = `did:yaid:user:${bytesToHex(holderPubKeyBytes)}`;
  const signatureBytes = await ed.signAsync(
    new TextEncoder().encode(documentImage),
    hexToBytes(HOLDER_PRIVATE_KEY_HEX)
  );
  return { holderDid, bodySignature: bytesToBase64url(signatureBytes) };
}

test("Story 9.1 IssueCredentialUseCase returns a compact VC-JWT with valid EdDSA signature and prescribed header/payload (adult holder)", async () => {
  const documentImage = "fake-document-image-adult";
  const { holderDid, bodySignature } = await buildHolderDidAndSignature(documentImage);

  const blockchainClient = new FakeBlockchainClient();
  const ocrProvider = new FakeOcrProvider({
    name: "Fulano de Tal",
    cpf: "00000000000",
    birthDate: "1990-01-01",
  });

  const useCase = new IssueCredentialUseCase(blockchainClient, ocrProvider, ISSUER_PRIVATE_KEY_HEX);
  const vcJwt = await useCase.execute({ holderDid, documentImage, bodySignature });

  assert.equal(typeof vcJwt, "string");
  const parts = vcJwt.split(".");
  assert.equal(parts.length, 3, "VC-JWT must have exactly 3 dot-separated segments");

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(Buffer.from(base64urlToBytes(headerB64)).toString("utf8"));
  const payload = JSON.parse(Buffer.from(base64urlToBytes(payloadB64)).toString("utf8"));

  const issuerPubKeyBytes = await ed.getPublicKeyAsync(hexToBytes(ISSUER_PRIVATE_KEY_HEX));
  const issuerDid = `did:yaid:issuer:${bytesToHex(issuerPubKeyBytes)}`;

  assert.deepEqual(header, { alg: "EdDSA", typ: "JWT", kid: `${issuerDid}#key-1` });
  assert.equal(payload.iss, issuerDid);
  assert.equal(payload.sub, holderDid);
  assert.equal(typeof payload.jti, "string");
  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.nbf, "number");
  assert.deepEqual(payload.vc, { personhood: true, ageOver18: true });

  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureValid = await ed.verifyAsync(
    base64urlToBytes(signatureB64),
    new TextEncoder().encode(signingInput),
    issuerPubKeyBytes
  );
  assert.equal(signatureValid, true, "JWS signature must verify against the issuer public key");

  assert.deepEqual(blockchainClient.registeredDids, [holderDid]);
});

test("Story 9.1 IssueCredentialUseCase issues ageOver18: false for a minor holder without throwing (Story 5.7 semantics preserved)", async () => {
  const documentImage = "fake-document-image-minor";
  const { holderDid, bodySignature } = await buildHolderDidAndSignature(documentImage);

  const currentYear = new Date().getFullYear();
  const blockchainClient = new FakeBlockchainClient();
  const ocrProvider = new FakeOcrProvider({
    name: "Menor de Idade",
    cpf: "11111111111",
    birthDate: `${currentYear - 10}-01-01`,
  });

  const useCase = new IssueCredentialUseCase(blockchainClient, ocrProvider, ISSUER_PRIVATE_KEY_HEX);
  const vcJwt = await useCase.execute({ holderDid, documentImage, bodySignature });

  const [, payloadB64] = vcJwt.split(".");
  const payload = JSON.parse(Buffer.from(base64urlToBytes(payloadB64)).toString("utf8"));

  assert.deepEqual(payload.vc, { personhood: true, ageOver18: false });
});

test("Story 9.1 IssueCredentialUseCase rejects an invalid holder body signature with 401 before touching OCR/blockchain", async () => {
  const documentImage = "fake-document-image";
  const { holderDid } = await buildHolderDidAndSignature(documentImage);

  const blockchainClient = new FakeBlockchainClient();
  const ocrProvider = new FakeOcrProvider({ name: "X", cpf: "0", birthDate: "1990-01-01" });
  const useCase = new IssueCredentialUseCase(blockchainClient, ocrProvider, ISSUER_PRIVATE_KEY_HEX);

  await assert.rejects(
    () =>
      useCase.execute({
        holderDid,
        documentImage,
        bodySignature: bytesToBase64url(new Uint8Array(64)), // 64 zero bytes — well-formed but wrong signature
      }),
    (error: unknown) => {
      assert.match((error as Error).message, /Invalid signature/);
      return true;
    }
  );
  assert.deepEqual(blockchainClient.registeredDids, [], "Must not register DID when signature is invalid");
});

test("Story 9.1 IssueCredentialUseCase rejects a malformed (non-base64url) holder body signature with 401", async () => {
  const documentImage = "fake-document-image";
  const { holderDid } = await buildHolderDidAndSignature(documentImage);

  const blockchainClient = new FakeBlockchainClient();
  const ocrProvider = new FakeOcrProvider({ name: "X", cpf: "0", birthDate: "1990-01-01" });
  const useCase = new IssueCredentialUseCase(blockchainClient, ocrProvider, ISSUER_PRIVATE_KEY_HEX);

  await assert.rejects(
    () =>
      useCase.execute({
        holderDid,
        documentImage,
        bodySignature: "not-valid-base64url!!!",
      }),
    (error: unknown) => {
      assert.match((error as Error).message, /Invalid signature/);
      return true;
    }
  );
  assert.deepEqual(blockchainClient.registeredDids, [], "Must not register DID when signature is malformed");
});
