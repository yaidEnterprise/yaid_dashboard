import {
  VerifyPresentationSchema,
  VerifyPresentationOutputDTO,
} from "./verify_presentation_viewmodel";
import { VerifyPresentationUseCase } from "./verify_presentation_usecase";

export class VerifyPresentationController {
  constructor(private readonly useCase: VerifyPresentationUseCase) {}

  async handle(input: {
    body: unknown;
    holderDid: string;
  }): Promise<VerifyPresentationOutputDTO> {
    const parsed = VerifyPresentationSchema.parse(input.body);
    return this.useCase.execute({
      vp: parsed.vp,
      sessionToken: parsed.sessionToken,
      holderDid: input.holderDid,
    });
  }
}
