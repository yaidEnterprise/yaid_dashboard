import { GetWebhookPublicKeyUseCase } from "./get_webhook_public_key_usecase";
import { GetWebhookPublicKeyOutputDTO } from "./get_webhook_public_key_viewmodel";

export class GetWebhookPublicKeyController {
  constructor(private readonly useCase: GetWebhookPublicKeyUseCase) {}

  async handle(): Promise<GetWebhookPublicKeyOutputDTO> {
    return this.useCase.execute();
  }
}
