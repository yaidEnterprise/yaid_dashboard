import * as ed from "@noble/ed25519";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { VerifyPresentationUseCase } from "@/modules/presentation/app/verify_presentation_usecase";
import type {
  DeliverWebhookInput,
  DeliverWebhookUseCase,
} from "@/modules/webhook/app/deliver_webhook_usecase";
import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofSession } from "@/shared/domain/entities/ProofSession";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import type { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import type {
  ProofRequestRepository,
  ProofRequestWithApp,
} from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import type {
  ProofSessionRepository,
  ProofSessionWithContext,
} from "@/shared/domain/interfaces/repositories/ProofSessionRepository";

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from({ length: hex.length / 2 }, (_, index) =>
    parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value)
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
const OTHER_PRIVATE_KEY_HEX = "33".repeat(32);

class FakeApiKeyHasher implements ApiKeyHasher {
  async hash(secret: string): Promise<string> {
    return `hashed:${secret}`;
  }

  async verify(): Promise<boolean> {
    return true;
  }
}

class FakeSessionRepo implements ProofSessionRepository {
  readonly updated: ProofSession[] = [];

  constructor(private readonly session: ProofSession) {}

  async create(): Promise<void> {}

  async findByTokenHash(hash: string): Promise<ProofSession | null> {
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
  readonly statusUpdates: { id: string; status: ProofRequestStatus }[] = [];

  constructor(private readonly result: ProofRequestWithApp) {}

  async create(): Promise<void> {}

  async createAtomic(): Promise<void> {}

  async findById(id: string): Promise<ProofRequestWithApp | null> {
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
  readonly registeredDids: string[] = [];
  readonly revokedCredentialIds: string[] = [];

  constructor(
    private readonly didRegistered = true,
    private readonly vcRevoked = false,
    private readonly fail = false
  ) {}

  async registerDID(): Promise<void> {}

  async revokeVC(): Promise<void> {}

  async isDIDRegistered(did: string): Promise<boolean> {
    this.registeredDids.push(did);
    if (this.fail) throw new Error("blockchain unavailable");
    return this.didRegistered;
  }

  async isVCRevoked(vcId: string): Promise<boolean> {
    this.revokedCredentialIds.push(vcId);
    if (this.fail) throw new Error("blockchain unavailable");
    return this.vcRevoked;
  }
}

class FakeDeliverWebhookUseCase
  implements Pick<DeliverWebhookUseCase, "execute">
{
  readonly calls: DeliverWebhookInput[] = [];

  async execute(input: DeliverWebhookInput): Promise<void> {
    this.calls.push(input);
  }
}

interface FixtureOptions {
  blockchainError?: boolean;
  challengeCreatedAt?: Date;
  credential?: unknown;
  credentials?: unknown[];
  didRegistered?: boolean;
  header?: Record<string, unknown>;
  headerSegment?: string;
  invalidVpSignature?: boolean;
  payload?: Record<string, unknown>;
  payloadSegment?: string;
  sessionStatus?: ProofSessionStatus;
  signatureSegment?: string;
  signatureKeyHex?: string;
  storedChallengeHash?: string;
  vcRevoked?: boolean;
}

async function buildFixture(options: FixtureOptions = {}) {
  const holderPrivateKey = hexToBytes(HOLDER_PRIVATE_KEY_HEX);
  const holderPublicKey = await ed.getPublicKeyAsync(holderPrivateKey);
  const holderDid = `did:yaid:user:${bytesToHex(holderPublicKey)}`;

  const issuerPrivateKey = hexToBytes(ISSUER_PRIVATE_KEY_HEX);
  const issuerPublicKey = await ed.getPublicKeyAsync(issuerPrivateKey);
  const issuerDid = `did:yaid:issuer:${bytesToHex(issuerPublicKey)}`;
  const now = Math.floor(Date.now() / 1000);

  const header = options.header ?? {
    alg: "EdDSA",
    typ: "JWT",
    kid: `${issuerDid}#key-1`,
  };
  const payload = options.payload ?? {
    iss: issuerDid,
    sub: holderDid,
    jti: "urn:yaid:vc:story-9-2",
    iat: now,
    nbf: now,
    vc: { personhood: true, ageOver18: false },
  };

  const headerSegment = options.headerSegment ?? base64url(JSON.stringify(header));
  const payloadSegment = options.payloadSegment ?? base64url(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = await ed.signAsync(
    new TextEncoder().encode(signingInput),
    hexToBytes(options.signatureKeyHex ?? ISSUER_PRIVATE_KEY_HEX)
  );
  const vcJwt = `${signingInput}.${options.signatureSegment ?? base64url(signature)}`;
  const credential = options.credential === undefined ? vcJwt : options.credential;

  const nonce = "story-9-2-nonce";
  const vpUnsigned = {
    holder: holderDid,
    challenge: nonce,
    verifiableCredential: options.credentials ?? [credential],
  };
  const vpSignature = await ed.signAsync(
    new TextEncoder().encode(JSON.stringify(vpUnsigned)),
    hexToBytes(options.invalidVpSignature ? OTHER_PRIVATE_KEY_HEX : HOLDER_PRIVATE_KEY_HEX)
  );
  const vp = {
    ...vpUnsigned,
    proof: {
      type: "Ed25519Signature2020",
      created: new Date().toISOString(),
      verificationMethod: `${holderDid}#key-1`,
      proofPurpose: "authentication",
      signatureValue: base64url(vpSignature),
    },
  };

  const sessionToken = "story-9-2-session-token";
  const requestId = "story-9-2-request";
  const session = new ProofSession({
    id: "story-9-2-session",
    proofRequestId: requestId,
    hashSessionToken: `hashed:${sessionToken}`,
    challengeNonceHash: options.storedChallengeHash ?? sha256hex(nonce),
    challengeCreatedAt: options.challengeCreatedAt ?? new Date(),
    status: options.sessionStatus ?? ProofSessionStatus.OPENED,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    openedAt: new Date(),
    approvedAt: null,
  });
  const request = new ProofRequest({
    id: requestId,
    appId: "story-9-2-app",
    proofType: "personhood",
    status: ProofRequestStatus.PENDING_USER,
    result: null,
    externalRef: null,
    createdAt: new Date(),
    validatedAt: null,
  });
  const requestWithApp: ProofRequestWithApp = {
    request,
    app: {
      id: "story-9-2-app",
      name: "Story 9.2 App",
      environment: "dev",
      companyId: "story-9-2-company",
    },
  };

  const sessionRepo = new FakeSessionRepo(session);
  const requestRepo = new FakeRequestRepo(requestWithApp);
  const blockchain = new FakeBlockchainClient(
    options.didRegistered,
    options.vcRevoked,
    options.blockchainError
  );
  const webhook = new FakeDeliverWebhookUseCase();
  const useCase = new VerifyPresentationUseCase(
    sessionRepo,
    requestRepo,
    new FakeApiKeyHasher(),
    blockchain,
    ISSUER_PRIVATE_KEY_HEX,
    webhook as unknown as DeliverWebhookUseCase
  );

  return {
    blockchain,
    holderDid,
    issuerDid,
    payload,
    requestId,
    requestRepo,
    session,
    sessionRepo,
    sessionToken,
    useCase,
    vp: vp as unknown as Record<string, unknown>,
    webhook,
  };
}

async function execute(options: FixtureOptions = {}) {
  const fixture = await buildFixture(options);
  const result = await fixture.useCase.execute({
    vp: fixture.vp,
    sessionToken: fixture.sessionToken,
    holderDid: fixture.holderDid,
  });
  return { ...fixture, result };
}

function assertRejected(
  fixture: Awaited<ReturnType<typeof execute>>
): void {
  assert.deepEqual(fixture.result, { valid: false });
  assert.deepEqual(fixture.requestRepo.statusUpdates, [
    { id: fixture.requestId, status: ProofRequestStatus.REJECTED },
  ]);
  assert.equal(fixture.webhook.calls.length, 1);
  assert.equal(fixture.webhook.calls[0].status, ProofRequestStatus.REJECTED);
  assert.equal(fixture.webhook.calls[0].proofType, "personhood");
}

test("Story 9.2 approves a valid VC-JWT and checks revocation by jti", async () => {
  const fixture = await execute();

  assert.deepEqual(fixture.result, { valid: true });
  assert.equal(fixture.session.status, ProofSessionStatus.APPROVED_BY_USER);
  assert.deepEqual(fixture.sessionRepo.updated, [fixture.session]);
  assert.deepEqual(fixture.requestRepo.statusUpdates, [
    { id: fixture.requestId, status: ProofRequestStatus.APPROVED },
  ]);
  assert.deepEqual(fixture.blockchain.registeredDids, [fixture.holderDid]);
  assert.deepEqual(fixture.blockchain.revokedCredentialIds, [fixture.payload.jti]);
  assert.equal(fixture.webhook.calls[0].status, ProofRequestStatus.APPROVED);
  assert.equal(fixture.webhook.calls[0].proofType, "personhood");
});

test("Story 9.2 verifies the exact encoded segments without reserializing JSON", async () => {
  const baseline = await buildFixture();
  const now = Math.floor(Date.now() / 1000);
  const headerJson = `{
    "kid": "${baseline.issuerDid}#key-1",
    "typ": "JWT",
    "alg": "EdDSA"
  }`;
  const payloadJson = `{
    "vc": { "ageOver18": false, "personhood": true },
    "nbf": ${now},
    "iat": ${now},
    "jti": "urn:yaid:vc:non-canonical-json",
    "sub": "${baseline.holderDid}",
    "iss": "${baseline.issuerDid}"
  }`;

  const fixture = await execute({
    headerSegment: base64url(headerJson),
    payloadSegment: base64url(payloadJson),
  });

  assert.deepEqual(fixture.result, { valid: true });
  assert.deepEqual(fixture.blockchain.revokedCredentialIds, [
    "urn:yaid:vc:non-canonical-json",
  ]);
});

test("Story 9.2 rejects the legacy JSON-LD credential object", async () => {
  const fixture = await execute({
    credential: {
      id: "legacy-vc",
      holder: "did:yaid:user:legacy",
      claims: { personhood: true },
      proof: { signatureValue: "legacy" },
    },
  });

  assertRejected(fixture);
});

for (const [name, credential] of [
  ["one segment", "not-a-jwt"],
  ["empty segment", "e30..AA"],
  ["invalid base64url", "@@.e30.AA"],
  ["invalid JSON", `${base64url("{")}.${base64url("{}")}.AA`],
] as const) {
  test(`Story 9.2 rejects malformed compact JWS: ${name}`, async () => {
    const fixture = await execute({ credential });
    assertRejected(fixture);
  });
}

test("Story 9.2 rejects a compact JWS with a non-64-byte signature", async () => {
  const fixture = await execute({ signatureSegment: "AA" });
  assertRejected(fixture);
});

test("Story 9.2 rejects a null credential", async () => {
  const fixture = await execute({ credential: null });
  assertRejected(fixture);
});

test("Story 9.2 rejects a VC-JWT signed by another issuer key", async () => {
  const fixture = await execute({ signatureKeyHex: OTHER_PRIVATE_KEY_HEX });
  assertRejected(fixture);
});

for (const [name, credentials] of [
  ["zero credentials", []],
  ["two credentials", ["first", "second"]],
] as const) {
  test(`Story 9.2 rejects a VP with ${name}`, async () => {
    const fixture = await execute({ credentials: [...credentials] });
    assertRejected(fixture);
  });
}

for (const [name, header] of [
  ["alg none", { alg: "none", typ: "JWT" }],
  ["wrong typ", { alg: "EdDSA", typ: "vc+jwt" }],
  ["wrong kid", { alg: "EdDSA", typ: "JWT", kid: "did:yaid:issuer:other#key-1" }],
  ["critical JOSE parameter", { alg: "EdDSA", typ: "JWT", crit: ["b64"] }],
  ["unencoded payload flag", { alg: "EdDSA", typ: "JWT", b64: false }],
] as const) {
  test(`Story 9.2 rejects a signed token with ${name}`, async () => {
    const fixture = await buildFixture();
    const rejected = await execute({
      header: { kid: `${fixture.issuerDid}#key-1`, ...header },
    });
    assertRejected(rejected);
  });
}

test("Story 9.2 rejects a signed token whose iss is not the configured issuer", async () => {
  const fixture = await buildFixture();
  const rejected = await execute({
    payload: { ...fixture.payload, iss: "did:yaid:issuer:other" },
  });
  assertRejected(rejected);
});

test("Story 9.2 rejects a signed token whose sub differs from the authenticated holder", async () => {
  const fixture = await buildFixture();
  const rejected = await execute({
    payload: { ...fixture.payload, sub: "did:yaid:user:other" },
  });
  assertRejected(rejected);
});

for (const [name, mutate] of [
  ["empty sub", (payload: Record<string, unknown>) => ({ ...payload, sub: "" })],
  ["empty jti", (payload: Record<string, unknown>) => ({ ...payload, jti: "" })],
  ["fractional iat", (payload: Record<string, unknown>) => ({ ...payload, iat: 1.5 })],
  ["string nbf", (payload: Record<string, unknown>) => ({ ...payload, nbf: "0" })],
  ["null vc", (payload: Record<string, unknown>) => ({ ...payload, vc: null })],
  ["array vc", (payload: Record<string, unknown>) => ({ ...payload, vc: [] })],
  [
    "non-boolean claim",
    (payload: Record<string, unknown>) => ({
      ...payload,
      vc: { personhood: "true" },
    }),
  ],
  [
    "missing requested claim",
    (payload: Record<string, unknown>) => ({
      ...payload,
      vc: { ageOver18: true },
    }),
  ],
  [
    "false requested claim",
    (payload: Record<string, unknown>) => ({
      ...payload,
      vc: { personhood: false },
    }),
  ],
] as const) {
  test(`Story 9.2 rejects invalid JWT payload: ${name}`, async () => {
    const fixture = await buildFixture();
    const rejected = await execute({ payload: mutate(fixture.payload) });
    assertRejected(rejected);
  });
}

for (const [name, options] of [
  ["invalid VP holder signature", { invalidVpSignature: true }],
  ["nonce mismatch", { storedChallengeHash: sha256hex("another-nonce") }],
  [
    "expired challenge",
    { challengeCreatedAt: new Date(Date.now() - 11 * 60 * 1000) },
  ],
  ["non-open session", { sessionStatus: ProofSessionStatus.APPROVED_BY_USER }],
  ["unregistered holder DID", { didRegistered: false }],
  ["revoked VC", { vcRevoked: true }],
  ["blockchain client error", { blockchainError: true }],
] as const) {
  test(`Story 9.2 preserves rejection for ${name}`, async () => {
    const fixture = await execute(options);
    assertRejected(fixture);
  });
}
