# Story 5.4: Emissão de Verifiable Credential

Status: done

## Story

Como holder com app mobile,
Quero emitir minha Verifiable Credential apresentando meu documento,
Para que eu possa usar essa credencial para verificações futuras sem entregar meu documento a terceiros.

## Acceptance Criteria

1. **Given** uma chamada `POST /api/credentials/issue` autenticada por DID com body `{ documentImage, proofType, bodySignature }`
   **When** o endpoint processa
   **Then** a assinatura do body pelo holder é validada com a public key extraída do DID antes de qualquer outra operação
   **And** o processamento OCR ocorre em memória — a imagem do documento e os dados extraídos (nome, CPF, data de nascimento) nunca são persistidos em banco ou log
   **And** uma VC é construída com: `id` (UUID), `type`, `issuer` (DID do backend YaID), `holder` (DID do holder), `issuedAt`, `claims: { personhood: true }` ou `{ ageOver18: true }` (apenas booleanos, sem PII)
   **And** a VC é assinada com `ISSUER_PRIVATE_KEY` (Ed25519) via `@noble/ed25519`
   **And** `BlockchainClient.registerDID(holderDid)` é chamado para registrar o DID on-chain
   **And** a VC completa (incluindo prova de assinatura) é retornada ao app mobile
   **And** após o retorno, nenhum dado do holder permanece em memória ou banco da YaID

2. **Given** falha no OCR (documento ilegível ou tipo não suportado)
   **When** o processamento é executado
   **Then** retorna HTTP 422 com `{ error: "Document processing failed" }` sem persistir nada

3. **Given** falha no registro on-chain
   **When** `registerDID` lança exceção
   **Then** retorna HTTP 502 com `{ error: "Blockchain registration failed" }` sem emitir VC parcial

## Tasks / Subtasks

- [x] Task 1: Criar a interface domain do OCR
  - [x] Criar `src/shared/domain/interfaces/OcrProvider.ts` contendo `OcrProvider` e `OcrResult`

- [x] Task 2: Criar a implementação de Mock do OCR em infra
  - [x] Criar `src/shared/clients/ocr/MockOcrProvider.ts` herdando de `OcrProvider`
  - [x] Tratar erros de processamento quando imagem for `"fail"` ou `"invalid"`
  - [x] Tratar simulação de menor de 18 anos quando imagem tiver `"under18"`

- [x] Task 3: Atualizar Environments
  - [x] Registrar método factory `getOcrProvider()` em `src/shared/environments.ts`

- [x] Task 4: Criar Camadas Clean Architecture
  - [x] Criar `src/modules/credential/app/issue_credential_viewmodel.ts` para validação Zod
  - [x] Criar `src/modules/credential/app/issue_credential_controller.ts` para receber e validar a requisição
  - [x] Criar `src/modules/credential/app/issue_credential_presenter.ts` para unir usecase e controller
  - [x] Criar `src/modules/credential/app/issue_credential_usecase.ts` para orquestrar regras de negócio, verificação, OCR, assinatura do VC e blockchain.

- [x] Task 5: Criar Rota da API
  - [x] Criar `app/api/credentials/issue/route.ts` protegida pelo middleware DID auth

- [x] Task 6: Escrever Testes Unitários e Validação Estática
  - [x] Criar `tests/unit/story-5-4/credential-issuance.test.mjs`
  - [x] Validar que o projeto compila sem erros com `tsc --noEmit`
  - [x] Rodar e validar todos os testes com `node --test`

## Review Findings

- [x] **Arquitetura de Camadas**: A separação de responsabilidades seguiu perfeitamente o padrão `presenter -> controller -> usecase <-> domain -> infra` do projeto.
- [x] **In-Memory OCR**: Nenhum dado extraído pelo OCR (nome, CPF, birthDate) ou imagem foi mantido em log ou banco de dados, apenas em memória.
- [x] **Validação Criptográfica**: Chave pública do holder extraída diretamente do seu DID e usada para validar o `bodySignature` do request via `@noble/ed25519` `verifyAsync`.
- [x] **Tratamento de Erros**: O mapeamento de erros trata devidamente 401 (signature), 422 (OCR e idade) e 502 (blockchain).
- [x] **Resolução do compilador Next**: A ausência do route handler causava erro no type validator gerado pelo Next.js. A criação de `app/api/credentials/issue/route.ts` resolveu todos os erros de compilação TS no projeto.

## Dev Notes

### Payload de Assinatura do Body pelo Holder
O payload canônico assinado pelo Holder no seu mobile para a emissão é:
`"${documentImage}:${proofType}"`

### Estrutura de Assinatura do Verifiable Credential
O VC emitido segue a estrutura padrão contendo claims de privacidade (`personhood` ou `ageOver18` como booleanos):
```json
{
  "id": "uuid",
  "type": ["VerifiableCredential"],
  "issuer": "did:yaid:issuer:<issuer-pubkey-hex>",
  "holder": "did:yaid:user:<holder-pubkey-hex>",
  "issuedAt": "timestamp",
  "claims": {
    "personhood": true
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "timestamp",
    "verificationMethod": "did:yaid:issuer:<issuer-pubkey-hex>#key-1",
    "proofPurpose": "assertionMethod",
    "signatureValue": "base64url-signature-of-vc-payload"
  }
}
```
O payload assinado pelo emissor YaID é o JSON correspondente à parte estrutural do VC (excluindo a chave `proof`).
