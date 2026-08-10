import { IssueCredentialUseCase } from "./issue_credential_usecase";
import { IssueCredentialSchema } from "./issue_credential_viewmodel";

export class IssueCredentialController {
  constructor(private readonly useCase: IssueCredentialUseCase) { }

  async handle(input: {
    body: unknown;
    holderDid: string;
  }): Promise<string> {
    const parsed = IssueCredentialSchema.parse(input.body);
    return this.useCase.execute({
      holderDid: input.holderDid,
      documentImage: parsed.documentImage,
      bodySignature: parsed.bodySignature,
    });
  }
}
