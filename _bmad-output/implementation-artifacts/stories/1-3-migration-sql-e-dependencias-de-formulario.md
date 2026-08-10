# Story 1.3: Migration SQL e Dependências de Formulário

Status: done

## Story

Como desenvolvedor,
Quero aplicar as migrações de schema e instalar as dependências de formulário necessárias,
Para que o banco esteja correto e os formulários do dashboard possam usar validação tipada via React Hook Form + Zod.

## Acceptance Criteria

1. **Given** o banco de dados Supabase do projeto
   **When** a migration SQL é aplicada
   **Then** as colunas `verification_page_url` e `deep_link_url` são removidas da tabela `proof_sessions`
   **And** as colunas `challenge_nonce_hash TEXT` (nullable) e `challenge_created_at TIMESTAMPTZ` (nullable) são adicionadas à tabela `proof_sessions`
   **And** os dados existentes são preservados (migration não-destrutiva para dados existentes nas demais colunas)

2. **Given** o `package.json` do projeto
   **When** as dependências são instaladas
   **Then** `react-hook-form` e `@hookform/resolvers` estão listados como dependências
   **And** `npm run build` completa sem erros após a instalação

3. **Given** qualquer formulário existente na codebase (login, signup, criação de app)
   **When** revisado após esta story
   **Then** mantém seu comportamento atual — nenhum formulário existente precisa ser migrado nesta story (a adoção de React Hook Form é incremental, feita story a story)

## Tasks / Subtasks

- [x] Task 1: Criar arquivo de migration SQL (AC: #1)
  - [x] Criar pasta `supabase/migrations/` na raiz do projeto (se não existir)
  - [x] Criar arquivo `supabase/migrations/20260513_update_proof_sessions.sql` com as operações de schema
  - [x] Aplicar a migration manualmente via Supabase Dashboard (SQL Editor) — **AÇÃO MANUAL NECESSÁRIA:** executar o SQL no Supabase Dashboard antes do próximo deploy

- [x] Task 2: Atualizar entidade `ProofSession` (AC: #2)
  - [x] Remover propriedades `verificationPageUrl: string` e `deepLinkUrl: string` de `ProofSessionProps`
  - [x] Remover getters `get verificationPageUrl()` e `get deepLinkUrl()`
  - [x] Adicionar propriedades `challengeNonceHash: string | null` e `challengeCreatedAt: Date | null`
  - [x] Adicionar getters correspondentes

- [x] Task 3: Atualizar `ProofSessionMapper` (AC: #2)
  - [x] Remover `verification_page_url: string` e `deep_link_url: string` de `ProofSessionPersistence`
  - [x] Adicionar `challenge_nonce_hash: string | null` e `challenge_created_at: string | null` a `ProofSessionPersistence`
  - [x] Atualizar `toDomain()` para mapear os novos campos e remover os antigos
  - [x] Atualizar `toPersistence()` para mapear os novos campos e remover os antigos

- [x] Task 4: Atualizar `create_proof_request_usecase.ts` (AC: #2)
  - [x] Remover `verificationPageUrl` e `deepLinkUrl` do construtor de `ProofSession`
  - [x] Adicionar `challengeNonceHash: null` e `challengeCreatedAt: null` ao construtor
  - [x] Manter as variáveis locais `verificationPageUrl` e `deepLinkUrl` — continuam sendo computadas e retornadas na resposta da API (não persistidas)

- [x] Task 5: Atualizar viewmodel e use case do GET /api/proof-sessions/{token} (AC: #2)
  - [x] Remover `verificationPageUrl` e `deepLinkUrl` de `ProofSessionOutputDTO` em `get_proof_session_viewmodel.ts`
  - [x] Remover as propriedades do objeto retornado em `get_proof_session_usecase.ts`

- [x] Task 6: Instalar dependências de formulário (AC: #2, #3)
  - [x] Executar `npm install react-hook-form @hookform/resolvers`
  - [x] Verificar que ambas aparecem em `dependencies` no `package.json`
  - [x] Executar `npm run build` e confirmar zero erros TypeScript

### Review Findings

- [x] [Review][Patch] Tela coringa usa `session.deepLinkUrl` que agora é `undefined` — regressão de runtime [app/v/[sessionToken]/page.tsx:166]
- [x] [Review][Patch] `SupabaseProofSessionRepository.update()` não persiste `challenge_nonce_hash`/`challenge_created_at` — drop silencioso em stories futuras [src/shared/infra/repositories/SupabaseProofSessionRepository.ts]
- [x] [Review][Defer] Sem método `setChallenge()` na entidade `ProofSession` — Story 5.3 implementa a lógica de challenge [src/shared/domain/entities/ProofSession.ts] — deferred, pre-existing
- [x] [Review][Defer] `ProofSessionOutputDTO.status` como string literal em vez do enum `ProofSessionStatus` — divergência que crescerá ao adicionar status [src/modules/proof-session/app/get_proof_session_viewmodel.ts] — deferred, pre-existing
- [x] [Review][Defer] Verificação de expiração duplicada em `get_proof_session_usecase.ts` (dois `Date.now()` separados) — lógica de expiração pertence à entidade [src/modules/proof-session/app/get_proof_session_usecase.ts] — deferred, pre-existing
- [x] [Review][Defer] `@hookform/resolvers@^5.2.2` pode ter conflito de peer dep com `react-hook-form@7` quando primeiro formulário for implementado — verificar compatibilidade na Story 1.5 [package.json] — deferred, pre-existing
- [x] [Review][Defer] `challenge_created_at` sem guarda contra string de data inválida em `ProofSessionMapper.toDomain()` — dados vêm do banco, confiados [src/shared/infra/dto/ProofSessionMapper.ts] — deferred, pre-existing

## Dev Notes

### Escopo crítico: migration é mais que SQL

A migration remove colunas que estão mapeadas em TypeScript. O código **atual** referencia `verification_page_url` e `deep_link_url` em quatro arquivos — se apenas o SQL for atualizado sem atualizar o TypeScript, o `create` do repositório tentará inserir colunas inexistentes e falhará em runtime.

**Nunca persistir** `verificationPageUrl` e `deepLinkUrl` — elas são derivadas do token bruto em tempo de execução (use case) e retornadas na resposta da API B2B, mas não devem existir no banco (conforme arquitetura).

### SQL da migration

```sql
-- supabase/migrations/20260513_update_proof_sessions.sql

ALTER TABLE proof_sessions
  DROP COLUMN IF EXISTS verification_page_url,
  DROP COLUMN IF EXISTS deep_link_url,
  ADD COLUMN IF NOT EXISTS challenge_nonce_hash TEXT,
  ADD COLUMN IF NOT EXISTS challenge_created_at TIMESTAMPTZ;
```

Executar via **Supabase Dashboard → SQL Editor** (sem versionamento no MVP).

### Arquivos a modificar — mapeamento exato

| Arquivo | Mudança |
|---------|---------|
| `src/shared/domain/entities/ProofSession.ts` | Remover `verificationPageUrl`/`deepLinkUrl`; adicionar `challengeNonceHash`/`challengeCreatedAt` |
| `src/shared/infra/dto/ProofSessionMapper.ts` | Atualizar `ProofSessionPersistence` type e os dois métodos |
| `src/modules/proof-request/app/create_proof_request_usecase.ts` | Atualizar construtor do `ProofSession`; manter vars locais para resposta |
| `src/modules/proof-session/app/get_proof_session_viewmodel.ts` | Remover campos do DTO de saída |
| `src/modules/proof-session/app/get_proof_session_usecase.ts` | Remover campos do objeto retornado |

**NÃO alterar:**
- `src/modules/proof-request/app/create_proof_request_viewmodel.ts` — o tipo `CreatedProofRequestOutputDTO` mantém `session.verificationPageUrl` e `session.deepLinkUrl` porque a API B2B ainda os retorna na resposta
- Qualquer arquivo de teste existente (Story 1.1 e 1.2) — zero regressão esperada

### Estado atual do `ProofSession.ts` (antes)

```typescript
type ProofSessionProps = {
  id: string;
  proofRequestId: string;
  hashSessionToken: string;
  verificationPageUrl: string;  // ← REMOVER
  deepLinkUrl: string;          // ← REMOVER
  status: ProofSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  openedAt: Date | null;
  approvedAt: Date | null;
};
```

### Estado esperado do `ProofSession.ts` (depois)

```typescript
type ProofSessionProps = {
  id: string;
  proofRequestId: string;
  hashSessionToken: string;
  challengeNonceHash: string | null;  // ← NOVO
  challengeCreatedAt: Date | null;    // ← NOVO
  status: ProofSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  openedAt: Date | null;              // manter
  approvedAt: Date | null;            // manter
};
```

### Estado atual de `ProofSessionPersistence` (antes)

```typescript
export type ProofSessionPersistence = {
  id: string;
  proof_request_id: string;
  hash_session_token: string;
  verification_page_url: string;  // ← REMOVER
  deep_link_url: string;          // ← REMOVER
  status: string;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  approved_at: string | null;
};
```

### Estado esperado de `ProofSessionPersistence` (depois)

```typescript
export type ProofSessionPersistence = {
  id: string;
  proof_request_id: string;
  hash_session_token: string;
  challenge_nonce_hash: string | null;  // ← NOVO
  challenge_created_at: string | null;  // ← NOVO
  status: string;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  approved_at: string | null;
};
```

### Mudança crítica no `create_proof_request_usecase.ts`

```typescript
// ANTES — passa para ProofSession (errado: não deve persistir)
const session = new ProofSession({
  id: randomUUID(),
  proofRequestId: request.id,
  hashSessionToken: tokenHash,
  verificationPageUrl,   // ← REMOVER DO CONSTRUTOR
  deepLinkUrl,           // ← REMOVER DO CONSTRUTOR
  status: ProofSessionStatus.WAITING_USER,
  createdAt: new Date(),
  expiresAt,
  openedAt: null,
  approvedAt: null,
});

// DEPOIS — ProofSession não armazena mais as URLs
const session = new ProofSession({
  id: randomUUID(),
  proofRequestId: request.id,
  hashSessionToken: tokenHash,
  challengeNonceHash: null,   // ← ADICIONAR
  challengeCreatedAt: null,   // ← ADICIONAR
  status: ProofSessionStatus.WAITING_USER,
  createdAt: new Date(),
  expiresAt,
  openedAt: null,
  approvedAt: null,
});
// verificationPageUrl e deepLinkUrl continuam sendo retornadas na response
// via as variáveis locais já existentes — não mudar o objeto de retorno
```

### Mudança no `get_proof_session_viewmodel.ts`

```typescript
// ANTES
export type ProofSessionOutputDTO = {
  id: string;
  proofRequestId: string;
  verificationPageUrl: string;  // ← REMOVER
  deepLinkUrl: string;          // ← REMOVER
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  approvedAt: string | null;
};

// DEPOIS
export type ProofSessionOutputDTO = {
  id: string;
  proofRequestId: string;
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  approvedAt: string | null;
};
```

### Mudança no `get_proof_session_usecase.ts`

Remover `verificationPageUrl` e `deepLinkUrl` do objeto retornado:

```typescript
// ANTES
return {
  id: session.id,
  proofRequestId: session.proofRequestId,
  verificationPageUrl: session.verificationPageUrl,  // ← REMOVER
  deepLinkUrl: session.deepLinkUrl,                  // ← REMOVER
  status: ...,
  createdAt: ...,
  ...
};

// DEPOIS — sem as URLs
return {
  id: session.id,
  proofRequestId: session.proofRequestId,
  status: ...,
  createdAt: ...,
  ...
};
```

### Regressão esperada: zero

- A lógica `markOpened()` na entidade `ProofSession` não muda.
- O método `update()` do `SupabaseProofSessionRepository` atualiza `status`, `opened_at`, `approved_at` — continua funcionando (esses campos permanecem).
- O `SupabaseProofSessionRepository.create()` chama `ProofSessionMapper.toPersistence()` — após remover os campos antigos do mapper, o insert ficará correto.
- Testes existentes (Stories 1.1, 1.2) não testam `ProofSession` diretamente — sem regressão esperada.

### Convenções do projeto (aprendizados da Story 1.1 e 1.2)

- Path alias `@/shared/*` → `src/shared/*` funcionando — usar para imports
- Nomenclatura de arquivos: `snake_case` para módulos em `src/`
- `process.env` somente em `src/shared/environments.ts`
- `npm run build` verifica TypeScript — executar antes de marcar done

### Sobre `opened_at` e `approved_at`

Essas colunas existem no código atual (`ProofSessionMapper.ts`) mas não constam no schema da arquitetura. Esta story **não remove** essas colunas — estão fora do escopo. Removê-las sem migration seria uma regressão. Deixar como está.

### Project Structure Notes

- SQL migration: `supabase/migrations/` (nova pasta, criar se não existir)
- Entidade: `src/shared/domain/entities/ProofSession.ts`
- Mapper: `src/shared/infra/dto/ProofSessionMapper.ts`
- Use case de criação: `src/modules/proof-request/app/create_proof_request_usecase.ts`
- Viewmodel e use case de get: `src/modules/proof-session/app/`
- O `create_proof_request_viewmodel.ts` **não muda** — o DTO de resposta da API B2B ainda inclui `session.verificationPageUrl` e `session.deepLinkUrl`

### References

- [Architecture: Schema do Banco — proof_sessions](_bmad-output/planning-artifacts/architecture.md#schema-do-banco-de-dados)
- [Architecture: Padrão de Arquitetura Backend](_bmad-output/planning-artifacts/architecture.md#padrão-de-arquitetura-backend)
- [Epics: Story 1.3 AC](_bmad-output/planning-artifacts/epics.md#story-13-migration-sql-e-dependências-de-formulário)
- [Código a atualizar: ProofSession entity](src/shared/domain/entities/ProofSession.ts)
- [Código a atualizar: ProofSessionMapper](src/shared/infra/dto/ProofSessionMapper.ts)
- [Código a atualizar: create_proof_request_usecase](src/modules/proof-request/app/create_proof_request_usecase.ts)
- [Código a atualizar: get_proof_session_viewmodel](src/modules/proof-session/app/get_proof_session_viewmodel.ts)
- [Código a atualizar: get_proof_session_usecase](src/modules/proof-session/app/get_proof_session_usecase.ts)
- [Story anterior: 1.2 — Middleware](_bmad-output/implementation-artifacts/stories/1-2-middleware-de-autenticacao.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Arquivo de migration SQL criado em `supabase/migrations/20260513_update_proof_sessions.sql` — aplicação via Supabase Dashboard é ação manual necessária antes do próximo deploy
- `ProofSession.ts` entidade atualizada: removidos `verificationPageUrl`/`deepLinkUrl`, adicionados `challengeNonceHash`/`challengeCreatedAt` (nullable)
- `ProofSessionMapper.ts` atualizado: `ProofSessionPersistence` type e métodos `toDomain()`/`toPersistence()` alinhados com novo schema
- `create_proof_request_usecase.ts`: URLs continuam sendo computadas localmente e retornadas na resposta B2B — apenas removidas do construtor da entidade (não persistidas)
- `get_proof_session_viewmodel.ts` e `get_proof_session_usecase.ts`: `verificationPageUrl`/`deepLinkUrl` removidos do DTO de saída (conforme arquitetura — não devem ser expostos neste endpoint)
- `react-hook-form@^7.75.0` e `@hookform/resolvers@^5.2.2` instalados como dependencies
- 20/20 testes existentes passando (Stories 1.1 e 1.2) — zero regressões
- `npm run build` passou: TypeScript compilado sem erros; aviso sobre `node:crypto` no Edge Runtime é pré-existente (não introduzido por esta story)

### File List

**Criados:**
- `supabase/migrations/20260513_update_proof_sessions.sql`

**Modificados:**
- `src/shared/domain/entities/ProofSession.ts`
- `src/shared/infra/dto/ProofSessionMapper.ts`
- `src/modules/proof-request/app/create_proof_request_usecase.ts`
- `src/modules/proof-session/app/get_proof_session_viewmodel.ts`
- `src/modules/proof-session/app/get_proof_session_usecase.ts`
- `package.json`
- `package-lock.json`
