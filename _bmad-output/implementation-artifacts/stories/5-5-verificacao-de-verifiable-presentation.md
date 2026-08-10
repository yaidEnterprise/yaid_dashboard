# Story 5.5: Verificação de Verifiable Presentation

Status: done

## Story

Como sistema backend,
Quero validar a Verifiable Presentation do holder contra todas as regras de segurança e privacidade,
Para que apenas holders legítimos com credenciais válidas e não-revogadas sejam aprovados.

## Acceptance Criteria

1. **Given** uma chamada `POST /api/presentations/verify` com VP válida, autenticada por DID e com posse do `sessionToken`
   **When** o use case executa as validações em sequência
   **Then** todas as seguintes regras são verificadas (falha em qualquer uma → `rejected`):
     1. Estrutura da VP é válida (campos obrigatórios presentes)
     2. Assinatura da VP pelo holder é válida (verificada com public key do DID)
     3. A VP contém exatamente uma VC
     4. Assinatura da VC pelo issuer é válida (verificada com `ISSUER_PUBLIC_KEY`)
     5. Claims da VC são booleanos — sem PII
     6. DID do holder na VC corresponde ao DID autenticado no request
     7. Nonce incluído na VP corresponde ao `challenge_nonce_hash` da sessão (SHA-256)
     8. `challenge_created_at` está dentro da janela de validade (10 minutos)
     9. DID do holder está registrado on-chain (`isDIDRegistered = true`)
     10. VC não está revogada on-chain (`isVCRevoked = false`)
     11. `proof_session` está em status `opened`

2. **Given** todas as validações passam
   **When** o use case conclui
   **Then** `proof_session.status` transiciona para `approved_by_user`
   **And** `proof_request.status` transiciona para `approved`
   **And** a resposta retorna `{ valid: true }` ao app mobile
   **And** o disparo de webhook para este status será integrado pela Story 6.1

3. **Given** qualquer validação falha
   **When** o use case conclui
   **Then** `proof_request.status` transiciona para `rejected`
   **And** a resposta retorna `{ valid: false }` — sem detalhar qual regra falhou para o app mobile
   **And** o disparo de webhook para este status será integrado pela Story 6.1

## Tasks / Subtasks

- [x] Task 1: Adicionar `approveByUser()` na entidade `ProofSession` (AC: #2)
  - [x] Método que transiciona `status → APPROVED_BY_USER`, seta `approvedAt`
  - [x] Guarda contra status != `OPENED`

- [x] Task 2: Criar `verify_presentation_viewmodel.ts` (AC: #1)
  - [x] Exportar `VerifyPresentationSchema` com Zod: `{ vp: z.record(z.string(), z.unknown()), sessionToken: z.string().min(1) }`
  - [x] Exportar `VerifyPresentationInput` type

- [x] Task 3: Criar `verify_presentation_usecase.ts` (AC: #1–#3)
  - [x] Injetar: `ProofSessionRepository`, `ProofRequestRepository`, `ApiKeyHasher`, `BlockchainClient`, `issuerPrivateKey: string`
  - [x] Hash do `sessionToken` via `hasher.hash()` para buscar sessão
  - [x] Retornar `{ valid: false }` se sessão não encontrada
  - [x] Executar 11 validações em sequência — falha → `requestRepo.updateStatus(id, REJECTED)`, retorna `{ valid: false }`
  - [x] Sucesso → `session.approveByUser(now)`, `sessionRepo.update(session)`, `requestRepo.updateStatus(id, APPROVED)`
  - [x] Retornar `{ valid: true }`

- [x] Task 4: Criar `verify_presentation_controller.ts` (AC: #1–#3)
  - [x] Thin controller: delega para `useCase.execute({ vp, sessionToken, holderDid })`
  - [x] Valida body com `VerifyPresentationSchema.parse()`

- [x] Task 5: Criar `verify_presentation_presenter.ts` (AC: #1–#3)
  - [x] Factory `makeVerifyPresentationController` que injeta deps via `Environments.getEnvs()`
  - [x] Injeta: `ProofSessionRepository`, `ProofRequestRepository`, `ApiKeyHasher`, `BlockchainClient`, `ISSUER_PRIVATE_KEY`

- [x] Task 6: Criar rota API `app/api/presentations/verify/route.ts` (AC: #1–#3)
  - [x] `POST /api/presentations/verify`
  - [x] Protegida por `withDIDAuth` (já configurado em `src/shared/middleware.ts` linha 42)
  - [x] Lê `x-holder-did` do header (injetado pelo middleware)
  - [x] Usa `makeVerifyPresentationController` + `handleHttpError`
  - [x] Retorna `{ valid: boolean }` com HTTP 200

- [x] Task 7: Criar testes unitários em `tests/unit/story-5-5/`
  - [x] Verificações de existência de todos os arquivos novos/modificados
  - [x] Verificações estáticas de conteúdo (contratos de validação, uso de blockchain, assinaturas)
  - [x] Compilação TypeScript limpa (`tsc --noEmit`)

## Dev Notes

### Estrutura da VP esperada

O app mobile envia a VP no seguinte formato (campo `vp` no body):

```json
{
  "holder": "did:yaid:user:<holder-pubkey-hex>",
  "challenge": "<nonce-bruto>",
  "verifiableCredential": [
    {
      "id": "uuid",
      "type": ["VerifiableCredential"],
      "issuer": "did:yaid:issuer:<issuer-pubkey-hex>",
      "holder": "did:yaid:user:<holder-pubkey-hex>",
      "issuedAt": "timestamp",
      "claims": { "personhood": true },
      "proof": {
        "type": "Ed25519Signature2020",
        "created": "timestamp",
        "verificationMethod": "did:yaid:issuer:<issuer-pubkey-hex>#key-1",
        "proofPurpose": "assertionMethod",
        "signatureValue": "<base64url-issuer-signature-of-vc-payload-without-proof>"
      }
    }
  ],
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "timestamp",
    "verificationMethod": "did:yaid:user:<holder-pubkey-hex>#key-1",
    "proofPurpose": "authentication",
    "signatureValue": "<base64url-holder-signature-of-vp-payload-without-proof>"
  }
}
```

### Payload de Assinatura da VP pelo Holder

O holder assina o payload da VP **sem** o campo `proof`:

```
JSON.stringify({ holder, challenge, verifiableCredential })
```

### Payload de Assinatura da VC pelo Issuer

O issuer assinou o payload da VC **sem** o campo `proof`:

```
JSON.stringify({ id, type, issuer, holder, issuedAt, claims })
```

Isso é consistente com a Story 5.4 (`IssueCredentialUseCase`): `vcPayload = { id, type, issuer, holder, issuedAt, claims }`.

### Verificação do Nonce (Regra 7)

```
SHA-256(vp.challenge) === session.challengeNonceHash
```

O `session.challengeNonceHash` foi armazenado como hex na Story 5.3.

### Janela de Validade do Challenge (Regra 8)

A `challenge_created_at` é considerada válida se estiver dentro de **10 minutos**:

```
Date.now() - session.challengeCreatedAt.getTime() <= 10 * 60 * 1000
```

### Derivação da ISSUER_PUBLIC_KEY

A chave pública do issuer é derivada da `ISSUER_PRIVATE_KEY` via `@noble/ed25519`:

```typescript
const issuerPrivKeyBytes = hexToBytes(issuerPrivateKey);
const issuerPubKeyBytes = await ed.getPublicKeyAsync(issuerPrivKeyBytes);
```

No ambiente TEST, `ISSUER_PRIVATE_KEY` = `"test-issuer-private-key"` → deve ser substituído por `"0000...0001"` (mesmo tratamento do `IssueCredentialUseCase`).

### Proteção DID já configurada

`src/shared/middleware.ts` linha 42 já cobre `/api/presentations/verify` com `withDIDAuth`:

```typescript
if (pathname.startsWith("/api/presentations/verify")) return true;
```

Nenhuma mudança necessária no middleware.

### Regra 11 na sequência

A regra 11 (`proof_session.status === OPENED`) pode ser verificada antes das chamadas on-chain (regras 9 e 10) para evitar chamadas desnecessárias à blockchain quando a sessão já está em estado inválido. **Porém**, para manter o comportamento opaco (não revelar qual regra falhou), a ordem das verificações deve ser consistente. A implementação pode verificar regra 11 primeiro como otimização — se falhar, retorna `{ valid: false }` imediatamente sem tentar as demais (sem chamar blockchain desnecessariamente).

### Transição de Status em Caso de Falha

Em caso de falha de validação, somente `proof_request.status → rejected` é atualizado. O `proof_session.status` permanece no estado atual (pode ser `opened` ou já estar em estado que causou a falha). Isso é consistente com o épico.

### Arquivos modificados/criados

**Novos:**
- `src/modules/presentation/app/verify_presentation_viewmodel.ts`
- `src/modules/presentation/app/verify_presentation_usecase.ts`
- `src/modules/presentation/app/verify_presentation_controller.ts`
- `src/modules/presentation/app/verify_presentation_presenter.ts`
- `app/api/presentations/verify/route.ts`
- `tests/unit/story-5-5/presentation-verification.test.mjs`

**Modificados:**
- `src/shared/domain/entities/ProofSession.ts` — método `approveByUser(now: Date)`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (thinking)

### Completion Notes List

- As 11 regras de validação são aplicadas sequencialmente no `VerifyPresentationUseCase`. A regra 11 (status da sessão = `opened`) é verificada **primeiro** como otimização — evita chamadas on-chain desnecessárias se a sessão já estiver em estado inválido.
- Payload da VP assinado pelo holder: `JSON.stringify({ holder, challenge, verifiableCredential })` — consistente com a estrutura da VP esperada.
- Payload da VC verificado via public key do issuer derivada de `ISSUER_PRIVATE_KEY` via `ed.getPublicKeyAsync()` — mesma estratégia do `IssueCredentialUseCase`.
- Verificação de nonce: `SHA-256(vp.challenge) === session.challengeNonceHash` (hex), usando `node:crypto` `createHash`.
- Em caso de falha de qualquer validação, somente `proof_request.status → rejected` é atualizado; `proof_session.status` não é alterado nesta story (integração de webhook será feita na Story 6.1).
- Correção aplicada: `z.record(z.unknown())` → `z.record(z.string(), z.unknown())` para compatibilidade com Zod v4.x instalado no projeto.
- Middleware já cobre `/api/presentations/verify` via `pathname.startsWith("/api/presentations/verify")` — nenhuma mudança necessária.
- `tsc --noEmit`: zero erros após correção do Zod.
- 27/27 testes passando.

### File List

**Novos Arquivos:**
- `src/modules/presentation/app/verify_presentation_viewmodel.ts`
- `src/modules/presentation/app/verify_presentation_usecase.ts`
- `src/modules/presentation/app/verify_presentation_controller.ts`
- `src/modules/presentation/app/verify_presentation_presenter.ts`
- `app/api/presentations/verify/route.ts`
- `tests/unit/story-5-5/presentation-verification.test.mjs`

**Arquivos Modificados:**
- `src/shared/domain/entities/ProofSession.ts` — método `approveByUser(now: Date)`

## Change Log

- **2026-07-14** — Implementação completa da Story 5.5: endpoint `POST /api/presentations/verify` com 11 validações sequenciais de VP, aprovação atômica de sessão e proof_request, e 27 testes estruturais passando (tsc clean).
