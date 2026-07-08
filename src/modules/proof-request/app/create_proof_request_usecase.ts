import { randomBytes, randomUUID } from "node:crypto";
import { env } from "@/shared/environments";
import { UnauthorizedError, UnprocessableEntityError } from "@/shared/errors/AppError";
import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";
import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofSession } from "@/shared/domain/entities/ProofSession";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { CreatedProofRequestOutputDTO, CreateProofRequestDTO } from "./create_proof_request_viewmodel";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

function parseApiKey(apiKey: string) {
  const [appId, secret] = apiKey.split(".");
  if (!appId || !secret || !UUID_REGEX.test(appId)) {
    throw new UnauthorizedError("Invalid API key");
  }
  return { appId, secret };
}

export class CreateProofRequestUseCase {
  constructor(
    private readonly appRepo: CompanyAppRepository,
    private readonly requestRepo: ProofRequestRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: {
    apiKey: string;
    body: CreateProofRequestDTO;
  }): Promise<CreatedProofRequestOutputDTO> {
    const { appId, secret } = parseApiKey(input.apiKey);

    const app = await this.appRepo.findById(appId);
    if (!app) throw new UnauthorizedError("Invalid API key");

    // Verify secret BEFORE checking status to prevent app enumeration
    const validSecret = await this.hasher.verify(`${appId}.${secret}`, app.apiKeyHash);
    if (!validSecret) throw new UnauthorizedError("Invalid API key");

    // Check status only after successful authentication
    if (app.status !== CompanyAppStatus.ENABLED) {
      throw new UnprocessableEntityError("App is disabled");
    }

    const request = new ProofRequest({
      id: randomUUID(),
      appId: app.id,
      proofType: input.body.proofType,
      status: ProofRequestStatus.PENDING_USER,
      result: null,
      externalRef: input.body.externalReference?.trim() || null,
      createdAt: new Date(),
      validatedAt: null,
    });

    const token = generateSessionToken();
    const tokenHash = await this.hasher.hash(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const verificationUrl = `${env.YAID_VERIFICATION_BASE_URL}/${token}`;
    const deepLinkUrl = `yaid://verify?session=${token}`;

    const session = new ProofSession({
      id: randomUUID(),
      proofRequestId: request.id,
      hashSessionToken: tokenHash,
      challengeNonceHash: null,
      challengeCreatedAt: null,
      status: ProofSessionStatus.WAITING_USER,
      createdAt: new Date(),
      expiresAt,
      openedAt: null,
      approvedAt: null,
    });

    // Atomic creation: proof_request + proof_session together
    await this.requestRepo.createAtomic(request, session);

    return {
      id: request.id,
      appId: app.id,
      appName: app.name,
      environment: app.environment,
      proofType: request.proofType,
      status: request.status,
      result: request.result,
      externalReference: request.externalRef,
      createdAt: request.createdAt.toISOString(),
      validatedAt: null,
      session: {
        id: session.id,
        verificationUrl,
        deepLinkUrl,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}
