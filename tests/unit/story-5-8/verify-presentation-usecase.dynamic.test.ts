/**
 * Story 5.8 — teste dinâmico/comportamental do VerifyPresentationUseCase.
 *
 * Diferente dos testes estruturais de `claim-proof-type-correspondence.test.mjs`
 * (regex sobre o source), este arquivo instancia o use case real com
 * repositórios/dependências fake e verifica o `{ valid: boolean }` efetivamente
 * retornado, a transição de status persistida e o payload do webhook — fechando
 * a lacuna registrada em `deferred-work.md` ("suíte de testes é 100% estática").
 *
 * Executado via `tsx` (não `node --test` puro) porque importa os módulos
 * TypeScript reais do projeto, incluindo os aliases `@/...` do tsconfig.
 */

import * as ed from "@noble/ed25519";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { VerifyPresentationUseCase } from "@/modules/presentation/app/verify_presentation_usecase";
import { ProofSession } from "@/shared/domain/entities/ProofSession";
import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import type {
  ProofRequestRepository,
  ProofRequestWithApp,
} from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import type {
  ProofSessionRepository,
  ProofSessionWithContext,
} from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import type { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import type {
  DeliverWebhookUseCase,
  DeliverWebhookInput,
} from "@/modules/webhook/app/deliver_webhook_usecase";

// ─── Crypto helpers (mirroring verify_presentation_usecase.ts encoding) ──────

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const HOLDER_PRIVATE_KEY_HEX = "11".repeat(32);
const ISSUER_PRIVATE_KEY_HEX = "22".repeat(32);

// ─── Fake dependencies ────────────────────────────────────────────────────────

class FakeApiKeyHasher implements ApiKeyHasher {
  async hash(secret: string): Promise<string> {
    return `hashed:${secret}`;
  }
  async verify(): Promise<boolean> {
    return true;
  }
}

class FakeSessionRepo implements ProofSessionRepository {
  public updated: ProofSession[] = [];
  constructor(private readonly session: ProofSession | null) {}
  async create(): Promise<void> {}
  async findByTokenHash(hash: string): Promise<ProofSession | null> {
    if (!this.session) return null;
    return this.session.hashSessionToken === hash ? this.session : null;
  }
  async findByTokenHashWithContext(): Promise<ProofSessionWithContext | null> {
    return null;
  }
  async update(session: ProofSession): Promise<void> {
    this.updated.push(session);
  }
}

class FakeRequestRepo implements ProofRequestRepository {
  public statusUpdates: { id: string; status: ProofRequestStatus }[] = [];
  constructor(private readonly result: ProofRequestWithApp | null) {}
  async create(): Promise<void> {}
  async createAtomic(): Promise<void> {}
  async findById(id: string): Promise<ProofRequestWithApp | null> {
    if (!this.result) return null;
    return this.result.request.id === id ? this.result : null;
  }
  async listByAppIds(): Promise<ProofRequestWithApp[]> {
    return [];
  }
  async updateStatus(id: string, status: ProofRequestStatus): Promise<void> {
    this.statusUpdates.push({ id, status });
  }
}

class FakeBlockchainClient implements BlockchainClient {
  constructor(
    private readonly didRegistered = true,
    private readonly vcRevoked = false
  ) {}
  async registerDID(): Promise<void> {}
  async revokeVC(): Promise<void> {}
  async isDIDRegistered(): Promise<boolean> {
    return this.didRegistered;
  }
  async isVCRevoked(): Promise<boolean> {
    return this.vcRevoked;
  }
}

class FakeDeliverWebhookUseCase implements Pick<DeliverWebhookUseCase, "execute"> {
  public calls: DeliverWebhookInput[] = [];
  async execute(input: DeliverWebhookInput): Promise<void> {
    this.calls.push(input);
  }
}

// ─── Fixture builder ──────────────────────────────────────────────────────────

async function buildFixture(opts: {
  proofType: "personhood" | "age_over_18";
  claims: Record<string, boolean>;
}) {
  const holderPrivBytes = hexToBytes(HOLDER_PRIVATE_KEY_HEX);
  const holderPubBytes = await ed.getPublicKeyAsync(holderPrivBytes);
  const holderDid = `did:yaid:user:${bytesToHex(holderPubBytes)}`;

  const issuerPrivBytes = hexToBytes(ISSUER_PRIVATE_KEY_HEX);
  const issuerPubBytes = await ed.getPublicKeyAsync(issuerPrivBytes);
  const issuerDid = `did:yaid:issuer:${bytesToHex(issuerPubBytes)}`;

  const nonce = "test-nonce-12345";
  const challengeNonceHash = sha256hex(nonce);

  const now = Math.floor(Date.now() / 1000);
  const vcHeader = {
    alg: "EdDSA",
    typ: "JWT",
    kid: `${issuerDid}#key-1`,
  };
  const vcPayload = {
    iss: issuerDid,
    sub: holderDid,
    jti: "vc-1",
    iat: now,
    nbf: now,
    vc: opts.claims,
  };
  const headerSegment = base64url(
    new TextEncoder().encode(JSON.stringify(vcHeader))
  );
  const payloadSegment = base64url(
    new TextEncoder().encode(JSON.stringify(vcPayload))
  );
  const vcSigningInput = `${headerSegment}.${payloadSegment}`;
  const vcSig = await ed.signAsync(
    new TextEncoder().encode(vcSigningInput),
    issuerPrivBytes
  );
  const vcJwt = `${vcSigningInput}.${base64url(vcSig)}`;

  const vpUnsigned = {
    holder: holderDid,
    challenge: nonce,
    verifiableCredential: [vcJwt],
  };
  const vpPayload = JSON.stringify(vpUnsigned);
  const vpSig = await ed.signAsync(new TextEncoder().encode(vpPayload), holderPrivBytes);
  const vp = {
    ...vpUnsigned,
    proof: {
      type: "Ed25519Signature2020",
      created: new Date().toISOString(),
      verificationMethod: `${holderDid}#key-1`,
      proofPurpose: "authentication",
      signatureValue: base64url(vpSig),
    },
  };

  const proofRequestId = "req-1";
  const sessionToken = "session-token-1";
  const session = new ProofSession({
    id: "sess-1",
    proofRequestId,
    hashSessionToken: `hashed:${sessionToken}`,
    challengeNonceHash,
    challengeCreatedAt: new Date(),
    status: ProofSessionStatus.OPENED,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    openedAt: new Date(),
    approvedAt: null,
  });

  const request = new ProofRequest({
    id: proofRequestId,
    appId: "app-1",
    proofType: opts.proofType,
    status: ProofRequestStatus.PENDING_USER,
    result: null,
    externalRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    validatedAt: null,
  });

  const proofRequestResult: ProofRequestWithApp = {
    request,
    app: { id: "app-1", name: "Test App", environment: "dev", companyId: "company-1" },
  };

  return { vp, session, proofRequestResult, holderDid, sessionToken, proofRequestId };
}

function makeUseCase(
  sessionRepo: FakeSessionRepo,
  requestRepo: FakeRequestRepo,
  webhook: FakeDeliverWebhookUseCase
) {
  return new VerifyPresentationUseCase(
    sessionRepo,
    requestRepo,
    new FakeApiKeyHasher(),
    new FakeBlockchainClient(),
    ISSUER_PRIVATE_KEY_HEX,
    webhook as unknown as DeliverWebhookUseCase
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("Story 5.8 (dynamic) AC#2 — age_over_18 request + ageOver18:false VC → rejected", async () => {
  const fx = await buildFixture({
    proofType: "age_over_18",
    claims: { personhood: true, ageOver18: false },
  });
  const sessionRepo = new FakeSessionRepo(fx.session);
  const requestRepo = new FakeRequestRepo(fx.proofRequestResult);
  const webhook = new FakeDeliverWebhookUseCase();
  const usecase = makeUseCase(sessionRepo, requestRepo, webhook);

  const result = await usecase.execute({
    vp: fx.vp,
    sessionToken: fx.sessionToken,
    holderDid: fx.holderDid,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(requestRepo.statusUpdates, [
    { id: fx.proofRequestId, status: ProofRequestStatus.REJECTED },
  ]);
  assert.equal(webhook.calls.length, 1);
  assert.equal(webhook.calls[0].proofType, "age_over_18");
  assert.equal(webhook.calls[0].status, ProofRequestStatus.REJECTED);
});

test("Story 5.8 (dynamic) AC#3 — age_over_18 request + VC missing ageOver18 key → rejected", async () => {
  const fx = await buildFixture({
    proofType: "age_over_18",
    claims: { personhood: true },
  });
  const sessionRepo = new FakeSessionRepo(fx.session);
  const requestRepo = new FakeRequestRepo(fx.proofRequestResult);
  const webhook = new FakeDeliverWebhookUseCase();
  const usecase = makeUseCase(sessionRepo, requestRepo, webhook);

  const result = await usecase.execute({
    vp: fx.vp,
    sessionToken: fx.sessionToken,
    holderDid: fx.holderDid,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(requestRepo.statusUpdates, [
    { id: fx.proofRequestId, status: ProofRequestStatus.REJECTED },
  ]);
});

test("Story 5.8 (dynamic) AC#4 — personhood request + VC{personhood:true, ageOver18:false} → approved (unrequested claim irrelevant)", async () => {
  const fx = await buildFixture({
    proofType: "personhood",
    claims: { personhood: true, ageOver18: false },
  });
  const sessionRepo = new FakeSessionRepo(fx.session);
  const requestRepo = new FakeRequestRepo(fx.proofRequestResult);
  const webhook = new FakeDeliverWebhookUseCase();
  const usecase = makeUseCase(sessionRepo, requestRepo, webhook);

  const result = await usecase.execute({
    vp: fx.vp,
    sessionToken: fx.sessionToken,
    holderDid: fx.holderDid,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(requestRepo.statusUpdates, [
    { id: fx.proofRequestId, status: ProofRequestStatus.APPROVED },
  ]);
  assert.equal(webhook.calls.length, 1);
  assert.equal(webhook.calls[0].proofType, "personhood");
  assert.equal(webhook.calls[0].status, ProofRequestStatus.APPROVED);
});

test("Story 5.8 (dynamic) positive control — age_over_18 request + ageOver18:true VC → approved", async () => {
  const fx = await buildFixture({
    proofType: "age_over_18",
    claims: { personhood: true, ageOver18: true },
  });
  const sessionRepo = new FakeSessionRepo(fx.session);
  const requestRepo = new FakeRequestRepo(fx.proofRequestResult);
  const webhook = new FakeDeliverWebhookUseCase();
  const usecase = makeUseCase(sessionRepo, requestRepo, webhook);

  const result = await usecase.execute({
    vp: fx.vp,
    sessionToken: fx.sessionToken,
    holderDid: fx.holderDid,
  });

  assert.equal(result.valid, true);
  assert.equal(webhook.calls[0].proofType, "age_over_18");
});

test("Story 5.8 (dynamic) AC#5 — non-boolean claim value still rejects (original Rule 5 preserved)", async () => {
  const fx = await buildFixture({
    proofType: "personhood",
    // @ts-expect-error deliberately non-boolean to exercise the pre-existing Rule 5 guard
    claims: { personhood: "true", ageOver18: false },
  });
  const sessionRepo = new FakeSessionRepo(fx.session);
  const requestRepo = new FakeRequestRepo(fx.proofRequestResult);
  const webhook = new FakeDeliverWebhookUseCase();
  const usecase = makeUseCase(sessionRepo, requestRepo, webhook);

  const result = await usecase.execute({
    vp: fx.vp,
    sessionToken: fx.sessionToken,
    holderDid: fx.holderDid,
  });

  assert.equal(result.valid, false);
});

test("Story 5.8 (dynamic) Task 1 — findById returns null → { valid: false } without status update or webhook", async () => {
  const fx = await buildFixture({
    proofType: "personhood",
    claims: { personhood: true, ageOver18: false },
  });
  const sessionRepo = new FakeSessionRepo(fx.session);
  const requestRepo = new FakeRequestRepo(null); // simulates broken referential integrity
  const webhook = new FakeDeliverWebhookUseCase();
  const usecase = makeUseCase(sessionRepo, requestRepo, webhook);

  const result = await usecase.execute({
    vp: fx.vp,
    sessionToken: fx.sessionToken,
    holderDid: fx.holderDid,
  });

  assert.equal(result.valid, false);
  assert.equal(requestRepo.statusUpdates.length, 0);
  assert.equal(webhook.calls.length, 0);
});
