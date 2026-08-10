import { Environments } from "@/shared/environments";
import { RevokeCredentialUseCase } from "./revoke_credential_usecase";
import { RevokeCredentialController } from "./revoke_credential_controller";

export async function makeRevokeCredentialController() {
  const envs = Environments.getEnvs();
  return new RevokeCredentialController(
    new RevokeCredentialUseCase(await envs.getBlockchainClient())
  );
}
