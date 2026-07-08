import { Environments } from "@/shared/environments";
import { IssueCredentialUseCase } from "./issue_credential_usecase";
import { IssueCredentialController } from "./issue_credential_controller";

export async function makeIssueCredentialController(): Promise<IssueCredentialController> {
  const envs = Environments.getEnvs();
  const blockchainClient = await envs.getBlockchainClient();
  const ocrProvider = await envs.getOcrProvider();
  const issuerPrivateKey = envs.ISSUER_PRIVATE_KEY;

  return new IssueCredentialController(
    new IssueCredentialUseCase(blockchainClient, ocrProvider, issuerPrivateKey)
  );
}
