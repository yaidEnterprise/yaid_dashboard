import { RevokeCredentialUseCase } from "./revoke_credential_usecase";
import { RevokeCredentialSchema } from "./revoke_credential_viewmodel";

export class RevokeCredentialController {
  constructor(private readonly useCase: RevokeCredentialUseCase) {}

  async handle(input: { body: unknown; holderDid: string }) {
    const parsed = RevokeCredentialSchema.parse(input.body);
    return this.useCase.execute({
      holderDid: input.holderDid,
      vcId: parsed.vcId,
      bodySignature: parsed.bodySignature,
    });
  }
}
