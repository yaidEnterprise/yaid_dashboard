# Story 4.1: Endpoint Público de Status da Sessão

Status: done

## Story

Como tela coringa (cliente público),
Quero consultar o status atual de uma proof_session pelo token,
Para que eu exiba ao holder o estado correto da verificação sem expor informações sensíveis.

## Acceptance Criteria

1. **Given** uma chamada `GET /api/proof-sessions/{sessionToken}` com token válido
   **When** o endpoint processa o request
   **Then** o token bruto é hasheado e a sessão é localizada por `session_token_hash`
   **And** a resposta retorna `{ status, proofType, companyName, expiresAt, returnUrl? }` em camelCase
   **And** a resposta nunca contém: `externalReference`, `sessionToken` bruto, `requestId` interno, `challengeNonceHash` ou qualquer dado do holder

2. **Given** uma chamada com token inexistente ou malformado
   **When** o endpoint processa
   **Then** retorna HTTP 404 com `{ error: "Session not found" }` — sem distinguir se o token é inválido ou pertence a outra entidade (evita enumeration)

3. **Given** uma sessão com status terminal (`approved_by_user`, `expired`, `cancelled`)
   **When** o endpoint é consultado
   **Then** retorna o status terminal normalmente — o polling do client é responsável por parar

4. **Given** uma sessão com `expires_at` no passado e status ainda `waiting_user` ou `opened`
   **When** o endpoint é consultado
   **Then** o status retornado é `expired`
   **And** o sistema atualiza o status da sessão no banco para `expired`

## Tasks / Subtasks

- [x] Task 1: Adicionar `findByTokenHashWithContext` no `ProofSessionRepository` — query com join para `proofType`, `companyName` e `returnUrl` (AC: #1)
  - [x] Em `src/shared/domain/interfaces/repositories/ProofSessionRepository.ts`, adicionar método `findByTokenHashWithContext(hash: string): Promise<ProofSessionWithContext | null>` com tipo `ProofSessionWithContext` contendo `session`, `proofType`, `companyName` e `returnUrl`
  - [x] Em `src/shared/infra/repositories/SupabaseProofSessionRepository.ts`, implementar o método com join: `proof_session → proof_request → company_app → company`
  - [x] Garantir que `challengeNonceHash`, `sessionTokenHash`, `proofRequestId` e `externalRef` **não** aparecem na resposta (filtragem no ViewModel, não no repositório)

- [x] Task 2: Atualizar `GetProofSessionUseCase` para retornar shape correto e lógica de expiração (AC: #1, #2, #3, #4)
  - [x] Substituir uso de `findByTokenHash` por `findByTokenHashWithContext`
  - [x] Remover `markOpened()` do use case — a Story 4.1 é somente leitura; abertura de sessão é responsabilidade do app mobile (Story 5.3)
  - [x] Implementar lógica de expiração: se `session.expiresAt <= now()` e status não é terminal → atualizar status para `EXPIRED` via `sessionRepo.update(session)` antes de retornar
  - [x] Retornar DTO com campos `{ status, proofType, companyName, expiresAt, returnUrl? }` — sem `id`, `proofRequestId`, `createdAt`, `openedAt`, `approvedAt`

- [x] Task 3: Atualizar `ProofSessionOutputDTO` (viewmodel) para refletir o shape correto (AC: #1)
  - [x] Em `src/modules/proof-session/app/get_proof_session_viewmodel.ts`, redefinir `ProofSessionOutputDTO` com apenas: `status`, `proofType`, `companyName`, `expiresAt`, `returnUrl?: string | null`
  - [x] Remover campos `id`, `proofRequestId`, `createdAt`, `openedAt`, `approvedAt` do DTO público

- [x] Task 4: Adicionar `markExpired()` na entidade `ProofSession` (AC: #4)
  - [x] Em `src/shared/domain/entities/ProofSession.ts`, adicionar método `markExpired()` que seta `status = EXPIRED` apenas se status não for já terminal
  - [x] Definir conjunto de status terminais: `APPROVED_BY_USER`, `EXPIRED`, `CANCELLED`

- [x] Task 5: Validar build e testes (AC: todos)
  - [x] Executar `getDiagnostics` — zero erros TypeScript em todos os arquivos modificados
  - [x] Executar `npm run test` — 244/252 passando; 8 falhas pré-existentes (npx ENOENT + Windows path)

## Dev Notes

### Estado atual da implementação (análise pré-story)

**O que já existe e funciona:**
- `GET /api/proof-sessions/[sessionToken]/route.ts` — extrai `sessionToken` de `ctx.params`, chama `makeGetProofSessionController`, retorna 200
- Middleware em `src/shared/middleware.ts` já classifica `GET /api/proof-sessions/{token}` como rota pública (sem auth)
- `GetProofSessionUseCase`, `GetProofSessionController`, `GetProofSessionPresenter` — todos existem
- `ProofSessionRepository.findByTokenHash` — busca por hash e retorna `ProofSession`
- `SupabaseProofSessionRepository.update` — persiste mudanças de status

**Divergências vs spec que esta story corrige:**

#### Divergência 1: Shape da resposta errado
O ViewModel atual retorna `{ id, proofRequestId, status, createdAt, expiresAt, openedAt, approvedAt }`. O spec (AC #1) pede `{ status, proofType, companyName, expiresAt, returnUrl? }`.

#### Divergência 2: Campos sensíveis expostos
`proofRequestId` é um "requestId interno" que o spec proíbe na resposta. Além disso, `id` da sessão, `openedAt` e `approvedAt` não estão no spec.

#### Divergência 3: `markOpened()` é chamado indevidamente
O use case atual chama `session.markOpened()` ao servir a tela coringa — isso muda o status de `waiting_user` para `opened`. No design correto, `opened` significa que o holder **abriu o app mobile**, não que a tela coringa foi consultada. Essa transição pertence ao fluxo do challenge (Story 5.3).

#### Divergência 4: `proofType` e `companyName` não estão disponíveis
O repositório atual retorna apenas a `ProofSession`. Para ter `proofType` e `companyName`, precisa join: `proof_session → proof_request → company_app → company`.

### Implementação do join no repositório

O schema atual (conforme `SupabaseProofRequestRepository`) usa tabelas:
- `proof_session` — campos `proof_request_id`, `hash_session_token`, `status`, `expires_at`, etc.
- `proof_request` — campos `proof_type`, `return_url` (TBD no schema), `app_id`
- `company_app` — FK `company_id`
- `company` — campo `name`

**Nota sobre `return_url`:** A arquitetura marca `return_url` como `TBD` na tabela `proof_requests`. O `ProofRequestMapper` e a entidade `ProofRequest` atualmente **não incluem** esse campo. Esta story precisa que `returnUrl` apareça na resposta quando presente. Estratégia: ler `return_url` direto no join sem passar pelo mapper da entidade — tratá-lo como dado de contexto no `ProofSessionWithContext`, similar a como `companyName` é tratado.

```typescript
// src/shared/domain/interfaces/repositories/ProofSessionRepository.ts
export type ProofSessionWithContext = {
  session: ProofSession;
  proofType: string;
  companyName: string;
  returnUrl: string | null;
};

export interface ProofSessionRepository {
  create(session: ProofSession): Promise<void>;
  findByTokenHash(hashSessionToken: string): Promise<ProofSession | null>;
  findByTokenHashWithContext(hash: string): Promise<ProofSessionWithContext | null>;
  update(session: ProofSession): Promise<void>;
}
```

**Implementação do join no Supabase:**

```typescript
// src/shared/infra/repositories/SupabaseProofSessionRepository.ts
async findByTokenHashWithContext(hash: string): Promise<ProofSessionWithContext | null> {
  const { data, error } = await this.client
    .from("proof_session")
    .select(`
      *,
      proof_request!inner(
        proof_type,
        return_url,
        company_app!inner(
          company!inner(name)
        )
      )
    `)
    .eq("hash_session_token", hash)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    session: ProofSessionMapper.toDomain(data as ProofSessionPersistence),
    proofType: data.proof_request.proof_type,
    companyName: data.proof_request.company_app.company.name,
    returnUrl: data.proof_request.return_url ?? null,
  };
}
```

**Nota:** O Supabase usa `table!inner(...)` para inner join. Os nomes de tabela para FK reversa no Supabase são baseados no nome da tabela referenciada. Verificar se o Supabase infere o join corretamente ou se é necessário usar o nome explícito da FK (ex: `proof_request!proof_session_proof_request_id_fkey`).

### `markExpired()` na entidade

```typescript
// src/shared/domain/entities/ProofSession.ts
private static readonly TERMINAL_STATUSES = new Set([
  ProofSessionStatus.APPROVED_BY_USER,
  ProofSessionStatus.EXPIRED,
  ProofSessionStatus.CANCELLED,
]);

markExpired(): void {
  if (ProofSession.TERMINAL_STATUSES.has(this.props.status)) return;
  this.props.status = ProofSessionStatus.EXPIRED;
}
```

### Lógica de expiração no use case

```typescript
// Verificar expiração ANTES de retornar
const isExpired = context.session.expiresAt.getTime() <= Date.now();
const isActiveStatus =
  context.session.status === ProofSessionStatus.WAITING_USER ||
  context.session.status === ProofSessionStatus.OPENED;

if (isExpired && isActiveStatus) {
  context.session.markExpired();
  await this.sessionRepo.update(context.session);
}
```

### DTO de saída correto

```typescript
// src/modules/proof-session/app/get_proof_session_viewmodel.ts
export type ProofSessionOutputDTO = {
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  proofType: string;
  companyName: string;
  expiresAt: string;
  returnUrl: string | null;
};
```

### Use case atualizado

```typescript
// src/modules/proof-session/app/get_proof_session_usecase.ts
export class GetProofSessionUseCase {
  constructor(
    private readonly sessionRepo: ProofSessionRepository,
    private readonly hasher: ApiKeyHasher
  ) {}

  async execute(input: { sessionToken: string }): Promise<ProofSessionOutputDTO> {
    const tokenHash = await this.hasher.hash(input.sessionToken);
    const context = await this.sessionRepo.findByTokenHashWithContext(tokenHash);
    if (!context) throw new NotFoundError("Session not found", "PROOF_SESSION_NOT_FOUND");

    const { session, proofType, companyName, returnUrl } = context;

    // Handle expiration: update DB if session expired but status not yet updated
    const isExpired = session.expiresAt.getTime() <= Date.now();
    const isActiveStatus =
      session.status === ProofSessionStatus.WAITING_USER ||
      session.status === ProofSessionStatus.OPENED;

    if (isExpired && isActiveStatus) {
      session.markExpired();
      await this.sessionRepo.update(session);
    }

    return {
      status: session.status,
      proofType,
      companyName,
      expiresAt: session.expiresAt.toISOString(),
      returnUrl: returnUrl ?? null,
    };
  }
}
```

### Nota sobre `SupabaseProofSessionRepository.update`

O método `update` atual persiste `status`, `challenge_nonce_hash`, `challenge_created_at`, `opened_at` e `approved_at`. Para `markExpired`, só o `status` muda — o método existente cobre isso sem alteração.

### Convenções do projeto

- Path aliases: `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`
- Tabelas no banco: `proof_session` (singular), `proof_request` (singular), `company_app` (singular per SupabaseCompanyAppRepository), `company` (singular per SupabaseCompanyRepository)
- Shape de erro HTTP: `handleHttpError` retorna `{ error: { code, message } }` — pré-existente
- `npm run build` tem erros pré-existentes de tipos Next.js; usar `getDiagnostics` para validar

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/shared/domain/interfaces/repositories/ProofSessionRepository.ts` | MODIFICAR | Adicionar `ProofSessionWithContext` e `findByTokenHashWithContext` |
| `src/shared/infra/repositories/SupabaseProofSessionRepository.ts` | MODIFICAR | Implementar `findByTokenHashWithContext` com join |
| `src/shared/domain/entities/ProofSession.ts` | MODIFICAR | Adicionar `markExpired()` |
| `src/modules/proof-session/app/get_proof_session_viewmodel.ts` | MODIFICAR | Redefinir `ProofSessionOutputDTO` com campos corretos |
| `src/modules/proof-session/app/get_proof_session_usecase.ts` | MODIFICAR | Usar `findByTokenHashWithContext`, remover `markOpened`, adicionar lógica de expiração |

**NÃO alterar:**
- `app/api/proof-sessions/[sessionToken]/route.ts` — já correto
- `src/modules/proof-session/app/get_proof_session_controller.ts` — já correto
- `src/modules/proof-session/app/get_proof_session_presenter.ts` — já correto
- `src/shared/middleware.ts` — já classifica a rota como pública

### References

- [Epics: Story 4.1 AC](_bmad-output/planning-artifacts/epics.md#story-41-endpoint-público-de-status-da-sessão)
- [Architecture: Tela Coringa de Verificação](_bmad-output/planning-artifacts/architecture.md)
- [Architecture: Schema — proof_sessions, proof_requests, company_apps, company](_bmad-output/planning-artifacts/architecture.md#schema-do-banco-de-dados)
- [Use case existente: src/modules/proof-session/app/get_proof_session_usecase.ts](src/modules/proof-session/app/get_proof_session_usecase.ts)
- [Viewmodel existente: src/modules/proof-session/app/get_proof_session_viewmodel.ts](src/modules/proof-session/app/get_proof_session_viewmodel.ts)
- [ProofSession entity: src/shared/domain/entities/ProofSession.ts](src/shared/domain/entities/ProofSession.ts)
- [ProofSessionRepository interface: src/shared/domain/interfaces/repositories/ProofSessionRepository.ts](src/shared/domain/interfaces/repositories/ProofSessionRepository.ts)
- [SupabaseProofSessionRepository: src/shared/infra/repositories/SupabaseProofSessionRepository.ts](src/shared/infra/repositories/SupabaseProofSessionRepository.ts)
- [API route: app/api/proof-sessions/[sessionToken]/route.ts](app/api/proof-sessions/[sessionToken]/route.ts)
- [Middleware: src/shared/middleware.ts](src/shared/middleware.ts)
- [Story 3.1 (prova do padrão de repositório com join): _bmad-output/implementation-artifacts/stories/3-1-endpoint-b2b-criacao-de-proof-request.md](_bmad-output/implementation-artifacts/stories/3-1-endpoint-b2b-criacao-de-proof-request.md)

## Senior Developer Review (AI)

**Outcome:** Changes Requested (2 patches aplicados)
**Data:** 2026-06-09

### Action Items

- [x] [Review][Patch] `as any` substituído por tipo estruturado `JoinedRow` no `findByTokenHashWithContext` [SupabaseProofSessionRepository.ts]
- [x] [Review][Patch] `returnUrl ?? null` redundante removido do use case [get_proof_session_usecase.ts]
- [x] [Review][Defer] Race condition em expiração concorrente — baixo risco no MVP — deferred, pre-existing
- [x] [Review][Defer] `ACTIVE_STATUSES` no use case duplica lógica de `TERMINAL_STATUSES` na entidade — refactor futuro — deferred
- [x] [Review][Defer] Join FK name dependente de convenção Supabase — validado em runtime — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- `src/shared/domain/entities/ProofSession.ts` atualizado: adicionado `markExpired()` com guard de `TERMINAL_STATUSES`; `markOpened()` preservado para Story 5.3
- `src/shared/domain/interfaces/repositories/ProofSessionRepository.ts` atualizado: adicionado tipo `ProofSessionWithContext` e método `findByTokenHashWithContext`
- `src/shared/infra/repositories/SupabaseProofSessionRepository.ts` atualizado: implementado `findByTokenHashWithContext` com join `proof_session → proof_request → company_app → company`; tipo `JoinedRow` explícito sem `as any`
- `src/modules/proof-session/app/get_proof_session_viewmodel.ts` atualizado: `ProofSessionOutputDTO` redefinido com `{ status, proofType, companyName, expiresAt, returnUrl }` — campos internos removidos
- `src/modules/proof-session/app/get_proof_session_usecase.ts` atualizado: usa `findByTokenHashWithContext`; remove `markOpened`; adiciona lógica de expiração; retorna DTO correto
- Diagnósticos TypeScript: zero erros em todos os arquivos modificados
- Testes: 244/252 passando; 8 falhas pré-existentes (npx ENOENT + Windows path separator)
- 29 novos testes cobrindo todos os 4 ACs

### File List

**Modificados:**
- `src/shared/domain/entities/ProofSession.ts`
- `src/shared/domain/interfaces/repositories/ProofSessionRepository.ts`
- `src/shared/infra/repositories/SupabaseProofSessionRepository.ts`
- `src/modules/proof-session/app/get_proof_session_viewmodel.ts`
- `src/modules/proof-session/app/get_proof_session_usecase.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Criados:**
- `_bmad-output/implementation-artifacts/stories/4-1-endpoint-publico-de-status-da-sessao.md`
- `tests/unit/story-4-1/get-proof-session.test.mjs`
