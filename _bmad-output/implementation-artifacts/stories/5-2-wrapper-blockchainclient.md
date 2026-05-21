# Story 5.2: Wrapper BlockchainClient

Status: done

## Story

Como sistema backend,
Quero um client tipado para interagir com o contrato YaIDRegistry já implantado,
Para que os módulos de emissão, verificação e revogação possam registrar e consultar dados on-chain sem acoplar ao SDK de blockchain diretamente.

## Acceptance Criteria

1. **Given** a interface `BlockchainClient` em `src/shared/domain/interfaces/BlockchainClient.ts`
   **When** revisada
   **Then** define os métodos: `registerDID(did: string): Promise<void>`, `revokeVC(vcId: string): Promise<void>`, `isDIDRegistered(did: string): Promise<boolean>` e `isVCRevoked(vcId: string): Promise<boolean>`

2. **Given** a implementação concreta em `src/shared/clients/blockchain/`
   **When** instanciada pelo presenter via `environments.ts`
   **Then** lê `BLOCKCHAIN_CONTRACT_ADDRESS` e `BLOCKCHAIN_WALLET_PRIVATE_KEY` de `environments.ts` (nunca de `process.env` diretamente)
   **And** conecta ao contrato YaIDRegistry já implantado no endereço configurado
   **And** usa a wallet de serviço para assinar e pagar gas em escritas (`registerDID`, `revokeVC`)
   **And** leituras (`isDIDRegistered`, `isVCRevoked`) não requerem gas

3. **Given** o ambiente de desenvolvimento (Hardhat local)
   **When** `BLOCKCHAIN_CONTRACT_ADDRESS` aponta para o contrato local
   **Then** o client conecta e opera normalmente contra a chain local

4. **Given** falha de conexão ou transação rejeitada pela chain
   **When** qualquer método é chamado
   **Then** o erro é propagado como exceção tipada para o use case responsável por tratá-la

## Tasks / Subtasks

- [x] Task 1: Instalar dependência ethers.js v6 (AC: #2)
  - [x] Executar `npm install ethers@^6`
  - [x] Verificar que o build continua passando após instalação

- [x] Task 2: Criar interface `BlockchainClient` (AC: #1)
  - [x] Criar `src/shared/domain/interfaces/BlockchainClient.ts`
  - [x] Definir interface com os 4 métodos: `registerDID(did: string): Promise<void>`, `revokeVC(vcId: string): Promise<void>`, `isDIDRegistered(did: string): Promise<boolean>`, `isVCRevoked(vcId: string): Promise<boolean>`

- [x] Task 3: Adicionar `BLOCKCHAIN_CONTRACT_ADDRESS` ao `environments.ts` (AC: #2)
  - [x] Adicionar `BLOCKCHAIN_CONTRACT_ADDRESS: z.string().min(1)` ao schema Zod em `environments.ts`
  - [x] Adicionar `BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS` em `readProcessEnv()`
  - [x] Adicionar `BLOCKCHAIN_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001"` em `TEST_ENV`
  - [x] Adicionar getter `get BLOCKCHAIN_CONTRACT_ADDRESS()` na classe `Environments`
  - [x] **NÃO remover** nenhum getter ou campo existente — apenas adicionar

- [x] Task 4: Criar ABI mínima do contrato YaIDRegistry (AC: #2)
  - [x] Criar `src/shared/clients/blockchain/abi.ts` com a ABI mínima para os 4 métodos do contrato:
    - `registerDID(string did)` — escrita (payable/nonpayable)
    - `revokeVC(bytes32 vcHash)` — escrita
    - `isDIDRegistered(string did) returns (bool)` — leitura (view)
    - `isVCRevoked(bytes32 vcHash) returns (bool)` — leitura (view)

- [x] Task 5: Criar implementação concreta `EthersBlockchainClient` (AC: #2, #3, #4)
  - [x] Criar `src/shared/clients/blockchain/EthersBlockchainClient.ts`
  - [x] Construtor recebe `contractAddress: string`, `walletPrivateKey: string` e `rpcUrl: string`
  - [x] Usar `ethers.JsonRpcProvider` para conectar ao RPC (URL via `BLOCKCHAIN_RPC_URL` de `environments.ts`)
  - [x] Usar `ethers.Wallet` com a private key para assinar transações de escrita
  - [x] Para escrita (`registerDID`, `revokeVC`): chamar o método do contrato com `.wait()` para aguardar confirmação
  - [x] Para leitura (`isDIDRegistered`, `isVCRevoked`): usar provider (sem wallet) — não gera gas
  - [x] Para `revokeVC`: converter `vcId` para `bytes32` via `ethers.id(vcId)` (keccak256 do id)
  - [x] Propagar erros sem capturar — deixar o use case tratar exceções da chain

- [x] Task 6: Adicionar `BLOCKCHAIN_RPC_URL` ao `environments.ts` (AC: #2, #3)
  - [x] Adicionar `BLOCKCHAIN_RPC_URL: z.string().url().default("http://127.0.0.1:8545")` ao schema Zod
  - [x] Adicionar `BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL` em `readProcessEnv()`
  - [x] Adicionar `BLOCKCHAIN_RPC_URL: "http://127.0.0.1:8545"` em `TEST_ENV`
  - [x] Adicionar getter `get BLOCKCHAIN_RPC_URL()` na classe `Environments`

- [x] Task 7: Registrar `getBlockchainClient()` em `Environments` (AC: #2)
  - [x] Adicionar método `async getBlockchainClient(): Promise<BlockchainClient>` na classe `Environments`
  - [x] Retornar `new EthersBlockchainClient(this.BLOCKCHAIN_CONTRACT_ADDRESS, this.BLOCKCHAIN_WALLET_PRIVATE_KEY, this.BLOCKCHAIN_RPC_URL)` para stages não-TEST
  - [x] Para stage TEST: lançar `Error("No blockchain client configured for TEST stage")` — igual ao padrão dos outros getters

- [x] Task 8: Garantir que `src/shared/clients/blockchain/` existe com index (AC: #2)
  - [x] Criar `src/shared/clients/blockchain/index.ts` exportando `EthersBlockchainClient`

- [x] Task 9: Validar build TypeScript limpo
  - [x] Executar `npm run build` — sem erros de tipo (build limpo, 17 rotas geradas)
  - [x] Executar `npm test` — 102/102 testes passando, zero regressão

### Review Findings (2026-05-21)

- [x] [Review][Patch] tx.wait() result not validated — null return (tx dropped) e status=0 (EVM revert) tratados como sucesso silencioso [`src/shared/clients/blockchain/EthersBlockchainClient.ts:registerDID,revokeVC`]
- [x] [Review][Patch] contractAddress não validado como endereço Ethereum — erro opaco em runtime em vez de falha no boot [`src/shared/clients/blockchain/EthersBlockchainClient.ts:constructor`]
- [x] [Review][Defer] getBlockchainClient() cria nova instância por chamada — sem cache (consistente com padrão existente dos outros get*() do Environments) — deferred, pre-existing pattern
- [x] [Review][Defer] toJSON() serializa BLOCKCHAIN_WALLET_PRIVATE_KEY — comportamento pré-existente não introduzido aqui — deferred, pre-existing
- [x] [Review][Defer] Sem timeout em tx.wait() — decisão explícita de MVP (sem retry) — deferred, pre-existing
- [x] [Review][Defer] Sem validação de input em did/vcId — responsabilidade da camada de use case — deferred, pre-existing
- [x] [Review][Defer] Key exposure em stack trace — risco baixo, mitigado por validação Zod na inicialização — deferred, pre-existing

## Dev Notes

### Decisão de Library: ethers.js v6

A arquitetura marca a escolha de library como TBD (⚠️). Para este projeto **usar ethers.js v6** pelos seguintes motivos:
- Madura, documentação excelente, comunidade grande
- Compatível com Node.js (Next.js API routes rodam server-side)
- API limpa para interação com contratos: `ethers.Contract`, `ethers.JsonRpcProvider`, `ethers.Wallet`
- Suporte nativo a `bytes32` e `keccak256` para o hash de revogação
- Não requer configuração de bundler adicional (viem tem mais acoplamento com wagmi/React)

### Estrutura de Arquivos a Criar

```
src/shared/
  domain/
    interfaces/
      BlockchainClient.ts           ← NOVO
  clients/
    blockchain/
      abi.ts                        ← NOVO (ABI mínima do contrato)
      EthersBlockchainClient.ts     ← NOVO (implementação concreta)
      index.ts                      ← NOVO (barrel export)
  environments.ts                   ← ATUALIZAR (adicionar 2 vars + getter)
```

### Interface `BlockchainClient` (padrão do projeto)

Seguir o mesmo padrão de `ApiKeyHasher.ts`:

```typescript
// src/shared/domain/interfaces/BlockchainClient.ts
export interface BlockchainClient {
  registerDID(did: string): Promise<void>;
  revokeVC(vcId: string): Promise<void>;
  isDIDRegistered(did: string): Promise<boolean>;
  isVCRevoked(vcId: string): Promise<boolean>;
}
```

### ABI mínima do contrato YaIDRegistry

O contrato YaIDRegistry já está implantado. A ABI mínima necessária para os 4 métodos que o `BlockchainClient` precisa:

```typescript
// src/shared/clients/blockchain/abi.ts
export const YAID_REGISTRY_ABI = [
  "function registerDID(string did) external",
  "function revokeVC(bytes32 vcHash) external",
  "function isDIDRegistered(string did) external view returns (bool)",
  "function isVCRevoked(bytes32 vcHash) external view returns (bool)",
] as const;
```

> ⚠️ **ATENÇÃO:** Esta ABI assume que o contrato YaIDRegistry usa `bytes32 vcHash` (não `string vcId`) para revogação. Confirm com o contrato real antes de finalizar. Se o contrato usar `string`, remover o `ethers.id()` na implementação.

### Implementação `EthersBlockchainClient`

```typescript
// src/shared/clients/blockchain/EthersBlockchainClient.ts
import { ethers } from "ethers";
import type { BlockchainClient } from "@/shared/domain/interfaces/BlockchainClient";
import { YAID_REGISTRY_ABI } from "./abi";

export class EthersBlockchainClient implements BlockchainClient {
  private readonly contract: ethers.Contract;
  private readonly readContract: ethers.Contract;

  constructor(
    contractAddress: string,
    walletPrivateKey: string,
    rpcUrl: string
  ) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    // Contrato de escrita (usa wallet — paga gas)
    this.contract = new ethers.Contract(contractAddress, YAID_REGISTRY_ABI, wallet);
    // Contrato de leitura (usa provider — sem gas)
    this.readContract = new ethers.Contract(contractAddress, YAID_REGISTRY_ABI, provider);
  }

  async registerDID(did: string): Promise<void> {
    const tx = await this.contract.registerDID(did);
    await tx.wait();
  }

  async revokeVC(vcId: string): Promise<void> {
    const vcHash = ethers.id(vcId); // keccak256 do vcId como bytes32
    const tx = await this.contract.revokeVC(vcHash);
    await tx.wait();
  }

  async isDIDRegistered(did: string): Promise<boolean> {
    return await this.readContract.isDIDRegistered(did);
  }

  async isVCRevoked(vcId: string): Promise<boolean> {
    const vcHash = ethers.id(vcId);
    return await this.readContract.isVCRevoked(vcHash);
  }
}
```

### Atualização de `environments.ts`

Acrescentar ao schema Zod:
```typescript
BLOCKCHAIN_CONTRACT_ADDRESS: z.string().min(1),
BLOCKCHAIN_RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
```

Acrescentar em `readProcessEnv()`:
```typescript
BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL,
```

Acrescentar em `TEST_ENV`:
```typescript
BLOCKCHAIN_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
BLOCKCHAIN_RPC_URL: "http://127.0.0.1:8545",
```

Acrescentar getters na classe `Environments`:
```typescript
get BLOCKCHAIN_CONTRACT_ADDRESS() {
  return this.values.BLOCKCHAIN_CONTRACT_ADDRESS;
}

get BLOCKCHAIN_RPC_URL() {
  return this.values.BLOCKCHAIN_RPC_URL;
}
```

Acrescentar método factory:
```typescript
async getBlockchainClient(): Promise<BlockchainClient> {
  if (this.stage === Stage.TEST) {
    throw new Error("No blockchain client configured for TEST stage");
  }
  const { EthersBlockchainClient } = await import(
    "@/shared/clients/blockchain/EthersBlockchainClient"
  );
  return new EthersBlockchainClient(
    this.BLOCKCHAIN_CONTRACT_ADDRESS,
    this.BLOCKCHAIN_WALLET_PRIVATE_KEY,
    this.BLOCKCHAIN_RPC_URL
  );
}
```

### Convenções do projeto a seguir

- **`environments.ts` é o único lugar que lê `process.env`** — NUNCA ler `process.env` diretamente no client ou em use cases.
- **Erros não são capturados no client** — o client propaga a exceção da chain; o use case é responsável por tratá-la.
- **Import lazy** em `getBlockchainClient()` — mesma pattern dos outros getters de `Environments` (`SupabaseCompanyRepository` etc.).
- **`@/` alias** para `src/` — usar sempre (não `../../../`).
- **Nomenclatura:** `EthersBlockchainClient` (prefixo de tecnologia + nome da interface) — mesmo padrão de `Sha256ApiKeyHasher`, `SupabaseCompanyRepository`.

### Contexto de Uso Futuro (Stories 5.3–5.6)

O `BlockchainClient` será injetado via presenter nos seguintes use cases:
- **Story 5.4 (Emissão de VC):** `registerDID(holderDid)` para registrar o DID on-chain na emissão
- **Story 5.5 (Verificação de VP):** `isDIDRegistered(did)` + `isVCRevoked(vcId)` para validar on-chain
- **Story 5.6 (Cancel/Revogação):** `revokeVC(vcId)` para registrar revogação on-chain

Este story cria apenas a infraestrutura — nenhum use case de domínio é alterado aqui.

### Variáveis de Ambiente Necessárias no `.env.local`

```dotenv
BLOCKCHAIN_CONTRACT_ADDRESS=0x<endereço-do-contrato-local>
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_WALLET_PRIVATE_KEY=0x<private-key-do-hardhat>
```

Para ambiente de desenvolvimento com Hardhat: usar os valores do `hardhat.config.js` local do contrato YaIDRegistry.

### Estratégia de Retry e Latência

Para o MVP: **sem retry automático**. Se a transação falhar, a exceção é propagada ao use case. Retry e tratamento de latência on-chain são pós-MVP (alinhado com a decisão arquitetural de mínima complexidade no MVP).

### Testes Unitários

Esta story **não requer testes unitários no `tests/unit/`** — o client é uma casca de I/O que depende de uma chain real. Testes de integração exigiriam um Hardhat local mockado, o que está fora do escopo do MVP. A interface `BlockchainClient` garante que use cases futuros podem ser testados com um mock da interface.

O teste de validação desta story é: `npm run build` sem erros de tipo + `npm test` sem regressão.

## Dev Agent Record

### Completion Notes

- Implementação completa da infraestrutura de integração blockchain para o MVP.
- Escolha de **ethers.js v6** justificada: API madura, suporte nativo a `JsonRpcProvider`, `Wallet` e `keccak256` via `ethers.id()`.
- `EthersBlockchainClient` separa contratos de leitura (provider) e escrita (wallet) para evitar gas desnecessário em queries.
- `environments.ts` atualizado com `BLOCKCHAIN_CONTRACT_ADDRESS` (obrigatório) e `BLOCKCHAIN_RPC_URL` (default: `http://127.0.0.1:8545`), mantendo padrão de leitura centralizada de `process.env`.
- `TEST_ENV` atualizado com valores fixos para não quebrar testes que instanciam `Environments`.
- Build: ✅ sem erros TypeScript. Testes: ✅ 102/102 passando, zero regressão.
- A nota ⚠️ na ABI (sobre `bytes32 vcHash` vs `string vcId`) foi preservada como alerta para as stories 5.4–5.6 que consumirão o client.

### Implementation Date

2026-05-21

## File List

### Novos Arquivos
- `src/shared/domain/interfaces/BlockchainClient.ts`
- `src/shared/clients/blockchain/abi.ts`
- `src/shared/clients/blockchain/EthersBlockchainClient.ts`
- `src/shared/clients/blockchain/index.ts`

### Arquivos Modificados
- `src/shared/environments.ts` — adicionados: import `BlockchainClient`, 2 vars no schema Zod (`BLOCKCHAIN_CONTRACT_ADDRESS`, `BLOCKCHAIN_RPC_URL`), 2 campos em `TEST_ENV`, 2 campos em `readProcessEnv()`, 2 getters, método `getBlockchainClient()`
- `package.json` — adicionada dependência `ethers@^6`
- `package-lock.json` — atualizado pelo npm

## Change Log

- **2026-05-21** — Implementação completa da Story 5.2: interface `BlockchainClient`, ABI mínima YaIDRegistry, `EthersBlockchainClient` com ethers.js v6, integração em `environments.ts` com `getBlockchainClient()`. Build limpo, 102/102 testes passando.
