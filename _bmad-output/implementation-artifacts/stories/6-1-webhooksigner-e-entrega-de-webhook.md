# Story 6.1: WebhookSigner e Entrega de Webhook

Status: done

## Story

Como empresa parceira,
Quero receber uma notificação HTTP assinada quando o resultado de uma verificação estiver disponível,
Para que meu sistema seja atualizado automaticamente sem precisar fazer polling constante na API.

## Acceptance Criteria

1. **Given** a interface `WebhookSigner` em `src/shared/domain/interfaces/WebhookSigner.ts`
   **When** revisada
   **Then** define o método `sign(payload: string): { signature: string; timestamp: number }` onde `payload` é o body JSON bruto

2. **Given** a implementação concreta do `WebhookSigner`
   **When** instanciada pelo presenter via `environments.ts`
   **Then** lê `WEBHOOK_SIGNING_PRIVATE_KEY` (Ed25519) de `environments.ts`
   **And** assina o body JSON bruto sem re-serializar (preserva bytes exatos do payload)
   **And** retorna a assinatura base64 e o timestamp Unix atual

3. **Given** a implementação de `DeliverWebhookUseCase` concluída nesta story
   **When** `DeliverWebhookUseCase` é integrado aos use cases das Stories 5.5 e 5.6 que já transitam os status de `proof_request` para `approved` e `rejected`
   **Then** `DeliverWebhookUseCase` é chamado de forma assíncrona ao final de cada transição (não bloqueia a resposta ao caller)
   **And** o use case verifica se o app da proof_request possui `webhook_url` configurado — se não tiver, não faz nada
   **And** se `webhook_url` existe, envia `POST {webhook_url}` com:
     - Body JSON: `{ proofRequestId, status, proofType, externalReference?, updatedAt }`
     - Header `X-YaID-Signature: <assinatura-base64>`
     - Header `X-YaID-Timestamp: <unix-timestamp>`
     - O body nunca contém: VC, VP, DID do holder, nonce ou qualquer PII

4. **Given** a transição de `proof_request` para `expired` (sessão expirada — verificada no endpoint da Story 4.1)
   **When** o status é atualizado para `expired`
   **Then** `DeliverWebhookUseCase` também é integrado a este ponto de transição nesta story

5. **Given** falha na entrega do webhook (timeout, connection refused, 4xx/5xx da empresa)
   **When** o use case trata o erro
   **Then** a falha é logada com `proofRequestId`, `webhookUrl` e código/mensagem de erro
   **And** a `proof_request` permanece no status final — a falha de webhook nunca reabre ou altera o status
   **And** nenhuma retentativa automática é feita no MVP
   **And** a empresa pode consultar `GET /api/proof-requests/{id}` como fallback para verificar o resultado

## Tasks / Subtasks

- [x] Task 1: Criar interface `WebhookSigner` (AC: #1)
  - [x] `src/shared/domain/interfaces/WebhookSigner.ts` — interface com `sign(payload: string): Promise<WebhookSignResult>`
  - [x] Exportar `WebhookSignResult` type com `signature: string` e `timestamp: number`

- [x] Task 2: Criar `Ed25519WebhookSigner` (AC: #2)
  - [x] `src/shared/infra/providers/Ed25519WebhookSigner.ts` — implementa `WebhookSigner`
  - [x] Usa `@noble/ed25519` (já instalado) para assinar
  - [x] Preserva bytes exatos do payload via `TextEncoder.encode(payload)`
  - [x] Retorna assinatura base64 + timestamp Unix
  - [x] Fallback para key hex fixa quando `WEBHOOK_SIGNING_PRIVATE_KEY` é `test-webhook-signing-private-key`

- [x] Task 3: Criar `DeliverWebhookUseCase` (AC: #3, #5)
  - [x] `src/modules/webhook/app/deliver_webhook_usecase.ts`
  - [x] Busca `ProofRequest` por ID para obter `app.id`
  - [x] Resolve `webhookUrl` do `CompanyApp` — se vazio, retorna silenciosamente
  - [x] Monta body JSON: `{ proofRequestId, status, proofType, externalReference?, updatedAt }` — sem PII
  - [x] Assina body via `WebhookSigner.sign(bodyJson)`
  - [x] Envia `POST` com `X-YaID-Signature` e `X-YaID-Timestamp` headers
  - [x] Timeout de 10s via `AbortController`
  - [x] Nunca lança exceção — erros são logados com `proofRequestId`, `webhookUrl`, código/mensagem
  - [x] Cache de `webhookUrl` por `appId` para evitar queries repetidas

- [x] Task 4: Criar factory `deliver_webhook_presenter.ts` (AC: #2, #3)
  - [x] `src/modules/webhook/app/deliver_webhook_presenter.ts`
  - [x] `makeDeliverWebhookUseCase()` injeta `ProofRequestRepository` + `Ed25519WebhookSigner`

- [x] Task 5: Integrar webhook no `VerifyPresentationUseCase` — Story 5.5 (AC: #3)
  - [x] Adicionado `DeliverWebhookUseCase` como dependência opcional no construtor
  - [x] Webhook disparado via `fireWebhook()` fire-and-forget após `approved` e `rejected`
  - [x] Presenter injetado via `makeDeliverWebhookUseCase()`

- [x] Task 6: Integrar webhook no `CancelProofSessionUseCase` — Story 5.6 (AC: #3)
  - [x] Adicionado `DeliverWebhookUseCase` como dependência opcional
  - [x] Webhook disparado fire-and-forget após `rejected` (cancel)
  - [x] Presenter injetado via `makeDeliverWebhookUseCase()`

- [x] Task 7: Integrar webhook no `GetProofSessionUseCase` — Story 4.1 (AC: #4)
  - [x] Adicionado `ProofRequestRepository` e `DeliverWebhookUseCase` como dependências opcionais
  - [x] **Fix**: Adicionada transição `proof_request.status → EXPIRED` (estava faltando)
  - [x] Webhook disparado fire-and-forget após `expired`
  - [x] Presenter injetado via `makeDeliverWebhookUseCase()` + `getProofRequestRepository()`

- [x] Task 8: Criar testes unitários (AC: todos)
  - [x] `tests/unit/story-6-1/webhook-delivery.test.mjs` — 32 testes estruturais
  - [x] Existência de todos os 4 arquivos novos
  - [x] Contratos: WebhookSigner, Ed25519WebhookSigner, DeliverWebhookUseCase
  - [x] Integração em 3 use cases (verify, cancel, get)
  - [x] PII safety: body não contém VC, VP, DID, nonce
  - [x] Fire-and-forget pattern (`.catch()`) em todos os pontos
  - [x] Compilação TypeScript limpa

- [x] Task 9: Rodar testes e build
  - [x] `node --test tests/unit/story-6-1/webhook-delivery.test.mjs` — 32/32 testes passando
  - [x] TypeScript: zero erros nos arquivos da story (erros `lucide-react` pré-existentes filtrados)

## Dev Notes

### Arquitetura do Webhook

O fluxo de entrega de webhook segue a cadeia:

```
Use Case (verify/cancel/get)
  └─ fireWebhook() — fire-and-forget (.catch)
       └─ DeliverWebhookUseCase.execute()
            ├─ ProofRequestRepository.findById() — busca app associado
            ├─ CompanyAppRepository.findById() — resolve webhookUrl
            ├─ WebhookSigner.sign(bodyJson) — assina com Ed25519
            └─ fetch(webhookUrl, { POST, headers, body })
```

### Pontos de Integração

| Use Case | Status | Story Origem |
|----------|--------|-------------|
| `VerifyPresentationUseCase` | `approved` | 5.5 |
| `VerifyPresentationUseCase` | `rejected` | 5.5 |
| `CancelProofSessionUseCase` | `rejected` | 5.6 |
| `GetProofSessionUseCase` | `expired` | 4.1 |

### Fix: Transição `proof_request → expired`

O `GetProofSessionUseCase` (Story 4.1) fazia `session.markExpired()` mas **não** transitava `proof_request.status → expired`. Esta story corrigiu isso adicionando `requestRepo.updateStatus(proofRequestId, ProofRequestStatus.EXPIRED)` no bloco de expiração.

### Dependência Opcional

Todos os `DeliverWebhookUseCase` são injetados como parâmetros **opcionais** (`?`) nos construtores dos use cases existentes. Isso garante backward compatibility — callers existentes que não passam o webhook continuam funcionando sem mudança.

### Webhook Body

```json
{
  "proofRequestId": "uuid",
  "status": "approved|rejected|expired",
  "proofType": "verification",
  "externalReference": "optional-external-ref",
  "updatedAt": "2026-07-21T22:00:00.000Z"
}
```

**Nunca contém**: VC, VP, DID do holder, nonce, PII.

### Headers

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-YaID-Signature` | Assinatura Ed25519 base64 do body JSON bruto |
| `X-YaID-Timestamp` | Unix timestamp em segundos |

### Ed25519WebhookSigner

- Usa `@noble/ed25519` v3 (`signAsync`)
- Chave privada lida de `WEBHOOK_SIGNING_PRIVATE_KEY` (hex)
- Test mode: `test-webhook-signing-private-key` → fallback para `0000...0002`
- Payload assinado = bytes exatos do body JSON (sem re-serialização)

### Convenções do Projeto

- `WebhookSigner` segue padrão de interfaces de domínio (`src/shared/domain/interfaces/`)
- `Ed25519WebhookSigner` segue padrão de providers (`src/shared/infra/providers/`)
- `DeliverWebhookUseCase` em novo módulo `webhook` (`src/modules/webhook/app/`)
- Presenters seguem padrão de factory functions (`makeXxxUseCase()`)
- Testes seguem padrão estrutural com `node:test` + `readFileSync` + `assert`

### Baseline de Testes

32 testes novos adicionados pela story 6.1, todos passando. Zero erros TypeScript nos arquivos da story. Erros `lucide-react` pré-existentes não relacionados.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/shared/domain/interfaces/WebhookSigner.ts` | CRIAR | Interface `WebhookSigner` + `WebhookSignResult` |
| `src/shared/infra/providers/Ed25519WebhookSigner.ts` | CRIAR | Implementação Ed25519 com `@noble/ed25519` |
| `src/modules/webhook/app/deliver_webhook_usecase.ts` | CRIAR | Use case de entrega de webhook |
| `src/modules/webhook/app/deliver_webhook_presenter.ts` | CRIAR | Factory `makeDeliverWebhookUseCase()` |
| `src/modules/presentation/app/verify_presentation_usecase.ts` | MODIFICAR | Integrar `DeliverWebhookUseCase` (approved/rejected) |
| `src/modules/presentation/app/verify_presentation_presenter.ts` | MODIFICAR | Injetar `DeliverWebhookUseCase` |
| `src/modules/proof-session/app/cancel_proof_session_usecase.ts` | MODIFICAR | Integrar `DeliverWebhookUseCase` (rejected) |
| `src/modules/proof-session/app/cancel_proof_session_presenter.ts` | MODIFICAR | Injetar `DeliverWebhookUseCase` |
| `src/modules/proof-session/app/get_proof_session_usecase.ts` | MODIFICAR | + `proof_request → expired` + `DeliverWebhookUseCase` |
| `src/modules/proof-session/app/get_proof_session_presenter.ts` | MODIFICAR | Injetar `ProofRequestRepository` + `DeliverWebhookUseCase` |
| `tests/unit/story-6-1/webhook-delivery.test.mjs` | CRIAR | 32 testes estruturais |

### References

- [Epics: Story 6.1 AC](../../planning-artifacts/epics.md#story-61-webhooksigner-e-entrega-de-webhook)
- [WebhookSigner interface](../../../../src/shared/domain/interfaces/WebhookSigner.ts)
- [Ed25519WebhookSigner](../../../../src/shared/infra/providers/Ed25519WebhookSigner.ts)
- [DeliverWebhookUseCase](../../../../src/modules/webhook/app/deliver_webhook_usecase.ts)
- [VerifyPresentationUseCase](../../../../src/modules/presentation/app/verify_presentation_usecase.ts)
- [CancelProofSessionUseCase](../../../../src/modules/proof-session/app/cancel_proof_session_usecase.ts)
- [GetProofSessionUseCase](../../../../src/modules/proof-session/app/get_proof_session_usecase.ts)

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (thinking)

### Debug Log References

Nenhum — implementação direta.

### Completion Notes List

- `WebhookSigner` interface criada com `sign(payload: string): Promise<WebhookSignResult>` — retorna `signature` (base64) e `timestamp` (Unix seconds)
- `Ed25519WebhookSigner` implementa a interface usando `@noble/ed25519` v3 (`signAsync`), preserva bytes exatos do payload via `TextEncoder`
- `DeliverWebhookUseCase` em novo módulo `webhook` — resolve `webhookUrl` do `CompanyApp`, monta body sem PII, assina com `WebhookSigner`, envia POST com headers `X-YaID-Signature` e `X-YaID-Timestamp`, timeout de 10s, nunca lança exceção
- Integrado em 3 use cases via dependência opcional: `VerifyPresentationUseCase` (approved/rejected), `CancelProofSessionUseCase` (rejected), `GetProofSessionUseCase` (expired)
- Fix: `GetProofSessionUseCase` agora também transiciona `proof_request.status → EXPIRED` (estava faltando antes desta story)
- Todos os webhooks são fire-and-forget (`.catch()`) — nunca bloqueiam a resposta principal
- 32 testes estruturais criados, todos passando; zero erros TypeScript nos arquivos da story

### File List

**Criados:**
- `src/shared/domain/interfaces/WebhookSigner.ts`
- `src/shared/infra/providers/Ed25519WebhookSigner.ts`
- `src/modules/webhook/app/deliver_webhook_usecase.ts`
- `src/modules/webhook/app/deliver_webhook_presenter.ts`
- `tests/unit/story-6-1/webhook-delivery.test.mjs`

**Modificados:**
- `src/modules/presentation/app/verify_presentation_usecase.ts`
- `src/modules/presentation/app/verify_presentation_presenter.ts`
- `src/modules/proof-session/app/cancel_proof_session_usecase.ts`
- `src/modules/proof-session/app/cancel_proof_session_presenter.ts`
- `src/modules/proof-session/app/get_proof_session_usecase.ts`
- `src/modules/proof-session/app/get_proof_session_presenter.ts`

## Change Log

- 2026-07-21: Story criada e implementada via bmad-story-pipeline. WebhookSigner interface + Ed25519WebhookSigner, DeliverWebhookUseCase com entrega fire-and-forget, integração em VerifyPresentationUseCase (approved/rejected), CancelProofSessionUseCase (rejected), GetProofSessionUseCase (expired + fix de proof_request.status). 32 testes adicionados (32/32 passando).
