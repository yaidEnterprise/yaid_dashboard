/**
 * ABI mínima do contrato YaidRegistry (YaidRegistry.sol).
 *
 * Funções expostas pelo contrato:
 *  - registerDID(bytes32 didHash)   — escrita; recebe keccak256 do DID string
 *  - revokeCredential(bytes32 credentialId) — escrita; recebe keccak256 do vcId
 *  - activeDIDs(bytes32) view returns (bool)       — leitura do mapping de DIDs ativos
 *  - revokedCredentials(bytes32) view returns (bool) — leitura do mapping de credenciais revogadas
 *
 * Nota: o contrato armazena hashes (bytes32), nunca strings.
 * A conversão string → bytes32 via ethers.id() (keccak256) é feita no EthersBlockchainClient.
 */
export const YAID_REGISTRY_ABI = [
  "function registerDID(bytes32 didHash) external",
  "function revokeCredential(bytes32 credentialId) external",
  "function activeDIDs(bytes32) external view returns (bool)",
  "function revokedCredentials(bytes32) external view returns (bool)",
] as const;
