import { ethers } from "ethers";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import { YAID_REGISTRY_ABI } from "./abi";

/**
 * Implementação concreta de BlockchainClient usando ethers.js v6.
 *
 * Mapeamento interface → contrato YaidRegistry:
 *  - registerDID(did)     → contract.registerDID(keccak256(did))
 *  - revokeVC(vcId)       → contract.revokeCredential(keccak256(vcId))
 *  - isDIDRegistered(did) → contract.activeDIDs(keccak256(did))
 *  - isVCRevoked(vcId)    → contract.revokedCredentials(keccak256(vcId))
 *
 * O contrato armazena apenas hashes (bytes32). A conversão string → bytes32
 * via ethers.id() (keccak256) é feita nesta camada — os use cases passam strings.
 *
 * - Escritas (registerDID, revokeVC): usam Wallet com private key → pagam gas.
 * - Leituras (isDIDRegistered, isVCRevoked): usam JsonRpcProvider → sem gas.
 * - Erros da chain são propagados sem captura — o use case é responsável por tratá-los.
 * - Instanciado exclusivamente via Environments.getBlockchainClient().
 */
export class EthersBlockchainClient implements BlockchainClient {
  private readonly writeContract: ethers.Contract;
  private readonly readContract: ethers.Contract;

  constructor(
    contractAddress: string,
    walletPrivateKey: string,
    rpcUrl: string
  ) {
    // [Review patch] Valida o endereço do contrato em tempo de construção
    // para gerar erro acionável no boot, não em tempo de requisição.
    if (!ethers.isAddress(contractAddress)) {
      throw new Error(
        `EthersBlockchainClient: endereço de contrato inválido: "${contractAddress}"`
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    // Contrato de escrita — usa wallet (paga gas)
    this.writeContract = new ethers.Contract(
      contractAddress,
      YAID_REGISTRY_ABI,
      wallet
    );
    // Contrato de leitura — usa provider (sem gas)
    this.readContract = new ethers.Contract(
      contractAddress,
      YAID_REGISTRY_ABI,
      provider
    );
  }

  async registerDID(did: string): Promise<void> {
    // Contrato espera bytes32: converte DID string → keccak256
    const didHash = ethers.id(did);
    const tx = await this.writeContract.registerDID(didHash);
    // [Review patch] Verifica receipt: null = tx dropped do mempool, status=0 = EVM revert.
    // Ambos são falhas — propagar como exceção para o use case tratar.
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) {
      throw new Error(
        `registerDID: transação falhou on-chain (did=${did}, receipt=${JSON.stringify(receipt)})`
      );
    }
  }

  async revokeVC(vcId: string): Promise<void> {
    // Contrato usa revokeCredential(bytes32 credentialId): converte vcId → keccak256
    const credentialId = ethers.id(vcId);
    const tx = await this.writeContract.revokeCredential(credentialId);
    // [Review patch] Verifica receipt: null = tx dropped, status=0 = EVM revert.
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) {
      throw new Error(
        `revokeVC: transação falhou on-chain (vcId=${vcId}, receipt=${JSON.stringify(receipt)})`
      );
    }
  }

  async isDIDRegistered(did: string): Promise<boolean> {
    // Contrato expõe o mapping activeDIDs(bytes32) → bool
    const didHash = ethers.id(did);
    return await this.readContract.activeDIDs(didHash);
  }

  async isVCRevoked(vcId: string): Promise<boolean> {
    // Contrato expõe o mapping revokedCredentials(bytes32) → bool
    const credentialId = ethers.id(vcId);
    return await this.readContract.revokedCredentials(credentialId);
  }
}
