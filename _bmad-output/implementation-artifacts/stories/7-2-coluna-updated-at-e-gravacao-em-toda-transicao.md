# Story 7.2: Coluna `updated_at` e Gravação em Toda Transição

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como empresa parceira,
Quero que o campo "Atualizada em" reflita a última transição de status da proof_request,
Para que eu saiba quando a validação mudou de estado.

> 📋 **Referência:** corrige a causa-raiz do item #5 do Sprint Change — "Atualizada em" sempre `null`/desatualizado porque `updated_at` não existia e o viewmodel aliasava de `validated_at`.

## Acceptance Criteria

1. **Given** a fundação de migrations (Story 7.1) aplicada
   **When** a forward migration `add_updated_at_to_proof_requests` é criada e aplicada
   **Then** a coluna `proof_request.updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` é adicionada
   **And** o backfill preenche `updated_at = created_at` para as linhas existentes

2. **Given** a entidade `ProofRequest` e o `ProofRequestMapper`
   **When** revisados após esta story
   **Then** ambos incluem `updatedAt` (entity, camelCase) / `updated_at` (persistência, snake_case), mapeados corretamente

3. **Given** o `SupabaseProofRequestRepository.updateStatus()`
   **When** qualquer transição de status ocorre
   **Then** o método grava `status` **e** `updated_at = now()` na mesma operação — nunca só o status

4. **Given** o `get_proof_request_viewmodel` / `GetProofRequestUseCase`
   **When** monta a resposta de detalhe
   **Then** mapeia `updatedAt` da coluna real `updated_at` (não mais alias de `validated_at`)
   **And** a tela de detalhe (`app/(dashboard)/proof-requests/[requestId]/page.tsx`) exibe o valor real em "Atualizada em" após cada transição

## Tasks / Subtasks

- [x] Task 1: Forward migration `add_updated_at_to_proof_requests` (AC: #1)
  - [x] Criado `supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql` via `supabase migration new add_updated_at_to_proof_requests` (timestamp gerado pelo CLI)
  - [x] SQL escrito com backfill explícito e literal (não `DEFAULT now()` puro): `ADD COLUMN updated_at timestamptz` (nullable) → `UPDATE ... SET updated_at = created_at WHERE updated_at IS NULL` → `ALTER COLUMN updated_at SET DEFAULT now(), SET NOT NULL`. Bate literalmente com a AC1 ("backfill preenche `updated_at = created_at`"), diferente de `DEFAULT now()` puro que teria preenchido linhas existentes com o timestamp do `ALTER`, não com `created_at`
  - [x] **Validação local via `db reset`/`db diff` NÃO executada — deferida, ambiente sem Docker** (`docker info` falhou: nenhum daemon disponível nesta sessão). A migration foi validada estruturalmente (teste de leitura do SQL) mas não contra um Postgres real. Próxima pessoa com Docker disponível deve rodar `supabase db reset` + `supabase db diff --schema public` antes de considerar a migration pronta para `db push` — ver Debug Log e `deferred-work.md`
  - [x] Nenhum `supabase db push` executado — mesma cautela operacional da Story 7.1

- [x] Task 2: Atualizar entidade `ProofRequest` e `ProofRequestMapper` (AC: #2)
  - [x] `src/shared/domain/entities/ProofRequest.ts`: `updatedAt: Date` adicionado a `ProofRequestProps` + getter
  - [x] `src/shared/infra/dto/ProofRequestMapper.ts`: `updated_at: string` adicionado a `ProofRequestPersistence`; `toDomain`/`toPersistence` mapeiam
  - [x] `src/modules/proof-request/app/create_proof_request_usecase.ts`: só havia **um** ponto de instanciação de `ProofRequest` (não dois como a story previu) — `updatedAt: now` adicionado, reusando a mesma `Date` de `createdAt`

- [x] Task 3: Gravar `updated_at = now()` em toda transição de status (AC: #3)
  - [x] `SupabaseProofRequestRepository.ts::updateStatus()`: `.update({ status, updated_at: new Date().toISOString() })`
  - [x] Nenhuma das 5 chamadas de `updateStatus()` em 4 arquivos (`verify_presentation_usecase.ts` chama duas vezes: REJECTED linha 114, APPROVED linha 301; mais `get_proof_session_usecase.ts`, `cancel_proof_session_usecase.ts`, `challenge_proof_session_usecase.ts`) foi alterada — confirmado via `tsc --noEmit` limpo

- [x] Task 4: Corrigir o viewmodel/use case de detalhe (AC: #4)
  - [x] `get_proof_request_usecase.ts`: `updatedAt: row.request.updatedAt.toISOString()` (não mais alias de `validatedAt`)
  - [x] `get_proof_request_viewmodel.ts`: tipo `updatedAt` mudado de `string | null` para `string`; comentário desatualizado removido
  - [x] Confirmado: `page.tsx:100` (`formatDate(data.updatedAt)`) já aceita `string | null` — compatível sem mudança

- [x] Task 5: Avaliar `list_proof_requests_viewmodel`/`usecase`
  - [x] Confirmado via grep em `app/`: só `[requestId]/page.tsx` usa "Atualizada em"/`updatedAt`. Listagem (`app/(dashboard)/proof-requests/page.tsx`) não referencia `updatedAt` — mantida sem alteração, conforme escopo da AC4

- [x] Task 6: Criar testes estruturais e de comportamento (AC: todos)
  - [x] `tests/unit/story-7-2/updated-at-tracking.test.mjs` criado — 7 suites / 14 testes cobrindo migration (SQL), entity, mapper, `updateStatus`, `create_proof_request_usecase`, `get_proof_request_usecase`, DTO não-nulável
  - [x] Script `"test:story:7.2"` adicionado ao `package.json`

- [x] Task 7: Rodar testes e validar
  - [x] `npm run test:story:7.2` — 14/14 passando
  - [x] `npm run test` (suíte completa) — 660/662 passando; as 2 falhas (`story-1-5`/`story-1-6`, redirect via `window.location.href` em sign-up/sign-in) são **pré-existentes e não relacionadas** — confirmado rodando a suíte completa com `git stash` (mesmas 2 falhas presentes antes de qualquer mudança desta story, em arquivos nunca tocados aqui)
  - [x] `npm run lint` — 6 erros/12 warnings pré-existentes, nenhum em arquivo tocado por esta story
  - [x] `npx tsc --noEmit` — limpo, zero erros

### Review Findings

- [x] [Review][Patch] Comentário do DTO ("Latest status-transition timestamp") não vale para requests recém-criadas, onde `updatedAt == createdAt` sem nenhuma transição ter ocorrido ainda [src/modules/proof-request/app/get_proof_request_viewmodel.ts:14] — corrigido, comentário reformulado para cobrir o caso de criação
- [x] [Review][Patch] Dev Notes/Debug Log afirmam "4 call sites" de `updateStatus()`, mas `verify_presentation_usecase.ts` chama o método duas vezes (REJECTED linha 114, APPROVED linha 301) — são 5 chamadas em 4 arquivos, não 4 chamadas [_bmad-output/implementation-artifacts/stories/7-2-coluna-updated-at-e-gravacao-em-toda-transicao.md] — corrigido, contagem ajustada nos Dev Notes/Debug Log
- [x] [Review][Defer] As 3 declarações da migration (`ADD COLUMN` → `UPDATE` backfill → `ALTER ... SET NOT NULL`) não estão explicitamente envolvidas em `BEGIN`/`COMMIT`; se o runner não trata o arquivo inteiro como uma transação implícita, uma falha no meio deixa a coluna nullable sem default — deferido, pré-existente como padrão (baseline da Story 7.1 também não usa transação explícita) [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]
- [x] [Review][Defer] `ADD COLUMN` sem guarda de idempotência (`IF NOT EXISTS` não existe para `ADD COLUMN`, mas nenhuma verificação prévia) — replay parcial da migration falha em vez de no-op — deferido, risco baixo (migrations não costumam ser replayadas manualmente neste projeto) [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]
- [x] [Review][Defer] `ProofRequestMapper.toDomain`/`GetProofRequestUseCase` confiam em `raw.updated_at` sem guarda contra Invalid Date — se o valor vier `null`/malformado, `new Date(...)` e o posterior `.toISOString()` falham silenciosa ou ruidosamente — deferido, mesmo padrão já aceito em outros mappers do projeto (ex.: `ProofSessionMapper.challenge_created_at`, documentado em `deferred-work.md` desde a Story 1.3) [`src/shared/infra/dto/ProofRequestMapper.ts`, `src/modules/proof-request/app/get_proof_request_usecase.ts`]
- [x] [Review][Defer] `SupabaseProofRequestRepository.updateStatus()` não verifica se `id` correspondeu a alguma linha — update silencioso vira no-op sem sinalizar erro ao chamador — deferido, comportamento pré-existente não introduzido por esta story (a mudança só adicionou `updated_at` ao payload) [`src/shared/infra/repositories/SupabaseProofRequestRepository.ts:106-112`]
- [x] [Review][Defer] Janela estreita de risco operacional: se uma linha for inserida sem `updated_at` entre o `ADD COLUMN` e o `SET NOT NULL` (escrita concorrente durante a aplicação da migration), o `SET NOT NULL` falha — deferido, risco baixo em deploy de single-writer, mesmo perfil de risco de qualquer migration aditiva `NOT NULL` [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]

## Dev Notes

### O que a Story 7.1 já deixou pronto (ler antes de começar)

- O baseline (`supabase/migrations/20260728015653_remote_schema.sql`) **não tem** `updated_at` em `proof_request` — confirmado propositalmente, pois esta story (7.2) é quem adiciona a coluna via forward migration.
- A tabela real chama-se `proof_request` (singular), não `proof_requests` como a documentação de planejamento (epics.md/architecture.md) sugere. Use `proof_request` em qualquer SQL/query nova.
- Padrão de migration: usar `supabase migration new <nome>` para deixar o CLI gerar o timestamp no nome do arquivo — não escrever o arquivo manualmente com timestamp inventado.
- Credenciais: `SUPABASE_DB_PASSWORD` já está em `.env.local.example`/`.env` local (documentado na Story 7.1); `supabase db reset` precisa de Docker rodando.

### Drift interessante: `get_proof_request_viewmodel.ts` já tem `updatedAt`, mas `list_proof_requests_viewmodel.ts` não

Hoje (`src/modules/proof-request/app/get_proof_request_viewmodel.ts`) o DTO de **detalhe** já declara:
```ts
externalReference: string | null; // camelCase alias of externalRef (epics naming)
updatedAt: string | null; // Latest update timestamp; mapped from validatedAt (no dedicated column yet)
```
Isso já foi antecipado em uma story anterior (provavelmente 3.3), mas o valor real é só um alias de `validatedAt` em `get_proof_request_usecase.ts:31`. Esta story corrige a fonte (`updatedAt` real da coluna), não o shape do DTO — só o tipo muda de `string | null` para `string` porque a coluna é `NOT NULL`.

O DTO de **listagem** (`list_proof_requests_viewmodel.ts`) **não tem** `updatedAt` nem `externalReference` — só a tela de detalhe (`[requestId]/page.tsx`) usa "Atualizada em" (confirmado via grep, único match em `app/`). A AC4 desta story só fala do detalhe. Não adicionar `updatedAt` à listagem a menos que investigação mostre que a tabela do dashboard (`app/(dashboard)/proof-requests/page.tsx`) também precisa — checar esse arquivo antes de decidir, mas o escopo padrão é **não mexer na listagem**.

### `updateStatus()` — encapsular no repositório, não nos call sites

`SupabaseProofRequestRepository.updateStatus(id, status)` é chamado em 4 lugares:
- `verify_presentation_usecase.ts:301` (aprovação após 11 regras de verificação passarem)
- `get_proof_session_usecase.ts:38` (transição para `expired` por clock)
- `cancel_proof_session_usecase.ts:42` (cancelamento → `rejected`)
- `challenge_proof_session_usecase.ts:61` (`pending_user` → `processing`)

A forma mais simples e correta de atender AC3 ("o método grava status **e** updated_at = now() na mesma operação") é gravar `updated_at` **dentro do próprio `updateStatus()`**, sem mudar a assinatura nem nenhum dos 4 call sites — eles não precisam saber que `updated_at` está sendo gravado. Evita duplicar `new Date().toISOString()` em 4 lugares e mantém a garantia centralizada num único ponto.

### Entidade `ProofRequest` — cuidado com `create_proof_request_usecase.ts`

`src/shared/domain/entities/ProofRequest.ts` é instanciada em 2 lugares dentro de `create_proof_request_usecase.ts` (linhas ~77 e ~111 — provavelmente os fluxos `create` e `createAtomic`/com sessão). Como `updatedAt` será um campo obrigatório (`Date`, não opcional) na entidade, ambos os pontos de instanciação **vão quebrar a compilação** até adicionar `updatedAt: now` (o mesmo `Date` já usado para `createdAt` nessas construções — proof request recém-criada tem `updated_at = created_at` por definição, coerente com o backfill da AC1 para linhas existentes). Ler o arquivo completo antes de editar para confirmar os dois pontos exatos e o nome da variável `now`/`Date` já em uso.

### Testes — padrão real do projeto (mesmo aviso da Story 7.1)

`architecture.md` (linha 436) diz "testes co-locados ao módulo", mas a prática real é `tests/unit/story-{epic}-{num}/*.test.mjs` com script dedicado `test:story:X.Y`. Seguir esse padrão. Para os testes de `updateStatus`/`GetProofRequestUseCase`, reusar o estilo de repositório fake já usado em `tests/unit/story-3-3/proof-request-detail.test.mjs` (ler antes de escrever os novos testes, para manter consistência de mocks).

Diferente da Story 7.1 (testes puramente estruturais, sem lógica de app), esta story toca lógica de aplicação (`updateStatus`, `GetProofRequestUseCase`) — os testes devem cobrir comportamento real via fakes/mocks, não só existência de arquivos. O teste da migration em si (SQL) pode continuar estrutural (ler o arquivo `.sql` e checar a presença de `ADD COLUMN updated_at ... NOT NULL DEFAULT now()`), seguindo o padrão de `tests/unit/story-7-1/schema-baseline.test.mjs`.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/migrations/<timestamp>_add_updated_at_to_proof_requests.sql` | CRIAR | Forward migration: `ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` em `proof_request` |
| `src/shared/domain/entities/ProofRequest.ts` | MODIFICAR | Adicionar `updatedAt: Date` a `ProofRequestProps` + getter |
| `src/shared/infra/dto/ProofRequestMapper.ts` | MODIFICAR | Adicionar `updated_at` a `ProofRequestPersistence`; mapear em `toDomain`/`toPersistence` |
| `src/shared/infra/repositories/SupabaseProofRequestRepository.ts` | MODIFICAR | `updateStatus()` grava `updated_at: new Date().toISOString()` junto com `status` |
| `src/modules/proof-request/app/create_proof_request_usecase.ts` | MODIFICAR | Ambas instanciações de `ProofRequest` passam a incluir `updatedAt` |
| `src/modules/proof-request/app/get_proof_request_usecase.ts` | MODIFICAR | `updatedAt` mapeado de `row.request.updatedAt`, não mais de `validatedAt` |
| `src/modules/proof-request/app/get_proof_request_viewmodel.ts` | MODIFICAR | Tipo de `updatedAt` de `string \| null` para `string`; remover comentário desatualizado |
| `tests/unit/story-7-2/*.test.mjs` | CRIAR | Testes estruturais (migration) + comportamentais (mapper, repo, use case) |
| `package.json` | MODIFICAR | Adicionar script `test:story:7.2` |

Arquivos **não tocados** (confirmar escopo, não mexer sem necessidade comprovada): `list_proof_requests_viewmodel.ts`, `list_proof_requests_usecase.ts`, `app/(dashboard)/proof-requests/page.tsx` (listagem), os 4 call sites de `updateStatus()`.

### References

- [Epics: Story 7.2 AC](../../planning-artifacts/epics.md#story-72-coluna-updated_at-e-gravação-em-toda-transição)
- [Story 7.1 (fundação de migrations, precondição desta story)](7-1-fundacao-de-versionamento-de-schema.md)
- [Architecture: Arquitetura de Dados](../../planning-artifacts/architecture.md#arquitetura-de-dados)
- [ProofRequestMapper (schema real, sem updated_at antes desta story)](../../../../src/shared/infra/dto/ProofRequestMapper.ts)
- [get_proof_request_viewmodel.ts (já antecipa updatedAt como alias)](../../../../src/modules/proof-request/app/get_proof_request_viewmodel.ts)
- [Tela de detalhe consumindo "Atualizada em"](../../../../app/(dashboard)/proof-requests/[requestId]/page.tsx)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx supabase --version` → `2.111.0` (CLI instalado sob demanda via `npx`, sem instalação global prévia neste ambiente)
- `npx supabase migration new add_updated_at_to_proof_requests` → sucesso, gerou `supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql` vazio, sem precisar de `link`/credenciais/Docker
- `docker info` → falhou (`which: no docker`), nenhum daemon Docker disponível neste ambiente → `supabase db reset`/`supabase db diff` não puderam ser executados; migration validada apenas estruturalmente via teste (ver Task 1)
- `npm run test:story:7.2` → 14/14 passando (7 suites)
- `npm run test` (suíte completa) → 660/662 passando. As 2 falhas (`story-1-5/signup-atomico.test.mjs`, `story-1-6/login-e-protecao-de-rotas.test.mjs`, ambas sobre `window.location.href` em redirect de sign-up/sign-in) foram confirmadas **pré-existentes**: reproduzidas via `git stash` (revertendo todas as mudanças desta story) — mesmas 2 falhas presentes antes de qualquer edição
- `npm run lint` → 6 erros/12 warnings, todos pré-existentes (`app/api/credentials/*`, `components/apps/api-key-modal.tsx`, `app/(dashboard)/proof-requests/page.tsx`, arquivos de teste de outras stories) — nenhum em arquivo tocado por esta story
- `npx tsc --noEmit` → limpo, zero erros

### Completion Notes List

- Migration `20260805223534_add_updated_at_to_proof_requests.sql` criada com backfill explícito (`ADD COLUMN` nullable → `UPDATE ... SET updated_at = created_at` → `SET DEFAULT now(), SET NOT NULL`), batendo literalmente com a AC1. **Não validada contra Postgres real** nesta sessão por falta de Docker no ambiente — ver item em `deferred-work.md`. Nenhum `db push` executado.
- `ProofRequest` entity e `ProofRequestMapper` atualizados com `updatedAt`/`updated_at`; único ponto de instanciação em `create_proof_request_usecase.ts` (a story previu dois, só existia um) atualizado para setar `updatedAt` igual a `createdAt` na criação.
- `SupabaseProofRequestRepository.updateStatus()` agora grava `status` e `updated_at: new Date().toISOString()` no mesmo `.update()` — nenhuma das 5 chamadas (em 4 arquivos) precisou mudar, conforme decisão de encapsulamento nos Dev Notes.
- `GetProofRequestUseCase`/`get_proof_request_viewmodel.ts` corrigidos: `updatedAt` agora vem da coluna real (nunca mais alias de `validatedAt`); tipo do DTO passou de `string | null` para `string`. Tela de detalhe (`page.tsx:100`) não precisou de mudança — já aceitava `string | null`, compatível com o tipo mais estrito.
- `list_proof_requests_viewmodel.ts`/listagem confirmados fora de escopo (não usam `updatedAt`) — mantidos intocados conforme decisão registrada nos Dev Notes.
- Teste de fixture em `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts` precisou de `updatedAt` adicional na sua própria instanciação de `ProofRequest` (campo passou a ser obrigatório) — único efeito colateral de compilação encontrado, corrigido.
- Testes novos seguem o padrão de inspeção estrutural (regex sobre source) já estabelecido no projeto, não o padrão de mocks/fakes sugerido inicialmente nos Dev Notes — mantendo consistência com todas as stories anteriores (nenhuma usa fakes/mocks reais, confirmado inspecionando `tests/unit/story-3-3` e `tests/unit/story-6-1`).

### File List

**Criados:**
- `supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`
- `tests/unit/story-7-2/updated-at-tracking.test.mjs`
- `tests/unit/story-7-2/updated-at-tracking.dynamic.test.ts` (QA)

**Modificados:**
- `src/shared/domain/entities/ProofRequest.ts`
- `src/shared/infra/dto/ProofRequestMapper.ts`
- `src/shared/infra/repositories/SupabaseProofRequestRepository.ts`
- `src/modules/proof-request/app/create_proof_request_usecase.ts`
- `src/modules/proof-request/app/get_proof_request_usecase.ts`
- `src/modules/proof-request/app/get_proof_request_viewmodel.ts`
- `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts` (fixture: `updatedAt` adicionado à instanciação de `ProofRequest`)
- `package.json` (script `test:story:7.2`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (1 item deferido: validação local da migration sem Docker)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status da story)

## Change Log

- 2026-08-05: Story criada e implementada via bmad-story-pipeline. Coluna `updated_at` adicionada a `proof_request` via forward migration (backfill explícito de `created_at`); `ProofRequest`/`ProofRequestMapper` atualizados; `SupabaseProofRequestRepository.updateStatus()` agora grava `updated_at = now()` em toda transição; `GetProofRequestUseCase` corrigido para mapear `updatedAt` real em vez de alias de `validatedAt`. 14 testes novos, 660/662 na suíte completa (2 falhas pré-existentes não relacionadas). Migration não validada contra Postgres real por falta de Docker no ambiente — deferido.
