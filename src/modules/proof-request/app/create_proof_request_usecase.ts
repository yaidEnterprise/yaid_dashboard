import { randomBytes, randomUUID } from "node:crypto";
import { env } from "@/shared/environments";
import { UnauthorizedError } from "@/shared/errors/AppError";
import { CompanyAppRepository } from "@/shared/domain/interfaces/repositories/CompanyAppRepository";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";
import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";
import { ProofRequest } from "@/shared/domain/entities/ProofRequest";
import { ProofSession } from "@/shared/domain/entities/ProofSession";
import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";
import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";
import { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";
import { ProofSessionRepository } from "@/shared/domain/interfaces/repositories/ProofSessionRepository";
import { CreatedProofRequestOutputDTO, CreateProofRequestDTO } from "./create_proof_request_viewmodel";

function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

function parseApiKey(apiKey: string) {
  const [appId, secret] = apiKey.split(".");
  if (!appId || !secret) throw new UnauthorizedError("Invalid API key");
  return { appId, secret };
}

export class CreateProofRequestUseCase {
  constructor(
    private readonly appRepo: CompanyAppRepository,
    private readonly requestRepo: ProofRequestRepository,
    private readonly sessionRepo: ProofSessionRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: {
    apiKey: string;
    body: CreateProofRequestDTO;
  }): Promise<CreatedProofRequestOutputDTO> {
    const { appId, secret } = parseApiKey(input.apiKey);
    const app = await this.appRepo.findById(appId);

    if (!app || app.status !== CompanyAppStatus.ENABLED) {
      throw new UnauthorizedError("Invalid API key");
    }

    const validSecret = await this.hasher.verify(secret, app.apiKeyHash);
    if (!validSecret) throw new UnauthorizedError("Invalid API key");

    const request = new ProofRequest({
      id: randomUUID(),
      appId: app.id,
      proofType: input.body.proofType,
      status: ProofRequestStatus.PENDING_USER,
      result: null,
      externalRef: input.body.externalRef?.trim() || null,
      createdAt: new Date(),
      validatedAt: null,
    });

    const token = generateSessionToken();
    const tokenHash = await this.hasher.hash(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const verificationPageUrl = `${env.YAID_VERIFICATION_BASE_URL}/${token}`;
    const deepLinkUrl = `yaid://verify?session=${token}`;

    const session = new ProofSession({
      id: randomUUID(),
      proofRequestId: request.id,
      hashSessionToken: tokenHash,
      verificationPageUrl,
      deepLinkUrl,
      status: ProofSessionStatus.WAITING_USER,
      createdAt: new Date(),
      expiresAt,
      openedAt: null,
      approvedAt: null,
    });

    await this.requestRepo.create(request);
    await this.sessionRepo.create(session);

    return {
      id: request.id,
      appId: app.id,
      appName: app.name,
      environment: app.environment,
      proofType: request.proofType,
      status: request.status,
      result: request.result,
      externalRef: request.externalRef,
      createdAt: request.createdAt.toISOString(),
      validatedAt: null,
      session: {
        id: session.id,
        verificationPageUrl,
        deepLinkUrl,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}
