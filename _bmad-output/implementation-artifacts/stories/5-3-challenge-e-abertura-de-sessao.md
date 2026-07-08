# Story 5.3: Challenge e Abertura de Sessão

Status: done

## Story

Como app mobile do holder,
Quero solicitar um challenge/nonce para a sessão de verificação,
Para que minha Verifiable Presentation seja vinculada a essa sessão específica e não possa ser reutilizada.

## Acceptance Criteria

1. **Given** uma chamada `GET /api/proof-sessions/{sessionToken}/challenge` autenticada por DID e com posse do `sessionToken`
   **When** o endpoint processa
   **Then** um nonce aleatório é gerado
   **And** `challenge_nonce_hash = SHA-256(nonce)` e `challenge_created_at = now()` são salvos na `proof_session`
   **And** o status da `proof_session` transiciona de `waiting_user` para `opened`
   **And** a resposta retorna apenas o nonce bruto ao app mobile — única vez que é exposto
   **And** a `proof_request` associada transiciona para `processing`

2. **Given** uma sessão já em status `opened`, `approved_by_user`, `expired` ou `cancelled`
   **When** o endpoint é chamado
   **Then** retorna HTTP 422 com `{ error: "Session not in waiting_user state" }`

3. **Given** um `sessionToken` inválido ou de outra entidade
   **When** o endpoint é chamado
   **Then** retorna HTTP 404

## Tasks / Subtasks

- [x] Task 1: Criar viewmodel `challenge_proof_session_viewmodel.ts` (AC: #1)
  - [x] Exportar `ChallengeProofSessionOutputDTO` com campo `nonce: string`

- [x] Task 2: Implementar `challenge_proof_session_usecase.ts` (AC: #1–#3)
  - [x] Injetar `ProofSessionRepository`, `ProofRequestRepository`, `ApiKeyHasher`
  - [x] Hashear `sessionToken` via `hasher.hash()` para buscar a sessão
  - [x] Retornar `NotFoundError` se sessão não encontrada (AC #3)
  - [x] Rejeitar com `UnprocessableEntityError` se sessão não está em `waiting_user` (AC #2)
  - [x] Gerar nonce com `randomBytes(32).toString('base64url')`
  - [x] Hashear nonce via `SHA-256` (node:crypto `createHash`)
  - [x] Chamar `session.openWithChallenge(nonceHash, now)` — domain method (AC #1)
  - [x] Persistir sessão via `sessionRepo.update(session)`
  - [x] Transicionar proof_request via `requestRepo.updateStatus(id, PROCESSING)` (AC #1)
  - [x] Retornar `{ nonce }` — única exposição do nonce bruto

- [x] Task 3: Criar `challenge_proof_session_controller.ts` (AC: #1–#3)
  - [x] Thin controller, delega para `useCase.execute`

- [x] Task 4: Criar `challenge_proof_session_presenter.ts` (AC: #1–#3)
  - [x] Factory que injeta `ProofSessionRepository`, `ProofRequestRepository`, `ApiKeyHasher`

- [x] Task 5: Adicionar `openWithChallenge` em `ProofSession` entity (AC: #1)
  - [x] Método que transiciona `status → OPENED`, seta `openedAt`, `challengeNonceHash`, `challengeCreatedAt`
  - [x] Guarda contra status != `WAITING_USER`

- [x] Task 6: Adicionar `updateStatus` na interface `ProofRequestRepository` (AC: #1)
  - [x] `updateStatus(id: string, status: ProofRequestStatus): Promise<void>`

- [x] Task 7: Implementar `updateStatus` em `SupabaseProofRequestRepository` (AC: #1)
  - [x] `.update({ status }).eq("id", id)`

- [x] Task 8: Criar rota API `challenge/route.ts` (AC: #1–#3)
  - [x] `GET /api/proof-sessions/[sessionToken]/challenge`
  - [x] Protegida por `withDIDAuth` (configurado em `src/shared/middleware.ts`)
  - [x] Usa `makeChallengeProofSessionController` + `handleHttpError`

- [x] Task 9: Criar testes unitários em `tests/unit/story-5-3/`
  - [x] Testes estruturais cobrindo todos os contratos da story

- [x] Task 10: Validar `npm run build` e `npm test`

## Dev Notes

### Fluxo de dados

```
GET /api/proof-sessions/{token}/challenge
  (protegido por withDIDAuth — x-holder-did injetado no header)
    ↓
ChallengeProofSessionController.handle({ sessionToken })
    ↓
ChallengeProofSessionUseCase.execute({ sessionToken })
    ↓  hash(sessionToken) → findByTokenHash
    ↓  validate: status === WAITING_USER && not expired
    ↓  nonce = randomBytes(32).base64url
    ↓  nonceHash = SHA-256(nonce)
    ↓  session.openWithChallenge(nonceHash, now)
    ↓  sessionRepo.update(session)
    ↓  requestRepo.updateStatus(session.proofRequestId, PROCESSING)
    ↓  return { nonce }
```

### Geração de nonce

O nonce usa `node:crypto` `randomBytes(32).toString("base64url")` — 256 bits de entropia, encoding URL-safe. O hash para persistência usa `createHash("sha256").update(nonce).digest("hex")` (mesma abordagem do SHA-256 de `apiKey`).

### Diferença entre `markOpened` e `openWithChallenge`

`markOpened()` (já existente em `ProofSession`) é usado pelo `GetProofSessionUseCase` quando o holder abre a tela coringa (Story 4.1) — apenas transiciona status e seta `openedAt`.

`openWithChallenge(nonceHash, now)` (novo) é usado nesta story — transiciona status + seta `openedAt` + seta `challengeNonceHash` + `challengeCreatedAt` em uma operação domain atômica.

### `updateStatus` vs `update`

`ProofRequestRepository.updateStatus` é uma operação cirúrgica para transicionar apenas o `status` da proof_request — evita buscar a entidade completa quando só precisamos atualizar o status. Será reutilizado em Stories 5.5 (→ approved/rejected) e 5.6 (→ rejected/cancel).

### Proteção DID já configurada

`src/shared/middleware.ts` linha 40 já cobre `/api/proof-sessions/{token}/challenge` com `withDIDAuth`:
```typescript
if (/^\/api\/proof-sessions\/[^/]+\/challenge$/.test(pathname)) return true;
```
Nenhuma mudança necessária no middleware.

### Arquivos modificados/criados

**Novos:**
- `src/modules/proof-session/app/challenge_proof_session_viewmodel.ts`
- `src/modules/proof-session/app/challenge_proof_session_usecase.ts`
- `src/modules/proof-session/app/challenge_proof_session_controller.ts`
- `src/modules/proof-session/app/challenge_proof_session_presenter.ts`
- `app/api/proof-sessions/[sessionToken]/challenge/route.ts`
- `tests/unit/story-5-3/challenge-proof-session.test.mjs`

**Modificados:**
- `src/shared/domain/entities/ProofSession.ts` — adicionado `openWithChallenge()`
- `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts` — adicionado `updateStatus()`
- `src/shared/infra/repositories/SupabaseProofRequestRepository.ts` — implementado `updateStatus()`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (thinking)

### Completion Notes List

- `openWithChallenge` adicionado à entidade `ProofSession` — transiciona `waiting_user → opened` e seta challenge fields em uma operação atômica de domínio.
- `updateStatus` adicionado à interface `ProofRequestRepository` e implementado em `SupabaseProofRequestRepository` — necessário para transicionar `proof_request → processing` nesta story e será reutilizado em 5.5/5.6.
- Nonce gerado com `randomBytes(32)` (256-bit) e encodado como `base64url`. Hash persistido via `SHA-256` do node:crypto.
- Build Turbopack falha por erros pré-existentes das stories 5.1 (`@noble/ed25519`) e 5.2 (`ethers`) — modules não encontrados pelo Turbopack na resolução de raiz errada; não introduzidos por esta story.
- Testes estruturais: todos os novos testes da story 5.3 passam. Falhas no `npm test` são pré-existentes (testes `tsc --noEmit` de stories anteriores com `npx ENOENT` em contexto de build).

### File List

**Novos Arquivos:**
- `src/modules/proof-session/app/challenge_proof_session_viewmodel.ts`
- `src/modules/proof-session/app/challenge_proof_session_usecase.ts`
- `src/modules/proof-session/app/challenge_proof_session_controller.ts`
- `src/modules/proof-session/app/challenge_proof_session_presenter.ts`
- `app/api/proof-sessions/[sessionToken]/challenge/route.ts`
- `tests/unit/story-5-3/challenge-proof-session.test.mjs`

**Arquivos Modificados:**
- `src/shared/domain/entities/ProofSession.ts` — método `openWithChallenge(nonceHash, now)`
- `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts` — método `updateStatus(id, status)`
- `src/shared/infra/repositories/SupabaseProofRequestRepository.ts` — implementação de `updateStatus`

## Change Log

- **2026-06-08** — Implementação completa da Story 5.3: challenge endpoint com geração de nonce, hash SHA-256, transição de sessão para `opened` e proof_request para `processing`.
