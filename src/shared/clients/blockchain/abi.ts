/**
 * ABI mínima do contrato YaIDRegistry.
 *
 * Expõe apenas os 4 métodos necessários para o BlockchainClient:
 *  - registerDID  — escrita (usa wallet, paga gas)
 *  - revokeVC     — escrita (usa wallet, paga gas; vcHash = keccak256 do vcId)
 *  - isDIDRegistered — leitura (view, sem gas)
 *  - isVCRevoked     — leitura (view, sem gas)
 */
export const YAID_REGISTRY_ABI = [
  "function registerDID(string did) external",
  "function revokeVC(bytes32 vcHash) external",
  "function isDIDRegistered(string did) external view returns (bool)",
  "function isVCRevoked(bytes32 vcHash) external view returns (bool)",
] as const;
