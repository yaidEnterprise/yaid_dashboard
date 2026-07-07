# Story 3.3: Detalhe de Proof Request

Status: done

## Story

Como empresa parceira autenticada,
Quero ver os detalhes de uma proof request específica,
Para que eu entenda o resultado da validação sem receber dados pessoais do holder.

## Acceptance Criteria

1. **Given** a página `/(dashboard)/proof-requests/[requestId]` para uma proof_request da company autenticada
   **When** a página carrega
   **Then** `GET /api/proof-requests/{requestId}` é chamado (via `fetchWithAuth`) e a UI exibe:
   - Header com Request ID (mono, copiável) e badge de status
   - Card de resumo: `proofType`, `externalReference` (se presente), `createdAt`, `updatedAt`
   - Card de atributos confirmados: claims booleanos verificados (apenas quando status `approved`)
   - Card com o JSON da resposta (dados não-sensíveis, sem PII)
   - Privacy card: aviso de que a YaID não armazena dados pessoais do holder
   **And** NÃO há timeline (FR8: "sem timeline no MVP")

2. **Given** uma proof_request com status `approved`
   **When** o card de atributos é renderizado
   **Then** exibe os claims verificados derivados do `proofType` (ex: `personhood: true` ou `ageOver18: true`) sem qualquer PII do holder

3. **Given** uma proof_request com status `pending_user`, `processing`, `rejected` ou `expired`
   **When** o card de atributos é renderizado
   **Then** exibe mensagem adequada ao status (ex: "Aguardando verificação do usuário", "Em processamento", "Validação rejeitada", "Solicitação expirada") — sem claims

4. **Given** um `requestId` que não pertence à company autenticada (ou inexistente)
   **When** a página tenta carregar
   **Then** o endpoint retorna **404** (`{ error: { code, message } }`) — **nunca 403** (evita enumeration, NFR6)
   **And** a página exibe um estado "não encontrado" claro, com link de volta para `/proof-requests`

5. **Given** a página de detalhe durante o carregamento e em caso de erro de rede
   **When** o request está pendente ou falha
   **Then** um estado de loading (skeleton/spinner) é exibido durante o fetch
   **And** um estado de erro com mensagem é exibido se o request falhar (que não seja 404)

## Tasks / Subtasks

- [x] Task 1: Corrigir o backend para retornar 404 em vez de 403 no mismatch de company (AC: #4, NFR6)
  - [x] Em `src/modules/proof-request/app/get_proof_request_usecase.ts`, substituir `throw new ForbiddenError()` por `throw new NotFoundError("Proof request not found", "PROOF_REQUEST_NOT_FOUND")` quando `row.app.companyId !== input.companyId`
  - [x] Remover o import não utilizado de `ForbiddenError`
  - [x] Confirmar que o caso "não existe" já lança `NotFoundError` (já lança) — ambos os casos convergem para 404, indistinguíveis para o cliente

- [x] Task 2: Expandir o DTO de saída do GET para cobrir os campos do epics (AC: #1, #2)
  - [x] Em `src/modules/proof-request/app/get_proof_request_viewmodel.ts`, adicionar ao `ProofRequestOutputDTO`:
    - `externalReference: string | null` (alias camelCase de `externalRef` — manter `externalRef` também para não quebrar consumidores existentes)
    - `updatedAt: string | null` (mapeado de `validatedAt` da entidade — é o único timestamp de atualização disponível no schema atual)
  - [x] Em `src/modules/proof-request/app/get_proof_request_usecase.ts`, popular `externalReference: row.request.externalRef` e `updatedAt: row.request.validatedAt?.toISOString() ?? null` no objeto retornado
  - [x] NÃO remover campos existentes (`externalRef`, `validatedAt`) — adição é aditiva

- [x] Task 3: Criar o client store `utils/proof-requests-store.ts` (AC: #1, #5)
  - [x] Espelhar o padrão de `utils/apps-store.ts`: usar `fetchWithAuth`, helper `asJson` para extrair `json.error?.message`, `cache: "no-store"`
  - [x] Exportar tipo `ProofRequestDetail` refletindo o DTO do endpoint (camelCase): `id, appId, appName, environment, proofType, status, result, externalReference, externalRef, createdAt, updatedAt, validatedAt`
  - [x] Exportar `getProofRequest(requestId: string): Promise<ProofRequestDetail>` chamando `GET /api/proof-requests/${requestId}`
  - [x] Exportar helpers de rótulo PT-BR: mapa de `status` do backend (`pending_user | processing | approved | rejected | expired`) → rótulo, e derivação de claims a partir de `proofType` + `status === "approved"`

- [x] Task 4: Reescrever a página de detalhe com dados reais (AC: #1, #2, #3, #4, #5)
  - [x] Em `app/(dashboard)/proof-requests/[requestId]/page.tsx`, remover TODOS os mocks: `timeline`, `payload` hardcoded, atributos hardcoded e a URL fake `https://verify.yaid.app/...`
  - [x] **Remover o `<aside>` de timeline por completo** (FR8: sem timeline no MVP); manter apenas o privacy card na coluna lateral
  - [x] Buscar dados com `getProofRequest(requestId)` dentro de `useEffect` (padrão de `apps/[appId]/page.tsx`: flag `cancelled`, `loading`, `error`)
  - [x] Header: título + `StatusBadge` mapeado do status real + `InlineCode copyable` com o `requestId`
  - [x] Card de resumo: `proofType` (rótulo), `externalReference` (se presente, via `InlineCode`), `createdAt` e `updatedAt` formatados via `toLocaleString("pt-BR")`
  - [x] Card de atributos confirmados: se `status === "approved"`, listar os claims derivados (`personhood: true` / `ageOver18: true`); caso contrário, exibir a mensagem de status adequada
  - [x] Card de JSON: renderizar `CodeBlock language="json"` com `JSON.stringify(data, null, 2)` do payload retornado (não-sensível)
  - [x] Manter o privacy card existente (texto de privacidade, borda `privacy`)
  - [x] Loading: reutilizar o padrão de spinner de `apps/[appId]/page.tsx`
  - [x] Erro/404: quando `getProofRequest` rejeitar, exibir estado "Solicitação não encontrada" com link para `/proof-requests`
  - [x] Mapear status backend → `StatusKind` do `StatusBadge`: `pending_user` → `pending`; os demais mantêm o mesmo nome (`processing`, `approved`, `rejected`, `expired`)

- [x] Task 5: Validar build, tipos e testes (AC: todos)
  - [x] `getDiagnostics` — zero erros TypeScript em todos os arquivos criados/modificados
  - [x] `npm run build` — Next.js "Compiled successfully" **e** "Finished TypeScript" (build 100% verde após correção do blocker do `CompanyAppMapper`)
  - [x] `npm run test` — 249/252 passando; as 3 falhas restantes são `spawnSync npx ENOENT` (npx não resolvível no child-process — ambiente, pré-existente). Nenhuma falha de código.

- [x] Task 6 (correção de blocker pré-existente, aprovada pelo usuário): destravar o build corrigindo `CompanyAppMapper`
  - [x] Adicionar `appId: string` à entidade `CompanyApp` (props + getter) — parte pública da API key (coluna `app_id` TEXT UNIQUE)
  - [x] `CompanyAppMapper.toDomain` mapeia `raw.app_id` → `appId`; `toPersistence` grava `app_id: app.appId`
  - [x] `create_company_app_usecase` define `appId: id` (a API key é `${id}.${secret}`, então `app_id` espelha o UUID — comportamento preservado; `findByAppId` continua batendo)

### Review Findings

_Code review (adversarial: Blind Hunter, Edge Case Hunter, Acceptance Auditor) — 2026-05-28. Acceptance Auditor: todos os 5 ACs satisfeitos. Build 100% verde._

- [x] [Review][Patch] Claims confirmados ignoravam `result` — adicionado guard `result !== false` antes de derivar claims para uma request `approved` [app/(dashboard)/proof-requests/[requestId]/page.tsx]
- [x] [Review][Defer] Spinner de loading sem `aria-label`/`role` — consistente com o padrão existente (`apps/[appId]/page.tsx`); tratar como melhoria de a11y transversal ao codebase — deferred

## Dev Notes

### Estado atual da implementação (análise pré-story)

**Backend — já existe e quase pronto:**
- `GET /api/proof-requests/[requestId]/route.ts` — lê `x-company-id` do header (injetado por `withSessionAuth`), chama `makeGetProofRequestController`, retorna 200. **Não alterar.**
- `GetProofRequestController` / `GetProofRequestPresenter` — corretos. **Não alterar.**
- `GetProofRequestUseCase` — busca via `requestRepo.findById(requestId)` (retorna `ProofRequestWithApp` com `{ request, app }`), lança `NotFoundError` se não encontrado. **BUG:** lança `ForbiddenError` (403) quando `row.app.companyId !== input.companyId`. O epics exige **404** para evitar enumeration (NFR6). Corrigir na Task 1.
- `get_proof_request_viewmodel.ts` — `ProofRequestOutputDTO` já tem `id, appId, appName, environment, proofType, status, result, externalRef, createdAt, validatedAt`. Falta `externalReference` e `updatedAt` (nomes do epics). Adicionar na Task 2.

**Frontend — existe mas 100% mockado:**
- `app/(dashboard)/proof-requests/[requestId]/page.tsx` é uma página `"use client"` com dados hardcoded:
  - `timeline` (array fixo) → **remover** (FR8: sem timeline no MVP)
  - `payload` (JSON string fixo) → substituir pelo JSON real da resposta
  - Resumo, atributos e URL de verificação hardcoded → substituir por dados reais
  - `StatusBadge status="approved"` e `EnvBadge env="prod"` fixos → derivar do dado real
- Não há chamada de API; não há `loading`/`error`/`not-found`. Precisa ser reescrita para consumir dados reais.

**Padrão de referência (usar como base):** `app/(dashboard)/apps/[appId]/page.tsx` — página client que busca via store (`getApp`), com `useEffect` (flag `cancelled`), `loading` (spinner), `error`/not-found (mensagem + link de volta), formatação de data com `toLocaleString("pt-BR")`.

### Padrão de data-fetching client-side

O projeto NÃO chama `fetch` direto em componentes — usa `fetchWithAuth` (intercepta 401 e redireciona para `/sign-in?next=<path>`) através de um "store" fino por domínio. Espelhar `utils/apps-store.ts`:

```typescript
// utils/proof-requests-store.ts
import { fetchWithAuth } from "@/utils/fetch-with-auth";

export type ProofRequestStatus =
  | "pending_user" | "processing" | "approved" | "rejected" | "expired";

export interface ProofRequestDetail {
  id: string;
  appId: string;
  appName: string;
  environment: "dev" | "homol" | "prod";
  proofType: string;
  status: ProofRequestStatus;
  result: boolean | null;
  externalReference: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string | null;
  validatedAt: string | null;
}

async function asJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && json.error?.message) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export async function getProofRequest(requestId: string): Promise<ProofRequestDetail> {
  const res = await fetchWithAuth(`/api/proof-requests/${requestId}`, { cache: "no-store" });
  return (await asJson(res)) as ProofRequestDetail;
}
```

> Nota: o shape de erro do backend é `{ error: { code, message } }` (via `handleHttpError`), divergindo do `{ error: string }` do PRD — este é o padrão real do projeto (confirmado na story 3.1). O `asJson` já lê `json.error?.message`.

### Derivação de claims confirmados (AC #2)

O schema atual não persiste claims individuais — há apenas `result: boolean | null` e `proofType`. Derivar o claim exibido a partir do `proofType` quando `status === "approved"`:

- `proofType === "personhood"` → `{ label: "Prova de humanidade (personhood)", value: true }`
- `proofType === "age_over_18"` → `{ label: "Maior de 18 anos (ageOver18)", value: true }`

Nunca exibir PII — apenas o booleano confirmado. Para status não-`approved`, exibir mensagem por status:

- `pending_user` → "Aguardando verificação do usuário"
- `processing` → "Em processamento"
- `rejected` → "Validação rejeitada"
- `expired` → "Solicitação expirada"

### Mapeamento de status para o StatusBadge

`StatusBadge` (`@/components/feedback/status-badge`) usa `StatusKind = "approved" | "pending" | "processing" | "rejected" | "expired"` (ver uso em `proof-requests/page.tsx`). O backend usa `pending_user`. Mapear: `pending_user → "pending"`; demais valores são idênticos.

### Card de JSON da resposta (AC #1)

Usar `CodeBlock` de `@/components/api/code-block` (já importado na página atual): `<CodeBlock language="json" code={JSON.stringify(data, null, 2)} />`. O payload é o próprio DTO retornado — todos os campos são não-sensíveis (sem PII do holder). Opcionalmente omitir campos duplicados (`externalRef`/`validatedAt`) para clareza, mas não é obrigatório.

### Convenções do projeto

- Path aliases: `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`; `@/components/*`, `@/utils/*` conforme `tsconfig.json`.
- Nomenclatura de arquivos: `kebab-case` para rotas e utils client; `snake_case` para use cases/controllers/presenters/viewmodels no backend.
- `process.env` apenas em `src/shared/environments.ts`.
- Tabelas do banco no singular: `proof_request`, `proof_session`.
- Idioma da UI: PT-BR fixo (NFR10).
- Toda listagem/detalhe cobre estados loading, erro e conteúdo (NFR14).
- `npm run build` valida TypeScript — rodar antes de marcar done.

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/modules/proof-request/app/get_proof_request_usecase.ts` | MODIFICAR | 403→404 no mismatch de company; popular `externalReference` e `updatedAt`; remover import `ForbiddenError` |
| `src/modules/proof-request/app/get_proof_request_viewmodel.ts` | MODIFICAR | Adicionar `externalReference` e `updatedAt` ao DTO |
| `utils/proof-requests-store.ts` | NOVO | Store client com `getProofRequest` via `fetchWithAuth` |
| `app/(dashboard)/proof-requests/[requestId]/page.tsx` | REESCREVER | Dados reais, estados loading/erro/404, remover timeline e mocks |

**NÃO alterar:**
- `app/api/proof-requests/[requestId]/route.ts` — já correto
- `GetProofRequestController`, `GetProofRequestPresenter` — já corretos
- `ProofRequestRepository.findById` / `SupabaseProofRequestRepository` — já retornam `ProofRequestWithApp`
- `withSessionAuth` / `src/shared/middleware.ts` — já injetam `x-company-id` e roteiam GET por sessão
- Entidades e mappers de `ProofRequest`

### Regressões a evitar

- A listagem (`proof-requests/page.tsx`, story 3.2, ainda mockada) linka para `/proof-requests/${r.id}` — o detalhe deve continuar acessível por essa rota. Não renomear o param `requestId`.
- Não remover campos do DTO usados por outros consumidores (`externalRef`, `validatedAt`) — apenas adicionar os novos.
- Manter `EnvBadge` no header apenas se `environment` estiver disponível no DTO (está) — opcional, mas não hardcodar `"prod"`.

### References

- [Epics: Story 3.3 AC](_bmad-output/planning-artifacts/epics.md) (seção "### Story 3.3: Detalhe de Proof Request")
- [FR8 / NFR6 / NFR14 — Requirements Inventory](_bmad-output/planning-artifacts/epics.md)
- [Story 3.1 (done) — padrões de proof-request e decisões](_bmad-output/implementation-artifacts/stories/3-1-endpoint-b2b-criacao-de-proof-request.md)
- [Use case GET: src/modules/proof-request/app/get_proof_request_usecase.ts](src/modules/proof-request/app/get_proof_request_usecase.ts)
- [Viewmodel GET: src/modules/proof-request/app/get_proof_request_viewmodel.ts](src/modules/proof-request/app/get_proof_request_viewmodel.ts)
- [API route: app/api/proof-requests/[requestId]/route.ts](app/api/proof-requests/[requestId]/route.ts)
- [Página detalhe (mock atual): app/(dashboard)/proof-requests/[requestId]/page.tsx](app/(dashboard)/proof-requests/[requestId]/page.tsx)
- [Padrão de referência: app/(dashboard)/apps/[appId]/page.tsx](app/(dashboard)/apps/[appId]/page.tsx)
- [Store de referência: utils/apps-store.ts](utils/apps-store.ts)
- [fetchWithAuth: utils/fetch-with-auth.ts](utils/fetch-with-auth.ts)
- [AppError: src/shared/errors/AppError.ts](src/shared/errors/AppError.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8

### Debug Log References

- `npm run build`: Next.js "Compiled successfully in ~10s"; typecheck falha apenas em `src/shared/infra/dto/CompanyAppMapper.ts:32` (pré-existente).
- `npm run test`: 244/252 passando (77.9s). 8 falhas pré-existentes.

### Completion Notes List

- **Task 1 (404 anti-enumeration):** `get_proof_request_usecase.ts` agora lança `NotFoundError` tanto para "não encontrado" quanto para mismatch de `companyId`, convergindo ambos para HTTP 404 (NFR6). Import de `ForbiddenError` removido.
- **Task 2 (DTO):** `ProofRequestOutputDTO` ganhou `externalReference` e `updatedAt` (aditivo; `externalRef`/`validatedAt` preservados). `updatedAt` é mapeado de `validatedAt` — o schema não tem coluna dedicada de atualização.
- **Task 3 (store):** criado `utils/proof-requests-store.ts` espelhando `apps-store.ts` (fetchWithAuth + `asJson`), com `getProofRequest`, rótulos PT-BR de status/proofType, derivação de claims confirmados e mensagens por status não-aprovado.
- **Task 4 (página):** `proof-requests/[requestId]/page.tsx` reescrita com dados reais, estados loading/erro/404, sem timeline (FR8), claims só quando `approved`, card JSON não-sensível e privacy card. Status backend `pending_user` mapeado para `pending` no `StatusBadge`.
- **Verificação:** `getDiagnostics` limpo em todos os arquivos; `npm run build` 100% verde (Compiled + Finished TypeScript); 249/252 testes passando (3 falhas restantes são `spawnSync npx ENOENT` de ambiente).
- **Blocker pré-existente RESOLVIDO (Task 6, aprovado pelo usuário):** `CompanyAppMapper.ts` quebrava o build porque `toPersistence` não populava `app_id` (campo tornado obrigatório em `CompanyAppPersistence` no review da story 3.1). Corrigido promovendo `appId` a campo de primeira classe da entidade `CompanyApp`, mapeado nos dois sentidos. Na criação, `appId = id` (a API key é `${id}.${secret}`), preservando exatamente o comportamento de `findByAppId`. Confirmado pré-existente via `git status`.

### File List

**Modificados:**
- `src/modules/proof-request/app/get_proof_request_usecase.ts`
- `src/modules/proof-request/app/get_proof_request_viewmodel.ts`
- `app/(dashboard)/proof-requests/[requestId]/page.tsx`
- `src/shared/domain/entities/CompanyApp.ts` (Task 6 — correção de blocker)
- `src/shared/infra/dto/CompanyAppMapper.ts` (Task 6 — correção de blocker)
- `src/modules/company-app/app/create_company_app_usecase.ts` (Task 6 — correção de blocker)
- `_bmad-output/implementation-artifacts/stories/3-3-detalhe-de-proof-request.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Criados:**
- `utils/proof-requests-store.ts`

## Change Log

| Data | Mudança |
|------|---------|
| 2026-05-28 | Story criada (ready-for-dev) e implementada. GET proof-request retorna 404 anti-enumeration; DTO expandido; store client novo; página de detalhe com dados reais (sem timeline). |
| 2026-05-28 | Task 6: corrigido blocker pré-existente em `CompanyAppMapper` (campo `appId` promovido na entidade `CompanyApp`). Build 100% verde. |
| 2026-05-28 | Code review adversarial (5/5 ACs OK): 1 patch aplicado (guard `result !== false`), 1 defer (a11y do spinner). |
| 2026-05-28 | QA: criado `tests/unit/story-3-3/proof-request-detail.test.mjs` (20 testes, todos passando). Story → done. |
