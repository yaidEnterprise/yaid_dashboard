import type { WebhookSigner } from "@/shared/domain/interfaces/WebhookSigner";
import type { ProofRequestRepository } from "@/shared/domain/interfaces/repositories/ProofRequestRepository";

export interface DeliverWebhookInput {
  proofRequestId: string;
  status: string;
  proofType: string;
  externalReference?: string | null;
  updatedAt: string;
}

const WEBHOOK_TIMEOUT_MS = 10_000;

export class DeliverWebhookUseCase {
  constructor(
    private readonly requestRepo: ProofRequestRepository,
    private readonly signer: WebhookSigner
  ) {}

  /**
   * Delivers a webhook notification to the company's configured webhook URL.
   * This method never throws — all errors are logged and swallowed.
   */
  async execute(input: DeliverWebhookInput): Promise<void> {
    try {
      // Look up the proof request to get the associated app's webhook URL
      const result = await this.requestRepo.findById(input.proofRequestId);
      if (!result) {
        console.warn(
          `[webhook] proof request not found: ${input.proofRequestId}`
        );
        return;
      }

      const { app } = result;

      // Check if the app has a webhook URL configured
      // The app object from ProofRequestWithApp has basic app info
      const webhookUrl = await this.resolveWebhookUrl(app.id);
      if (!webhookUrl) {
        return;
      }

      // Build the webhook body — never contains VC, VP, DID, nonce, or PII
      const body: Record<string, unknown> = {
        proofRequestId: input.proofRequestId,
        status: input.status,
        proofType: input.proofType,
        updatedAt: input.updatedAt,
      };

      if (input.externalReference) {
        body.externalReference = input.externalReference;
      }

      const bodyJson = JSON.stringify(body);

      // Sign the raw JSON payload
      const { signature, timestamp } = await this.signer.sign(bodyJson);

      // Send the webhook
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        WEBHOOK_TIMEOUT_MS
      );

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-YaID-Signature": signature,
            "X-YaID-Timestamp": String(timestamp),
          },
          body: bodyJson,
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error(
            `[webhook] delivery failed: proofRequestId=${input.proofRequestId} webhookUrl=${webhookUrl} status=${response.status} statusText=${response.statusText}`
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[webhook] delivery error: proofRequestId=${input.proofRequestId} error=${message}`
      );
    }
  }

  /**
   * Resolves the webhook URL for an app. Returns empty string if not configured.
   * Uses a separate query to get the full CompanyApp with webhookUrl.
   */
  private webhookUrlCache = new Map<string, string>();

  private async resolveWebhookUrl(appId: string): Promise<string> {
    if (this.webhookUrlCache.has(appId)) {
      return this.webhookUrlCache.get(appId)!;
    }

    // We need to dynamically import the CompanyAppRepository to get the webhook URL
    // The ProofRequestWithApp only includes basic app info (id, name, environment, companyId)
    // but not webhookUrl — so we need the full CompanyApp entity
    try {
      const { Environments } = await import("@/shared/environments");
      const envs = Environments.getEnvs();
      const appRepo = await envs.getCompanyAppRepository();
      const app = await appRepo.findById(appId);
      const url = app?.webhookUrl?.trim() || "";
      this.webhookUrlCache.set(appId, url);
      return url;
    } catch {
      return "";
    }
  }
}
