export interface WebhookSignResult {
  signature: string;
  timestamp: number;
}

export interface WebhookSigner {
  sign(payload: string): Promise<WebhookSignResult>;
}
