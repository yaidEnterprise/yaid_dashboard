import { IssueCredentialUseCase, VerifiableCredential } from "./issue_credential_usecase";
import { IssueCredentialSchema } from "./issue_credential_viewmodel";

export class IssueCredentialController {
  constructor(private readonly useCase: IssueCredentialUseCase) { }

  async handle(input: {
    body: unknown;
    holderDid: string;
  }): Promise<VerifiableCredential> {
    const parsed = IssueCredentialSchema.parse(input.body);
    return this.useCase.execute({
      holderDid: input.holderDid,
      documentImage: parsed.documentImage,
      proofType: parsed.proofType,
      bodySignature: parsed.bodySignature,
    });
  }
}
