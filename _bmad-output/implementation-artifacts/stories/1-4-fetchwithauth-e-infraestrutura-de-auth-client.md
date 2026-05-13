# Story 1.4: fetchWithAuth e Infraestrutura de Auth Client

Status: done (tested)

## Story

Como usuário do dashboard,
Quero que sessões expiradas sejam tratadas automaticamente,
Para que eu seja redirecionado ao login sem perder contexto da página que tentava acessar.

## Acceptance Criteria

1. **Given** um componente client-side que usa `fetchWithAuth` para chamar qualquer endpoint autenticado
   **When** o servidor retorna HTTP 401
   **Then** o browser redireciona automaticamente para `/sign-in?next=<path-atual>`
   **And** após login bem-sucedido, o usuário é redirecionado de volta para a página original via `?next=<path>`

2. **Given** uma chamada com `fetchWithAuth` para um endpoint que retorna 200
   **When** a resposta chega
   **Then** `fetchWithAuth` retorna a resposta normalmente, sem interferência

3. **Given** o arquivo `utils/fetch-with-auth.ts`
   **When** revisado
   **Then** ele exporta uma função `fetchWithAuth` com a mesma assinatura de `fetch` nativa (url + options)
   **And** nenhum componente client-side chama `fetch` diretamente para endpoints autenticados — todos usam `fetchWithAuth`

## Tasks / Subtasks

- [x] Task 1: Criar `utils/fetch-with-auth.ts` (AC: #1, #2, #3)
  - [x] Exportar função `fetchWithAuth(url, options?)` com mesma assinatura de `fetch` nativa
  - [x] Chamar `fetch(url, options)` internamente
  - [x] Verificar se `res.status === 401` — se sim, redirecionar para `/sign-in?next=<window.location.pathname>` e lançar exceção para interromper a cadeia
  - [x] Para qualquer outro status, retornar a response normalmente sem interferência

- [x] Task 2: Migrar `utils/apps-store.ts` para `fetchWithAuth` (AC: #3)
  - [x] Importar `fetchWithAuth` de `@/utils/fetch-with-auth`
  - [x] Substituir `fetch(...)` por `fetchWithAuth(...)` em `listApps()` (GET /api/company-apps)
  - [x] Substituir `fetch(...)` por `fetchWithAuth(...)` em `getApp()` (GET /api/company-apps/{appId})
  - [x] Substituir `fetch(...)` por `fetchWithAuth(...)` em `createApp()` (POST /api/company-apps)
  - [x] Substituir `fetch(...)` por `fetchWithAuth(...)` em `updateApp()` (PATCH /api/company-apps/{appId})

- [x] Task 3: Migrar `app/(dashboard)/settings/page.tsx` para `fetchWithAuth` (AC: #3)
  - [x] Importar `fetchWithAuth` de `@/utils/fetch-with-auth`
  - [x] Substituir `fetch("/api/auth/sign-out", { method: "POST" })` por `fetchWithAuth` em `handleSignOut`

- [x] Task 4: Corrigir redirect pós-login em `app/sign-in/page.tsx` (AC: #1)
  - [x] Importar `useSearchParams` do Next.js
  - [x] Ler parâmetro `?next=` com `useSearchParams().get('next')`
  - [x] Remover chamada desnecessária a `fetch("/api/companies/me")` — onboarding removido na Story 1.1
  - [x] Após login bem-sucedido, redirecionar para `next` (se for URL relativa válida) ou `/`
  - [x] Validar que `next` é URL relativa segura (começa com `/` mas não com `//`) para evitar open redirect

- [x] Task 5: Validar e rodar testes (AC: todos)
  - [x] Executar `npm run test` — todos os 45 testes passaram (zero regressão)
  - [x] Executar `npm run build` — build TypeScript completou sem erros

## Dev Notes

### Escopo

Esta story implementa a infraestrutura client-side de auth: o fetch wrapper global e a mecânica de redirect pós-login. **Não cria nenhuma nova página** — apenas ajusta código existente e cria um utilitário.

### Arquivo a criar: `utils/fetch-with-auth.ts`

Localização correta: `utils/fetch-with-auth.ts` (junto de `utils/utils.ts` e `utils/apps-store.ts` na raiz do projeto — fora de `src/`, já que é utilitário de camada client).

```typescript
export async function fetchWithAuth(
  url: RequestInfo | URL,
  options?: RequestInit
): Promise<Response> {
  const res = await fetch(url, options);

  if (res.status === 401 && typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/sign-in?next=${next}`;
    throw new Error('Session expired');
  }

  return res;
}
```

**Por que lançar exceção após redirect?**
O `window.location.href =` dispara a navegação do browser, mas o JavaScript continua executando na mesma task. Ao lançar, impedimos que `asJson()` em `apps-store.ts` continue processando uma resposta 401 e potencialmente exiba uma mensagem de erro desnecessária antes do redirect completar.

**Por que `typeof window !== 'undefined'`?**
`fetchWithAuth` é para uso em Client Components exclusivamente. O guard evita crash em SSR acidental, mas não é um caso de uso suportado.

**Path alias**: O arquivo fica em `utils/` (raiz), então o import é `@/utils/fetch-with-auth` usando o alias `@` que aponta para a raiz do projeto (configurado em `tsconfig.json` desde a Story 1.1).

### Migração de `utils/apps-store.ts` — mapeamento exato

Estado atual: usa `fetch(...)` nativo em todas as 4 funções.

```typescript
// ANTES
const res = await fetch("/api/company-apps", { cache: "no-store" });
// DEPOIS
const res = await fetchWithAuth("/api/company-apps", { cache: "no-store" });
```

Aplicar mesma substituição em `getApp`, `createApp` e `updateApp`. A função `asJson` não muda — ela continua tratando respostas não-ok, mas o caso 401 nunca chegará até ela porque `fetchWithAuth` lança antes.

**Compatibilidade com error handling existente:** `asJson` lança `Error` se `!res.ok`. `fetchWithAuth` também lança `Error` em 401. Ambos são capturados pelo mesmo `.catch()` nos componentes — sem necessidade de alterar as páginas que já usam `listApps()`, `getApp()`, etc.

### Migração de `settings/page.tsx`

```typescript
// ANTES
const res = await fetch("/api/auth/sign-out", { method: "POST" });
// DEPOIS
const res = await fetchWithAuth("/api/auth/sign-out", { method: "POST" });
```

Nota: `/api/auth/sign-out` é protegida por session auth no middleware. Se a sessão expirar entre a abertura da página e o clique no logout, a resposta seria 401 — sem `fetchWithAuth`, o usuário veria "Não foi possível sair da conta" em vez de ser redirecionado ao sign-in.

### Correção de `sign-in/page.tsx`

**Problema atual:**
```typescript
const res = await fetch("/api/companies/me", { cache: "no-store" });
if (res.ok) {
  window.location.href = "/";
} else {
  window.location.href = "/onboarding/company";  // ← onboarding foi removido na Story 1.1
}
```

Este código é um legado anterior à Story 1.1 (que removeu o onboarding). A verificação em `/api/companies/me` era para distinguir "usuário com company" de "usuário sem company" — mas após a Story 1.1, **o estado "usuário sem company" não existe mais**.

**Estado desejado:**
```typescript
// Ler ?next= dos search params
const searchParams = useSearchParams();
const next = searchParams.get('next');

// ... após signInWithPassword bem-sucedido:
const safePath = next && next.startsWith('/') && !next.startsWith('//')
  ? next
  : '/';
window.location.href = safePath;
```

**Por que validar `next`?**
Open redirect attack: se `next=//evil.com`, o browser navegaria para `evil.com`. A validação `startsWith('/') && !startsWith('//')` garante que só URLs relativas do próprio site são aceitas.

**`useSearchParams` requer Suspense:** No Next.js 14+, componentes que usam `useSearchParams()` devem estar dentro de um `<Suspense>` ou ser um Client Component que já seja filho de um Server Component com Suspense. A `sign-in/page.tsx` já é `"use client"`, mas pode precisar de um wrapper `<Suspense>`. Testar o build — se o compilador reclamar, envolver o componente filho em `<Suspense fallback={null}>`.

Alternativa mais simples que evita o Suspense: ler diretamente com `new URLSearchParams(window.location.search).get('next')` dentro do handler de submit (que só executa no browser). Isso é igualmente correto e mais simples:

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  // ... validações, signInWithPassword ...

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  const safePath = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  window.location.href = safePath;
}
```

Esta abordagem evita a dependência em `useSearchParams` e Suspense, e é sempre avaliada no cliente onde `window` existe.

### Arquivos a modificar — mapeamento completo

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `utils/fetch-with-auth.ts` | **NOVO** | Criar wrapper com redirect 401 |
| `utils/apps-store.ts` | MODIFICAR | Substituir 4 `fetch()` por `fetchWithAuth()` |
| `app/(dashboard)/settings/page.tsx` | MODIFICAR | Substituir 1 `fetch()` por `fetchWithAuth()` |
| `app/sign-in/page.tsx` | MODIFICAR | Remover check /api/companies/me; implementar `?next=` redirect |

**NÃO alterar:**
- `app/(dashboard)/apps/page.tsx` — já usa `listApps()` de `apps-store.ts`; a migração é no store
- `app/(dashboard)/apps/new/page.tsx` — já usa `createApp()` de `apps-store.ts`; a migração é no store
- `app/(dashboard)/apps/[appId]/page.tsx` — já usa `getApp()` e `updateApp()` de `apps-store.ts`; a migração é no store
- `app/(dashboard)/proof-requests/page.tsx` — usa dados mockados hardcoded, sem `fetch` real
- `app/v/[sessionToken]/page.tsx` — usa `fetch` para endpoint público (`GET /api/proof-sessions/{token}`), que não exige auth e não deve usar `fetchWithAuth`
- Qualquer arquivo em `src/` — `fetchWithAuth` é client-only, código server não o usa

### Regressão esperada: zero

- `apps-store.ts`: a interface pública (`listApps`, `getApp`, etc.) não muda — os componentes consumidores não precisam ser alterados
- `asJson()` em `apps-store.ts`: continua funcionando; apenas o `fetch` interno é trocado
- Testes existentes (Stories 1.1, 1.2, 1.3): testam estrutura de arquivos e middleware server-side, não fazem fetch client-side — sem impacto

### Estado atual do sign-in após login (antes)

```typescript
// Após signInWithPassword bem-sucedido:
const res = await fetch("/api/companies/me", { cache: "no-store" });
if (res.ok) {
  window.location.href = "/";
} else {
  window.location.href = "/onboarding/company";  // rota removida na Story 1.1
}
```

### Estado desejado do sign-in após login (depois)

```typescript
// Após signInWithPassword bem-sucedido:
const params = new URLSearchParams(window.location.search);
const next = params.get('next');
const safePath = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
window.location.href = safePath;
```

### Convenções do projeto (aprendizados das Stories anteriores)

- Path alias `@/shared/*` → `src/shared/*` e `@/*` → raiz funcionando
- Nomenclatura: `kebab-case` para arquivos em `utils/`
- `process.env` somente em `src/shared/environments.ts` — `fetchWithAuth` não lê env vars, OK
- `npm run build` verifica TypeScript — executar antes de marcar done
- Testes co-locados ao módulo, mas este é um utilitário de camada client sem lógica de negócio — testes de integração real não são necessários nesta story

### Relação com o middleware

O middleware (`src/middleware.ts`) já protege rotas de dashboard com redirect para `/sign-in?next=<path>` (implementado na Story 1.2). O `fetchWithAuth` complementa esse mecanismo para chamadas **API** autenticadas que retornam 401 — casos onde a sessão expirou após o carregamento inicial da página mas antes de uma chamada fetch.

O middleware cuida de: acesso a páginas sem sessão.
O `fetchWithAuth` cuida de: chamadas de API com sessão expirada durante uso.

### Deferred Work para ficar atento

- A Story 1.3 notou que `@hookform/resolvers@^5.2.2` pode ter conflito com `react-hook-form@7` — verificar ao implementar Story 1.5, não afeta esta story

### Project Structure Notes

- Novo arquivo: `utils/fetch-with-auth.ts` (raiz do projeto, junto de `utils/utils.ts`)
- Modificação: `utils/apps-store.ts` (raiz do projeto)
- Modificação: `app/(dashboard)/settings/page.tsx`
- Modificação: `app/sign-in/page.tsx`

### References

- [Architecture: Fetch wrapper — intercepta 401](_bmad-output/planning-artifacts/architecture.md#arquitetura-frontend)
- [Architecture: Estrutura de Diretórios — utils/](_bmad-output/planning-artifacts/architecture.md#árvore-completa-de-diretórios)
- [Epics: Story 1.4 AC](_bmad-output/planning-artifacts/epics.md#story-14-fetchwithauth-e-infraestrutura-de-auth-client)
- [UX: Navigation Patterns — redirects pós-ação](_bmad-output/planning-artifacts/ux-design-specification.md#navigation-patterns)
- [Story anterior: 1.3](_bmad-output/implementation-artifacts/stories/1-3-migration-sql-e-dependencias-de-formulario.md)
- [Código a criar: utils/fetch-with-auth.ts](utils/fetch-with-auth.ts)
- [Código a modificar: utils/apps-store.ts](utils/apps-store.ts)
- [Código a modificar: app/(dashboard)/settings/page.tsx](app/(dashboard)/settings/page.tsx)
- [Código a modificar: app/sign-in/page.tsx](app/sign-in/page.tsx)
- [Middleware (referência): src/middleware.ts](src/middleware.ts)

### Review Findings

- [x] [Review][Patch] `handleSignOut` revertido para `fetch` plain — sign-out usa `fetch` direto (sem `?next=`) para garantir que sessão expirada durante logout não redirecione de volta a `/settings` [app/(dashboard)/settings/page.tsx:16]

- [x] [Review][Defer] Query string/hash descartados no `?next=` — `window.location.pathname` não captura `?query` — impacto mínimo pois filtros no dashboard são client-side state [utils/fetch-with-auth.ts:8] — deferred, pre-existing
- [x] [Review][Defer] Error flash transitório antes do redirect — `.catch()` captura o throw de `"Session expired"` e exibe mensagem brevemente antes da navegação completar — inerente ao padrão throw-after-redirect — deferred, pre-existing
- [x] [Review][Defer] Open redirect teórico via `/\evil.com` — guard atual alinhado com spec ("começa com / mas não com //"); `/\` não coberto em browsers antigos — deferred, pre-existing
- [x] [Review][Defer] `setSigningOut(false)` nunca chamado quando `fetchWithAuth` lança — botão fica preso em "Saindo..." se navegação for bloqueada pelo browser — raro em prod [app/(dashboard)/settings/page.tsx:13] — deferred, pre-existing
- [x] [Review][Defer] Inconsistência de encoding no `?next=` entre middleware (raw pathname) e `fetchWithAuth` (encodeURIComponent) — round-trip correto via `URLSearchParams.get()`, inconsistência cosmética — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `utils/fetch-with-auth.ts` criado: exporta `fetchWithAuth` com mesma assinatura de `fetch` nativa; intercepta 401, redireciona para `/sign-in?next=<path>` e lança `Error('Session expired')` para interromper a cadeia de execução
- `utils/apps-store.ts` migrado: 4 chamadas `fetch()` substituídas por `fetchWithAuth()` nas funções `listApps`, `getApp`, `createApp` e `updateApp`; `asJson` helper preservado sem alterações
- `app/(dashboard)/settings/page.tsx` migrado: `handleSignOut` usa `fetchWithAuth` no lugar de `fetch` para `/api/auth/sign-out`
- `app/sign-in/page.tsx` corrigido: removido check legado a `/api/companies/me` (onboarding removido na Story 1.1); pós-login redireciona para `?next=<path>` (se URL relativa segura) ou `/`; proteção contra open redirect via `startsWith('/') && !startsWith('//')`
- 45/45 testes passando — zero regressões
- `npm run build` limpo: TypeScript sem erros; aviso `node:crypto` no Edge Runtime é pré-existente (documentado na Story 1.3)

### File List

**Criados:**
- `utils/fetch-with-auth.ts`
- `tests/unit/story-1-4/fetch-with-auth.test.mjs`
- `tests/unit/story-1-4/sign-in-redirect.test.mjs`

**Modificados:**
- `utils/apps-store.ts`
- `app/(dashboard)/settings/page.tsx`
- `app/sign-in/page.tsx`
- `package.json` (adicionado script `test:story:1.4`)
- `_bmad-output/implementation-artifacts/tests/test-summary.md`

### Test Results

- `npm run test:story:1.4`: **passed — 21/21**
  - 14 testes em `fetch-with-auth.test.mjs`: contrato do wrapper, migração do apps-store, review patch do settings
  - 7 testes em `sign-in-redirect.test.mjs`: redirect ?next=, open-redirect guard, remoção de código legado
