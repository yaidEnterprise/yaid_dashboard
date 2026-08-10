export interface BlockchainClient {
  registerDID(did: string): Promise<void>;
  revokeVC(vcId: string): Promise<void>;
  isDIDRegistered(did: string): Promise<boolean>;
  isVCRevoked(vcId: string): Promise<boolean>;
}
