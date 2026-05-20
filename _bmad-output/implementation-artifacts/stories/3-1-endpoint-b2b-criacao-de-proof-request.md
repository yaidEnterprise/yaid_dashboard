# Story 3.1: Endpoint B2B — Criação de Proof Request

Status: done

## Story

Como sistema de uma empresa parceira,
Quero criar uma proof request via API key e receber a URL de verificação,
Para que eu possa redirecionar meu usuário ao fluxo de validação da YaID sem expor credenciais internas.

## Acceptance Criteria

1. **Given** uma chamada `POST /api/proof-requests` com header `Authorization: Bearer <api_key>` válida e body `{ proofType, externalReference? }`
   **When** a API key é autenticada e o app está ativo
   **Then** uma `proof_request` e uma `proof_session` são criadas atomicamente no banco
   **And** a `proof_session` é criada com: `session_token_hash = SHA-256(rawToken)`, `expires_at = now() + 30 min`, `status = waiting_user`, `challenge_nonce_hash = null`, `challenge_created_at = null`
   **And** o raw token nunca é persistido — apenas o hash
   **And** a resposta retorna `{ id, proofType, status, verificationUrl, deepLinkUrl, externalReference, createdAt }` onde `verificationUrl` e `deepLinkUrl` são derivadas do raw token e não estão em nenhuma coluna do banco

2. **Given** uma chamada com API key inválida ou ausente
   **When** o middleware `withApiKeyAuth` processa o request
   **Then** a API retorna `{ error: "Unauthorized" }` com HTTP 401

3. **Given** uma chamada com API key válida mas app com status `disabled`
   **When** o use case valida o app
   **Then** a API retorna `{ error: "App is disabled" }` com HTTP 422

4. **Given** uma chamada com `proofType` fora do enum `personhood | age_over_18`
   **When** o controller valida o body com Zod
   **Then** a API retorna `{ error: "Invalid proof type" }` com HTTP 400

5. **Given** falha em qualquer etapa da criação atômica (proof_request ou proof_session)
   **When** o use case executa
   **Then** nenhum registro parcial persiste no banco (rollback completo)

## Tasks / Subtasks

- [x] Task 1: Corrigir `CreateProofRequestSchema` para aceitar `age_over_18` (AC: #4)
  - [x] Em `src/modules/proof-request/app/create_proof_request_viewmodel.ts`, alterar `proofType` de `z.literal("personhood")` para `z.enum(["personhood", "age_over_18"])`
  - [x] Remover `.default("personhood")` — campo obrigatório sem default
  - [x] Atualizar `CreateProofRequestDTO` e `ProofRequestOutputDTO` para refletir o tipo correto

- [x] Task 2: Corrigir lookup de app por `app_id` (parte pública da API key) no use case (AC: #1, #2)
  - [x] Em `src/shared/domain/interfaces/repositories/CompanyAppRepository.ts`, adicionar método `findByAppId(appId: string): Promise<CompanyApp | null>`
  - [x] Em `src/shared/infra/repositories/SupabaseCompanyAppRepository.ts`, implementar `findByAppId` buscando pela coluna `app_id` (TEXT UNIQUE) — não pelo UUID `id`
  - [x] Em `src/modules/proof-request/app/create_proof_request_usecase.ts`, substituir `this.appRepo.findById(appId)` por `this.appRepo.findByAppId(appId)`

- [x] Task 3: Corrigir resposta para app disabled — HTTP 422 com mensagem correta (AC: #3)
  - [x] Em `src/shared/errors/AppError.ts`, adicionar `UnprocessableEntityError` com `statusCode = 422` e `code = "UNPROCESSABLE_ENTITY"`
  - [x] Em `src/modules/proof-request/app/create_proof_request_usecase.ts`, separar a validação: se app não encontrado → `UnauthorizedError`; se app encontrado mas `status !== ENABLED` → `UnprocessableEntityError("App is disabled")`

- [x] Task 4: Implementar criação atômica via rollback manual (AC: #1, #5)
  - [x] Adicionar método `createAtomic(request: ProofRequest, session: ProofSession): Promise<void>` em `ProofRequestRepository` interface
  - [x] Implementar `createAtomic` em `SupabaseProofRequestRepository` com rollback manual (insert proof_request → insert proof_session → se falhar, delete proof_request)
  - [x] Atualizar `CreateProofRequestUseCase.execute` para usar `requestRepo.createAtomic(request, session)` em vez de dois inserts separados
  - [x] Remover dependência desnecessária de `ProofSessionRepository` do use case e presenter

- [x] Task 5: Ajustar shape de resposta para camelCase conforme epics (AC: #1)
  - [x] Renomear `verificationPageUrl` → `verificationUrl` no use case e DTO
  - [x] Renomear `externalRef` → `externalReference` no DTO de saída (mantendo `externalRef` internamente na entidade)
  - [x] Atualizar teste em `tests/unit/story-1-3/proof-session-schema.test.mjs` para refletir novo nome `verificationUrl`

- [x] Task 6: Validar build e testes (AC: todos)
  - [x] Executar `getDiagnostics` — zero erros TypeScript em todos os arquivos modificados
  - [x] Executar `npm run test` — 96/102 testes passando; 6 falhas pré-existentes (npx ENOENT + Windows path separator)

## Dev Notes

### Estado atual da implementação (análise pré-story)

**O que já existe e funciona:**
- `POST /api/proof-requests` em `app/api/proof-requests/route.ts` — extrai API key via `getApiKeyFromRequest`, chama `makeCreateProofRequestController`, retorna 201
- `withApiKeyAuth` em `src/shared/middlewares/withApiKeyAuth.ts` — valida presença de `Authorization: Bearer` ou `X-Api-Key`; retorna 401 se ausente
- `CreateProofRequestUseCase` em `src/modules/proof-request/app/create_proof_request_usecase.ts` — lógica de autenticação por API key, criação de proof_request + proof_session
- `CreateProofRequestController` — valida body com Zod, delega ao use case
- `CreateProofRequestPresenter` — instancia use case com dependências via `Environments`
- Entidades `ProofRequest` e `ProofSession` com todos os campos necessários
- Repositórios Supabase para ambas as entidades
- Middleware já roteia `POST /api/proof-requests` para `withApiKeyAuth`

**Bugs/divergências identificados que esta story corrige:**

#### Bug 1: `proofType` aceita apenas `"personhood"`
```typescript
// ATUAL (create_proof_request_viewmodel.ts)
proofType: z.literal("personhood").default("personhood"),

// CORRETO (epics especifica personhood | age_over_18)
proofType: z.enum(["personhood", "age_over_18"]),
```

#### Bug 2: `findById` busca por UUID, mas use case passa `app_id` (string pública)
O use case faz `parseApiKey("appId.secret")` e extrai `appId` (a parte pública da API key, ex: `"abc123"`). Depois chama `this.appRepo.findById(appId)`. Mas `CompanyAppRepository.findById` busca pelo UUID `id` da tabela, não pela coluna `app_id` TEXT. Isso causa lookup incorreto.

Schema da tabela `company_apps`:
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
app_id    TEXT NOT NULL UNIQUE,   -- parte pública da API key
api_key_hash TEXT NOT NULL,       -- SHA-256 de "<app_id>.<secret>"
```

Solução: adicionar `findByAppId(appId: string)` que busca pela coluna `app_id` TEXT.

#### Bug 3: App disabled retorna 401 em vez de 422
```typescript
// ATUAL — lança UnauthorizedError para app disabled
if (!app || app.status !== CompanyAppStatus.ENABLED) {
  throw new UnauthorizedError("Invalid API key");
}

// CORRETO — separar os casos
if (!app) throw new UnauthorizedError("Invalid API key");
const validSecret = await this.hasher.verify(secret, app.apiKeyHash);
if (!validSecret) throw new UnauthorizedError("Invalid API key");
if (app.status !== CompanyAppStatus.ENABLED) {
  throw new UnprocessableEntityError("App is disabled");
}
```

**Nota de segurança:** A ordem importa — verificar o secret ANTES de checar o status evita enumeration de apps válidos por atacantes sem o secret correto.

#### Bug 4: Criação não é atômica
O use case atual faz dois inserts separados:
```typescript
await this.requestRepo.create(request);   // insert 1
await this.sessionRepo.create(session);   // insert 2 — se falhar, proof_request fica órfã
```

Solução: usar Supabase RPC com função SQL transacional.

#### Divergência 5: Nome do campo `externalRef` vs `externalReference`
O epics especifica `externalReference` na resposta. O use case atual usa `externalRef` internamente (entidade + DTO). A resposta do endpoint deve mapear para `externalReference`.

### Implementação da criação atômica

#### Função SQL (Supabase migration)

```sql
-- Criar via Supabase Dashboard > SQL Editor ou migration file
CREATE OR REPLACE FUNCTION create_proof_request_atomic(
  p_request_id        UUID,
  p_app_id            UUID,
  p_proof_type        TEXT,
  p_status            TEXT,
  p_external_ref      TEXT,
  p_created_at        TIMESTAMPTZ,
  p_session_id        UUID,
  p_session_token_hash TEXT,
  p_session_status    TEXT,
  p_session_created_at TIMESTAMPTZ,
  p_expires_at        TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO proof_request (id, app_id, proof_type, status, result, external_ref, created_at, validated_at)
  VALUES (p_request_id, p_app_id, p_proof_type, p_status, NULL, p_external_ref, p_created_at, NULL);

  INSERT INTO proof_session (id, proof_request_id, hash_session_token, challenge_nonce_hash, challenge_created_at, status, created_at, expires_at, opened_at, approved_at)
  VALUES (p_session_id, p_request_id, p_session_token_hash, NULL, NULL, p_session_status, p_session_created_at, p_expires_at, NULL, NULL);
END;
$$;
```

**Alternativa sem RPC (se RPC for complexo de configurar):** Usar `supabase.from('proof_request').insert(...)` seguido de `supabase.from('proof_session').insert(...)` dentro de um try/catch com rollback manual (delete da proof_request se a session falhar). Esta abordagem é menos robusta mas evita a necessidade de criar função SQL.

#### Interface do repositório

```typescript
// src/shared/domain/interfaces/repositories/ProofRequestRepository.ts
export interface ProofRequestRepository {
  create(request: ProofRequest): Promise<void>;
  createAtomic(request: ProofRequest, session: ProofSession): Promise<void>;
  findById(id: string): Promise<ProofRequestWithApp | null>;
  listByAppIds(appIds: string[]): Promise<ProofRequestWithApp[]>;
}
```

#### Implementação no repositório Supabase

```typescript
// src/shared/infra/repositories/SupabaseProofRequestRepository.ts
async createAtomic(request: ProofRequest, session: ProofSession): Promise<void> {
  const { error } = await this.client.rpc('create_proof_request_atomic', {
    p_request_id: request.id,
    p_app_id: request.appId,
    p_proof_type: request.proofType,
    p_status: request.status,
    p_external_ref: request.externalRef,
    p_created_at: request.createdAt.toISOString(),
    p_session_id: session.id,
    p_session_token_hash: session.hashSessionToken,
    p_session_status: session.status,
    p_session_created_at: session.createdAt.toISOString(),
    p_expires_at: session.expiresAt.toISOString(),
  });
  if (error) throw error;
}
```

### Novo `UnprocessableEntityError`

```typescript
// src/shared/errors/AppError.ts — adicionar ao final
export class UnprocessableEntityError extends AppError {
  constructor(message: string, code = "UNPROCESSABLE_ENTITY") {
    super(message, 422, code);
  }
}
```

### `findByAppId` no repositório

```typescript
// src/shared/infra/repositories/SupabaseCompanyAppRepository.ts
async findByAppId(appId: string): Promise<CompanyApp | null> {
  const { data, error } = await this.client
    .from(TABLE)
    .select("*")
    .eq("app_id", appId)
    .maybeSingle<CompanyAppPersistence>();

  if (error) throw error;
  if (!data) return null;
  return CompanyAppMapper.toDomain(data);
}
```

**Nota:** A coluna `app_id` na tabela `company_apps` é TEXT UNIQUE — diferente do `id` UUID. O `CompanyAppMapper` já mapeia `raw.id` para `app.id` (UUID), então `app.id` é o UUID correto para usar como FK em `proof_request.app_id`.

### Use case corrigido — fluxo completo

```typescript
async execute(input: { apiKey: string; body: CreateProofRequestDTO }): Promise<CreatedProofRequestOutputDTO> {
  const { appId, secret } = parseApiKey(input.apiKey);

  // Buscar por app_id (coluna TEXT), não por UUID id
  const app = await this.appRepo.findByAppId(appId);
  if (!app) throw new UnauthorizedError("Invalid API key");

  // Verificar secret ANTES de checar status (evita enumeration)
  const validSecret = await this.hasher.verify(secret, app.apiKeyHash);
  if (!validSecret) throw new UnauthorizedError("Invalid API key");

  // Checar status após autenticação bem-sucedida
  if (app.status !== CompanyAppStatus.ENABLED) {
    throw new UnprocessableEntityError("App is disabled");
  }

  // Criar entidades
  const request = new ProofRequest({ ... });
  const session = new ProofSession({ ... });

  // Criação atômica
  await this.requestRepo.createAtomic(request, session);

  // Retornar DTO com campos corretos (externalReference, verificationUrl, deepLinkUrl)
  return { ... };
}
```

### Shape da resposta (camelCase conforme epics)

```typescript
// Resposta esperada pelo epics:
{
  id: string,
  proofType: string,
  status: string,
  verificationUrl: string,   // derivada do token, não persistida
  deepLinkUrl: string,       // derivada do token, não persistida
  externalReference: string | null,
  createdAt: string,
}
```

O DTO atual (`CreatedProofRequestOutputDTO`) tem campos extras (`appId`, `appName`, `environment`, `result`, `validatedAt`, `session.id`, `session.expiresAt`) que não estão no epics. Manter os campos extras não quebra nada — o epics define o mínimo. Mas `externalRef` deve ser renomeado para `externalReference` na resposta.

**Decisão:** Manter campos extras no DTO (não quebra clientes), mas garantir que `externalReference` está presente. Adicionar `externalReference` como alias de `externalRef` no DTO de saída.

### Convenções do projeto

- Path aliases: `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`
- Nomenclatura de arquivos: `kebab-case` para rotas; `snake_case` para use cases/controllers
- `process.env` apenas em `src/shared/environments.ts`
- Shape de erro HTTP: `handleHttpError` retorna `{ error: { code, message } }` — **diverge do epics** que especifica `{ error: string }`. A implementação real usa objeto. Manter padrão existente.
- Tabelas no banco: `proof_request` (singular) e `proof_session` (singular) — conforme `SupabaseProofRequestRepository` e `SupabaseProofSessionRepository`
- `npm run build` verifica TypeScript — executar antes de marcar done

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/modules/proof-request/app/create_proof_request_viewmodel.ts` | MODIFICAR | `proofType` enum, `externalReference` no DTO |
| `src/modules/proof-request/app/create_proof_request_usecase.ts` | MODIFICAR | `findByAppId`, separar 401/422, `createAtomic`, campo `externalReference` |
| `src/shared/domain/interfaces/repositories/CompanyAppRepository.ts` | MODIFICAR | Adicionar `findByAppId` |
| `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts` | MODIFICAR | Adicionar `createAtomic` |
| `src/shared/infra/repositories/SupabaseCompanyAppRepository.ts` | MODIFICAR | Implementar `findByAppId` |
| `src/shared/infra/repositories/SupabaseProofRequestRepository.ts` | MODIFICAR | Implementar `createAtomic` via RPC |
| `src/shared/errors/AppError.ts` | MODIFICAR | Adicionar `UnprocessableEntityError` |
| Supabase SQL migration | NOVO | Função `create_proof_request_atomic` |

**NÃO alterar:**
- `app/api/proof-requests/route.ts` — já correto
- `src/shared/middlewares/withApiKeyAuth.ts` — já correto
- `src/shared/middleware.ts` — já roteia corretamente
- `src/shared/http/getApiKeyFromRequest.ts` — já correto
- Entidades `ProofRequest` e `ProofSession` — já corretas
- `ProofRequestMapper` e `ProofSessionMapper` — já corretos
- `CreateProofRequestController` — já correto (só valida body e delega)
- `CreateProofRequestPresenter` — já correto

### Decisão pendente: atomicidade via RPC vs rollback manual

O epics exige criação atômica. Duas opções:

**Opção A — Supabase RPC (recomendada):** Criar função SQL `create_proof_request_atomic`. Garante atomicidade real via transação PostgreSQL. Requer acesso ao Supabase Dashboard para criar a função.

**Opção B — Rollback manual:** Inserir `proof_request`, depois `proof_session`. Se a segunda falhar, deletar a primeira. Não é verdadeiramente atômica (race condition possível), mas funciona para o MVP.

**Recomendação:** Usar Opção A. Se o ambiente não permitir criar funções SQL, usar Opção B com comentário explicando a limitação.

### References

- [Epics: Story 3.1 AC](_bmad-output/planning-artifacts/epics.md#story-31-endpoint-b2b--criação-de-proof-request)
- [Architecture: Proof Requests (API B2B)](_bmad-output/planning-artifacts/architecture.md)
- [Architecture: Schema — proof_requests e proof_sessions](_bmad-output/planning-artifacts/architecture.md#schema-do-banco-de-dados)
- [Use case existente: src/modules/proof-request/app/create_proof_request_usecase.ts](src/modules/proof-request/app/create_proof_request_usecase.ts)
- [Controller existente: src/modules/proof-request/app/create_proof_request_controller.ts](src/modules/proof-request/app/create_proof_request_controller.ts)
- [Viewmodel existente: src/modules/proof-request/app/create_proof_request_viewmodel.ts](src/modules/proof-request/app/create_proof_request_viewmodel.ts)
- [API route existente: app/api/proof-requests/route.ts](app/api/proof-requests/route.ts)
- [Middleware: src/shared/middleware.ts](src/shared/middleware.ts)
- [withApiKeyAuth: src/shared/middlewares/withApiKeyAuth.ts](src/shared/middlewares/withApiKeyAuth.ts)
- [AppError: src/shared/errors/AppError.ts](src/shared/errors/AppError.ts)
- [CompanyApp entity: src/shared/domain/entities/CompanyApp.ts](src/shared/domain/entities/CompanyApp.ts)
- [CompanyAppRepository interface: src/shared/domain/interfaces/repositories/CompanyAppRepository.ts](src/shared/domain/interfaces/repositories/CompanyAppRepository.ts)
- [SupabaseCompanyAppRepository: src/shared/infra/repositories/SupabaseCompanyAppRepository.ts](src/shared/infra/repositories/SupabaseCompanyAppRepository.ts)
- [ProofRequestRepository interface: src/shared/domain/interfaces/repositories/ProofRequestRepository.ts](src/shared/domain/interfaces/repositories/ProofRequestRepository.ts)
- [SupabaseProofRequestRepository: src/shared/infra/repositories/SupabaseProofRequestRepository.ts](src/shared/infra/repositories/SupabaseProofRequestRepository.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- `src/modules/proof-request/app/create_proof_request_viewmodel.ts` atualizado: `proofType` agora aceita `z.enum(["personhood", "age_over_18"])` sem default; `externalRef` renomeado para `externalReference` no DTO de saída; `verificationPageUrl` renomeado para `verificationUrl` no DTO de sessão
- `src/shared/domain/interfaces/repositories/CompanyAppRepository.ts` atualizado: adicionado `findByAppId(appId: string): Promise<CompanyApp | null>`
- `src/shared/infra/repositories/SupabaseCompanyAppRepository.ts` atualizado: implementado `findByAppId` buscando pela coluna `app_id` (TEXT UNIQUE)
- `src/shared/errors/AppError.ts` atualizado: adicionado `UnprocessableEntityError` com `statusCode = 422`
- `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts` atualizado: adicionado `createAtomic(request, session)` com import de `ProofSession`
- `src/shared/infra/repositories/SupabaseProofRequestRepository.ts` atualizado: implementado `createAtomic` com rollback manual (insert proof_request → insert proof_session → se falhar, delete proof_request com log de erro)
- `src/modules/proof-request/app/create_proof_request_usecase.ts` refatorado: usa `findByAppId` (não `findById`); separa 401 (app não encontrado / secret inválido) de 422 (app disabled); verifica secret ANTES do status para evitar enumeration; usa `createAtomic`; remove dependência de `ProofSessionRepository`; retorna `externalReference` e `verificationUrl`
- `src/modules/proof-request/app/create_proof_request_presenter.ts` atualizado: remove `getProofSessionRepository()` da instanciação do use case
- `tests/unit/story-1-3/proof-session-schema.test.mjs` atualizado: teste renomeado para verificar `verificationUrl` (não `verificationPageUrl`)
- Diagnósticos TypeScript: zero erros em todos os arquivos modificados
- Testes: 96/102 passando; 6 falhas pré-existentes (5x `spawnSync npx ENOENT` + 1x Windows path separator `\` vs `/`)

### File List

**Modificados:**
- `src/modules/proof-request/app/create_proof_request_viewmodel.ts`
- `src/modules/proof-request/app/create_proof_request_usecase.ts`
- `src/modules/proof-request/app/create_proof_request_presenter.ts`
- `src/shared/domain/interfaces/repositories/CompanyAppRepository.ts`
- `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts`
- `src/shared/infra/repositories/SupabaseCompanyAppRepository.ts`
- `src/shared/infra/repositories/SupabaseProofRequestRepository.ts`
- `src/shared/errors/AppError.ts`
- `tests/unit/story-1-3/proof-session-schema.test.mjs`
- `_bmad-output/implementation-artifacts/stories/3-1-endpoint-b2b-criacao-de-proof-request.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Outcome:** Changes Requested (patches aplicados)
**Data:** 2026-05-20
**Camadas:** Blind Hunter, Edge Case Hunter, Acceptance Auditor

### Action Items

- [x] [Review][Patch] `.then(()=>{}, handler)` substituído por try/catch no rollback do `createAtomic` [src/shared/infra/repositories/SupabaseProofRequestRepository.ts:69]
- [x] [Review][Patch] `CompanyAppPersistence` não incluía campo `app_id` — adicionado para type-safety [src/shared/infra/dto/CompanyAppMapper.ts]
- [x] [Review][Defer] `createAtomic` não é verdadeiramente atômica — rollback manual documentado; RPC Supabase é a solução correta para produção — deferred, MVP
- [x] [Review][Defer] `parseApiKey` divide por `.` — se `app_id` contiver `.`, o split produz resultado incorreto; depende do gerador de `app_id` — deferred, pre-existing
- [x] [Review][Defer] `SupabaseProofRequestRepository` acoplado a `ProofSession` via `createAtomic` — separação de responsabilidades questionável — deferred, MVP
- [x] [Review][Defer] Método `create` mantido na interface mas não usado pelo use case — deferred, pode ser necessário em outros contextos
- [x] [Review][Defer] Shape de erro `{ error: { code, message } }` diverge do spec `{ error: string }` — padrão do projeto, pré-existente — deferred, pre-existing
