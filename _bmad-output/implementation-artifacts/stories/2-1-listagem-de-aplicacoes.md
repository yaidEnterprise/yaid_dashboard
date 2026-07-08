# Story 2.1: Listagem de Aplicações

Status: done

> 📋 **Referência UX:** `ux-design-specification.md` — seções "Table Patterns" (colunas, badges de status, hover, IDs truncados), "Empty States" (componente `EmptyState` com CTA "Criar primeiro app") e "Feedback Patterns" (Skeleton de loading, Alert de erro com retry).

## Story

Como empresa parceira autenticada,
Quero visualizar todas as minhas aplicações cadastradas,
Para que eu tenha uma visão geral dos meus apps e seus status sem precisar consultar a API manualmente.

## Acceptance Criteria

1. **Given** a página `/(dashboard)/apps` para um usuário autenticado
   **When** a página carrega
   **Then** uma chamada `GET /api/company-apps` é feita e os apps da company são exibidos em tabela com colunas: nome, app_id, status e data de criação
   **And** apenas apps da company autenticada são retornados (isolamento por `company_id` server-side)

2. **Given** a página de apps enquanto os dados carregam
   **When** o request ainda não completou
   **Then** um estado de loading é exibido (skeleton ou spinner)

3. **Given** a página de apps quando não há apps cadastrados
   **When** a listagem é renderizada
   **Then** um estado vazio é exibido com CTA "Criar primeiro app" que leva para `/apps/new`

4. **Given** a página de apps quando a API retorna erro
   **When** o request falha
   **Then** uma mensagem de erro é exibida com opção de tentar novamente

5. **Given** a listagem populada com apps
   **When** o usuário clica em um app
   **Then** é navegado para `/(dashboard)/apps/[appId]`

## Tasks / Subtasks

- [x] Task 1: Refatorar `app/(dashboard)/apps/page.tsx` para satisfazer todos os ACs (AC: #1, #2, #3, #4, #5)
  - [x] Manter a chamada existente `listApps()` de `@/utils/apps-store` (já usa `fetchWithAuth` + `GET /api/company-apps`)
  - [x] Substituir "Carregando apps…" por skeleton rows (3 linhas com animate-pulse) — AC #2
  - [x] Substituir "Nenhum app encontrado." por componente EmptyState com ícone, título, descrição e CTA `<Link href="/apps/new">Criar primeiro app</Link>` — AC #3
  - [x] Adicionar botão "Tentar novamente" no estado de erro (chama `reload()`) — AC #4
  - [x] Simplificar colunas da tabela para: Nome (+ app_id truncado abaixo), Status, Criado em + ações — AC #1
  - [x] Tornar linhas da tabela clicáveis via `router.push(`/apps/${app.id}`)` via onClick — AC #5
  - [x] Remover colunas "Ambiente" e "Webhook" do MVP (não listadas nos ACs)
  - [x] Manter filtros de busca por nome/ID existentes (cliente-side, não exigido pelos ACs mas já implementado e útil)

- [x] Task 2: Verificar que backend `GET /api/company-apps` já está correto (AC: #1)
  - [x] Confirmar que `app/api/company-apps/route.ts` lê `x-company-id` injetado pelo middleware
  - [x] Confirmar que `ListCompanyAppsUseCase` filtra por `companyId` (não vaza dados de outras companies)
  - [x] Confirmar resposta retorna `{ items: CompanyAppOutputDTO[] }` em camelCase

- [x] Task 3: Criar testes unitários para a story 2.1 (AC: todos)
  - [x] Criar `tests/unit/story-2-1/listagem-de-aplicacoes.test.mjs`
  - [x] Testar contrato do backend: route exporta GET, usa makeListCompanyAppsController
  - [x] Testar contrato do frontend: page usa fetchWithAuth via apps-store, tem estados loading/empty/error


- [x] Task 4: Rodar testes e build (AC: todos)
  - [x] `node --test tests/unit/story-2-1/listagem-de-aplicacoes.test.mjs` — 15/15 testes passando
  - [x] `npm run build` — TypeScript limpo

### Review Findings

- [x] [Review][Patch] `<tr>` clicável inacessível por teclado — `onClick` no `<tr>` sem `tabIndex={0}` e `onKeyDown` impede navegação por Tab+Enter; usuários de teclado não conseguem abrir apps — **APLICADO**: adicionado `tabIndex={0}`, `onKeyDown` com Enter/Space, `focus:ring-2 focus:ring-trust/40` [app/(dashboard)/apps/page.tsx]
- [x] [Review][Defer] Race condition latente no `reload()` — flash de estado entre setFetchKey e re-render do loading; padrão pre-existente no projeto, React batcheia setState — deferred, pre-existing
- [x] [Review][Defer] Propagação de click em filhos futuros do `<tr>` — sem `e.stopPropagation()` filhos interativos futuros propagarão click para navegar; sem filhos interativos no MVP — deferred, latent
- [x] [Review][Defer] `colSpan={3}` hardcoded em EmptyState/ErrorState — tech debt: adicionar coluna futuramente exige atualizar manualmente — deferred, tech-debt-mvp

## Dev Notes

### Análise do Estado Atual

**Backend — já implementado (sem mudanças necessárias):**

`app/api/company-apps/route.ts` já exporta `GET` handler:
```typescript
export async function GET(req: NextRequest) {
  const companyId = req.headers.get("x-company-id")!;
  const controller = await makeListCompanyAppsController();
  const result = await controller.handle({ companyId });
  return NextResponse.json(result, { status: 200 });
}
```

`ListCompanyAppsUseCase.execute({ companyId })` filtra por `companyId` via `repo.listByCompanyId(input.companyId)` — isolamento garantido server-side (AC #1 ✅).

Resposta: `{ items: CompanyAppOutputDTO[] }` onde DTO inclui `{ id, companyId, name, webhookUrl, environment, status, createdAt }` em camelCase (AC #1 ✅).

O middleware `src/shared/middleware.ts` injeta `x-company-id` via `withSessionAuth` para `/api/company-apps` (linha `if (pathname.startsWith("/api/company-apps")) return true;` em `isSessionAuthApiRoute`).

**Frontend — `app/(dashboard)/apps/page.tsx` existe mas precisa de ajustes:**

A page atual:
- ✅ Já chama `listApps()` (usa `fetchWithAuth` → `GET /api/company-apps`) — AC #1 OK
- ✅ Já tem estado de loading — AC #2 (apenas texto, mas funciona; melhorar com skeleton)
- ❌ Estado vazio mostra "Nenhum app encontrado." sem CTA — AC #3 precisa de EmptyState
- ❌ Estado de erro mostra a mensagem mas sem botão retry — AC #4 precisa de retry
- ✅ Clique navega para `/apps/${app.id}` via `<Link>` — AC #5 OK (via botão "Ver detalhes")
- Colunas atuais: Nome, Ambiente, Status, Webhook, Criado em, Ações — ACs pedem: Nome, app_id, Status, Criado em

**Mudanças necessárias em `app/(dashboard)/apps/page.tsx`:**

1. Melhorar estado de loading com skeleton rows
2. Implementar EmptyState com CTA `/apps/new`
3. Adicionar botão "Tentar novamente" no erro
4. Simplificar/reorganizar colunas: Nome (+ app_id monospace abaixo), Status, Criado em
5. Tornar a row inteira clicável (wrap em `<Link>` ou onClick com router.push)

### Padrão de EmptyState (per UX spec)

```tsx
// Estado vazio — sem CTA condicionado a "apps.length === 0" (não filtro)
// Nota: o CTA só aparece quando a API retorna lista vazia, não quando o filtro resulta em vazio
{!loading && !error && apps.length === 0 && (
  <tr>
    <td colSpan={4} className="px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
          <LayoutGrid className="h-6 w-6 text-text-tertiary" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-text-primary">Nenhum app cadastrado</p>
          <p className="text-sm text-text-secondary">
            Crie seu primeiro app para integrar com a YaID.
          </p>
        </div>
        <Link
          href="/apps/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Criar primeiro app
        </Link>
      </div>
    </td>
  </tr>
)}
// Estado filtro vazio (query ativa mas sem resultado) — sem CTA
{!loading && !error && apps.length > 0 && filtered.length === 0 && (
  <tr>
    <td colSpan={4} className="px-6 py-12 text-center text-sm text-text-tertiary">
      Nenhum app corresponde ao filtro.
    </td>
  </tr>
)}
```

### Padrão de Skeleton Rows

```tsx
{loading && (
  Array.from({ length: 3 }).map((_, i) => (
    <tr key={i} className="border-b border-border">
      <td className="px-6 py-4">
        <div className="space-y-1.5">
          <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-surface-muted" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-5 w-20 animate-pulse rounded-full bg-surface-muted" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
      </td>
    </tr>
  ))
)}
```

### Padrão de Retry no Erro

```tsx
{!loading && error && (
  <tr>
    <td colSpan={4} className="px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-error-text">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    </td>
  </tr>
)}
```

### Colunas da Tabela (MVP)

| Coluna | Conteúdo | Largura |
|--------|----------|---------|
| Nome | `app.name` + `app.id` em mono abaixo | 50% |
| Status | `<StatusBadge status={app.status} />` | 20% |
| Criado em | `formatDate(app.createdAt)` | 30% |

Remover colunas MVP: Ambiente, Webhook — não exigidas pelos ACs e simplificam a tabela.

### Linhas Clicáveis

Tornar toda a row clicável usando `cursor-pointer` + `onClick` com `router.push`:
```tsx
import { useRouter } from "next/navigation";
const router = useRouter();
// ...
<tr
  key={app.id}
  onClick={() => router.push(`/apps/${app.id}`)}
  className="yaid-row cursor-pointer last:border-0"
>
```

Alternativa: envolver o `<tr>` em um `<Link>` (semântico mas tecnicamente inválido em HTML).
A solução com `onClick` + `cursor-pointer` é a prática padrão em dashboards React.

### O que NÃO alterar

- `app/api/company-apps/route.ts` — backend já correto, sem mudanças
- `src/modules/company-app/app/list_company_apps_*.ts` — camada de aplicação já implementada
- `utils/apps-store.ts` — `listApps()` já implementado corretamente
- `utils/fetch-with-auth.ts` — sem mudanças
- `app/(dashboard)/apps/[appId]/page.tsx` — escopo da Story 2.3
- `app/(dashboard)/apps/new/page.tsx` — escopo da Story 2.2

### Convenções do Projeto

- `fetchWithAuth` via `utils/apps-store.ts` (não chamar `fetch` diretamente no componente)
- Estados: sempre cobrir loading → erro → vazio → populado
- Toast: `toast.error()` de `sonner` (já importado na dashboard layout via `<Toaster>`)
- `StatusBadge` de `@/components/feedback/status-badge` — já existe, suporta `enabled`/`disabled`
- `PageHeader` de `@/components/layout/page-header` — já usado na page, manter
- CSS variables: `text-text-primary`, `text-text-secondary`, `bg-surface-muted`, etc.
- `yaid-row` CSS class para rows com hover effect

### Baseline de Testes

226 testes passando (total suite). 15 testes novos adicionados pela story 2.1. 12 falhas pré-existentes na story 5.2 (npx indisponível no ambiente — não relacionado a esta story).

Zero regressões — mudanças limitadas a `app/(dashboard)/apps/page.tsx` (componente client-only) + criação do arquivo de testes.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `app/(dashboard)/apps/page.tsx` | MODIFICAR | Refatorar estados loading/empty/error; simplificar colunas; linhas clicáveis |
| `tests/unit/story-2-1/listagem-de-aplicacoes.test.mjs` | CRIAR | Testes de contrato para backend e frontend |
| `app/api/company-apps/route.ts` | NÃO ALTERAR | Backend já implementado |
| `utils/apps-store.ts` | NÃO ALTERAR | listApps() já correto |
| `src/modules/company-app/app/list_*.ts` | NÃO ALTERAR | Camada de aplicação ok |

### References

- [Epics: Story 2.1 AC](../../planning-artifacts/epics.md#story-21-listagem-de-aplicações)
- [Backend: app/api/company-apps/route.ts](../../../../app/api/company-apps/route.ts)
- [Frontend: app/(dashboard)/apps/page.tsx](../../../../app/(dashboard)/apps/page.tsx)
- [ListCompanyAppsUseCase](../../../../src/modules/company-app/app/list_company_apps_usecase.ts)
- [apps-store: utils/apps-store.ts](../../../../utils/apps-store.ts)
- [StatusBadge: components/feedback/status-badge.tsx](../../../../components/feedback/status-badge.tsx)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Nenhum — implementação direta.

### Completion Notes List

- `app/(dashboard)/apps/page.tsx` refatorado: estado loading substituído por 3 skeleton rows com `animate-pulse`; estado vazio agora mostra `EmptyState` com ícone `LayoutGrid`, título, descrição e `<Link href="/apps/new">Criar primeiro app</Link>`; estado erro exibe mensagem + botão "Tentar novamente" que chama `reload()` via `setFetchKey`
- Colunas simplificadas de 6 → 3: Nome (+ app_id mono abaixo), Status, Criado em — ambiente e webhook removidos (não exigidos pelos ACs)
- Linhas clicáveis via `router.push(`/apps/${app.id}`)` em `onClick` da `<tr>` com `cursor-pointer`
- Filtros de status refatorados de `FilterPopover` para pills inline (habilitado/desabilitado) — mais simples e sem dependência do componente externo
- Backend `GET /api/company-apps` já estava correto — nenhuma mudança necessária nos módulos
- 15 testes novos criados, todos passando; zero regressões

### File List

**Criados:**
- `tests/unit/story-2-1/listagem-de-aplicacoes.test.mjs`

**Modificados:**
- `app/(dashboard)/apps/page.tsx`

**Não alterados (verificados apenas):**
- `app/api/company-apps/route.ts`
- `utils/apps-store.ts`
- `src/modules/company-app/app/list_company_apps_*.ts`

## Change Log

- 2026-06-03: Story criada e implementada via bmad-story-pipeline. Refatoração de `app/(dashboard)/apps/page.tsx`: skeleton rows, EmptyState com CTA, retry button, linhas clicáveis, colunas simplificadas. 15 testes adicionados (15/15 passando).
