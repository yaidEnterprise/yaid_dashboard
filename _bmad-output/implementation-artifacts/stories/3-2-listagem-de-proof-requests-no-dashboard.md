# Story 3.2: Listagem de Proof Requests no Dashboard

Status: done

## Story

Como empresa parceira autenticada,
Quero visualizar todas as minhas proof requests em uma tabela,
Para que eu acompanhe o status de cada validação solicitada sem precisar consultar a API manualmente.

## Acceptance Criteria

1. **Given** a página `/(dashboard)/proof-requests` para um usuário autenticado
   **When** a página carrega
   **Then** `GET /api/proof-requests` é chamado e os dados são usados para renderizar:
   - 4 mini-cards de resumo acima da tabela, usando o componente `MetricCard` existente:
     - "Total" — contagem total de proof_requests da company
     - "Aprovadas" — contagem com status `approved`
     - "Pendentes" — contagem com status `pending_user` ou `processing`
     - "Rejeitadas" — contagem com status `rejected` ou `expired`
   - Tabela com colunas: ID (truncado), proof_type, status (badge), external_reference (se presente) e data de criação
   **And** apenas proof_requests da company autenticada são retornadas (isolamento por `company_id` server-side — já implementado no backend)
   **And** durante o carregamento, tanto os mini-cards quanto as linhas da tabela exibem estado Skeleton

2. **Given** a listagem enquanto os dados carregam
   **When** o request ainda não completou
   **Then** um estado de loading é exibido

3. **Given** a listagem quando não há proof_requests cadastradas
   **When** a listagem é renderizada
   **Then** um estado vazio é exibido orientando a criar a primeira proof_request via API (sem botão de criação no dashboard)

4. **Given** a listagem quando a API retorna erro
   **When** o request falha
   **Then** uma mensagem de erro é exibida com opção de tentar novamente

5. **Given** a listagem populada
   **When** o usuário clica em uma proof_request
   **Then** é navegado para `/(dashboard)/proof-requests/[requestId]`

## Tasks / Subtasks

- [x] Task 1: Criar client store `proof-requests-store.ts` (AC: #1)
  - [x] Tipar `ProofRequest` conforme `ProofRequestOutputDTO` do backend
  - [x] Implementar `listProofRequests()` via `fetchWithAuth("/api/proof-requests")`
  - [x] Mapear resposta `{ items: [...] }` e tratar erros como em `apps-store.ts`

- [x] Task 2: Criar componentes de feedback reutilizáveis (AC: #2, #3, #4)
  - [x] `components/shared/empty-state.tsx` — ícone, título, descrição, CTA opcional
  - [x] `components/shared/list-skeleton.tsx` — skeleton para MetricCards (4) e linhas de tabela (5)

- [x] Task 3: Reescrever página de listagem (AC: #1–#5)
  - [x] Substituir dados mock por fetch real com `useEffect` + estados loading/error/data
  - [x] Remover filtros, busca e paginação (MVP busca tudo — FR7)
  - [x] Renderizar 4 `MetricCard` com contagens calculadas do conjunto completo
  - [x] Tabela: ID truncado (`InlineCode`), proof_type formatado, `StatusBadge`, external_reference, created_at
  - [x] Mapear status API → `StatusBadge`: `pending_user` → `pending`
  - [x] Linha clicável navegando para `/proof-requests/[id]`
  - [x] Empty state quando `items.length === 0` após load bem-sucedido
  - [x] Alert de erro com botão "Tentar novamente"

- [x] Task 4: Validar build e testes manuais (AC: todos)
  - [x] `npm run build` sem erros TypeScript
  - [x] Verificar regressão: página carrega sem crash com lista vazia e com dados

## Dev Notes

### Estado atual da implementação (análise pré-story)

**O que já existe e funciona:**
- `GET /api/proof-requests` em `app/api/proof-requests/route.ts` — usa `x-company-id` do middleware de sessão
- `ListProofRequestsUseCase` — lista apps da company, depois proof_requests por `appIds` (isolamento server-side)
- `ListProofRequestsController` — retorna `{ items: ProofRequestOutputDTO[] }`
- Middleware em `src/shared/middleware.ts` — roteia GET `/api/proof-requests` para auth de sessão (não API key)
- `MetricCard` em `components/yaid/metric-card.tsx`
- `StatusBadge` em `components/feedback/status-badge.tsx` — tipos: `approved | pending | rejected | expired | processing`
- `fetchWithAuth` em `utils/fetch-with-auth.ts`
- Padrão de store: `utils/apps-store.ts`

**O que precisa ser substituído:**
- `app/(dashboard)/proof-requests/page.tsx` usa **dados mock** (`rows` hardcoded), filtros client-side, paginação desabilitada e mini-cards custom (não `MetricCard`)
- Colunas atuais incluem App, Ambiente, Expira — **fora do escopo** desta story (AC especifica apenas 5 colunas)
- Botão "Criar solicitação" aponta para `/proof-requests/new` — helper é story 3.4; **remover** da listagem MVP

**O que NÃO existe ainda:**
- `utils/proof-requests-store.ts`
- `components/shared/empty-state.tsx`
- Componente Skeleton (shadcn/ui não instalado — usar skeleton CSS com `animate-pulse`)

### Shape da API (GET /api/proof-requests)

```typescript
// Resposta 200
{
  items: Array<{
    id: string;
    appId: string;
    appName: string;
    environment: "dev" | "homol" | "prod";
    proofType: string;           // "personhood" | "age_over_18"
    status: "pending_user" | "processing" | "approved" | "rejected" | "expired";
    result: boolean | null;
    externalRef: string | null;
    createdAt: string;           // ISO 8601
    validatedAt: string | null;
  }>
}
```

**Nota:** Epics menciona `waiting_user`/`opened` para pendentes — no domínio atual o status de proof_request é `pending_user` (não confundir com `proof_session.status`). Usar enum do backend.

### Mapeamento de status para métricas e badges

| API status     | MetricCard bucket | StatusBadge status |
|----------------|-------------------|--------------------|
| `approved`     | Aprovadas         | `approved`         |
| `pending_user` | Pendentes         | `pending`          |
| `processing`   | Pendentes         | `processing`       |
| `rejected`     | Rejeitadas        | `rejected`         |
| `expired`      | Rejeitadas        | `expired`          |

### Mapeamento proof_type para exibição

```typescript
const PROOF_TYPE_LABELS: Record<string, string> = {
  personhood: "Personhood",
  age_over_18: "Maior de 18 anos",
};
```

### Truncamento de ID

Padrão UX: monospace, truncado com `...`, `title` com ID completo. Usar `InlineCode` existente ou truncar visualmente (ex: primeiros 8 chars + `…`).

### Contagens dos MetricCards

Calcular do **conjunto completo** retornado pela API (não de subset filtrado — MVP sem filtros).

```typescript
const total = items.length;
const approved = items.filter(r => r.status === "approved").length;
const pending = items.filter(r => r.status === "pending_user" || r.status === "processing").length;
const rejected = items.filter(r => r.status === "rejected" || r.status === "expired").length;
```

### Empty State

Conforme UX spec: sem CTA de criação no dashboard. Texto orientando uso da API:
- Título: "Nenhuma solicitação ainda"
- Descrição: "Proof requests criadas via `POST /api/proof-requests` com sua API key aparecerão aqui."

### Error State

Padrão UX: Alert com mensagem + botão "Tentar novamente" que re-dispara o fetch. Seguir tratamento de erro de `apps-store.ts` (`json.error?.message`).

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `utils/proof-requests-store.ts` | NOVO | Client store para listagem |
| `components/shared/empty-state.tsx` | NOVO | Componente EmptyState |
| `components/shared/list-skeleton.tsx` | NOVO | Skeleton para cards + tabela |
| `app/(dashboard)/proof-requests/page.tsx` | MODIFICAR | Substituir mock por API real |

**NÃO alterar:**
- `app/api/proof-requests/route.ts` — backend já funcional
- `src/modules/proof-request/app/list_proof_requests_*` — use case já correto
- Página de detalhe `proof-requests/[requestId]` — story 3.3

### Previous Story Intelligence (3.1)

- Backend de proof requests estável com `createAtomic`, `findByAppId`, status `pending_user`
- Padrão de erro HTTP: `{ error: { code, message } }` — usar `error.message` no client
- `externalRef` no DTO de listagem (não `externalReference` — apenas no POST response)
- Isolamento por company via `listByCompanyId` → `listByAppIds`

### Convenções do projeto

- Path aliases: `@/components/*`, `@/utils/*`
- Client components: `"use client"` nas páginas com fetch
- PT-BR para labels de UI
- `npm run build` antes de marcar done

### References

- [Epics: Story 3.2](_bmad-output/planning-artifacts/epics.md#story-32-listagem-de-proof-requests-no-dashboard)
- [UX: Table Patterns, Empty States, Feedback Patterns](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Story 3.1 — backend](_bmad-output/implementation-artifacts/stories/3-1-endpoint-b2b-criacao-de-proof-request.md)
- [List use case](src/modules/proof-request/app/list_proof_requests_usecase.ts)
- [Apps store pattern](utils/apps-store.ts)
- [MetricCard](components/yaid/metric-card.tsx)
- [StatusBadge](components/feedback/status-badge.tsx)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Criado `utils/proof-requests-store.ts` seguindo padrão de `apps-store.ts`
- Criados `EmptyState` e skeletons reutilizáveis em `components/shared/`
- Página `proof-requests/page.tsx` reescrita: dados reais via API, 4 MetricCards, tabela MVP sem filtros
- Build passou após tornar `app_id` opcional em `CompanyAppPersistence` (fix pré-existente de story 3.1)

### File List

**Novos:**
- `utils/proof-requests-store.ts`
- `components/shared/empty-state.tsx`
- `components/shared/list-skeleton.tsx`

**Modificados:**
- `app/(dashboard)/proof-requests/page.tsx`
- `src/shared/infra/dto/CompanyAppMapper.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/stories/3-2-listagem-de-proof-requests-no-dashboard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Testes:**
- `tests/unit/story-3-2/proof-requests-listing.test.mjs`

## Senior Developer Review (AI)

**Outcome:** Approved (patches aplicados)
**Data:** 2026-06-08

### Action Items

- [x] [Review][Patch] Métricas zeradas em estado de erro — ocultar MetricCards quando `error` está setado
- [x] [Review][Patch] Clique no botão copiar do ID propagava navegação — `stopPropagation` na célula do ID
- [x] [Review][Defer] Labels do StatusBadge em inglês — pré-existente, fora do escopo desta story
