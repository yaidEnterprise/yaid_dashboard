import { ethers } from "ethers";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import { YAID_REGISTRY_ABI } from "./abi";

/**
 * Implementação concreta de BlockchainClient usando ethers.js v6.
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
    const tx = await this.writeContract.registerDID(did);
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
    // Converte vcId para bytes32 via keccak256, conforme esperado pelo contrato
    const vcHash = ethers.id(vcId);
    const tx = await this.writeContract.revokeVC(vcHash);
    // [Review patch] Verifica receipt: null = tx dropped, status=0 = EVM revert.
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) {
      throw new Error(
        `revokeVC: transação falhou on-chain (vcId=${vcId}, receipt=${JSON.stringify(receipt)})`
      );
    }
  }

  async isDIDRegistered(did: string): Promise<boolean> {
    return await this.readContract.isDIDRegistered(did);
  }

  async isVCRevoked(vcId: string): Promise<boolean> {
    const vcHash = ethers.id(vcId);
    return await this.readContract.isVCRevoked(vcHash);
  }
}
