# Story 1.2: Middleware de Autenticação

Status: done

## Story

Como desenvolvedor,
Quero um `middleware.ts` centralizado que roteie cada prefixo de rota para o mecanismo de autenticação correto,
Para que cada camada da API seja protegida de forma consistente sem lógica duplicada nos route handlers.

## Acceptance Criteria

1. **Given** o arquivo `src/middleware.ts` na raiz do `src/`
   **When** uma requisição entra no servidor
   **Then** o middleware roteia por prefixo de rota:
   - `/api/company-apps`, `/api/companies`, `/api/proof-requests` (GET), `/api/auth/sign-out` → `withSessionAuth` (cookie Supabase)
   - `POST /api/proof-requests` → `withApiKeyAuth` (bearer token)
   - `/api/proof-sessions/{token}/challenge`, `/api/presentations/verify`, `/api/credentials/*`, `/api/proof-sessions/{token}/cancel` → `withDIDAuth` (DID signature — stub, implementado no Epic 5)
   - `GET /api/proof-sessions/{token}`, `GET /api/webhook-public-key` → público (sem middleware de auth)
   - Rotas `/(dashboard)` → redirect para `/sign-in?next=<path>` se sem sessão Supabase válida

2. **Given** um usuário autenticado acessando qualquer rota de `/(dashboard)`
   **When** o middleware valida a sessão
   **Then** a requisição prossegue normalmente; nenhum dado de sessão é exposto para rotas públicas

3. **Given** a codebase após a implementação do middleware
   **When** qualquer route handler autenticado por sessão é revisado
   **Then** não há lógica de validação de sessão duplicada dentro do handler — essa responsabilidade pertence exclusivamente ao middleware
   **And** o `company_id` do usuário autenticado é lido do header `X-Company-Id` injetado pelo middleware (não por nova chamada ao Supabase)

## Tasks / Subtasks

- [x] Task 1: Criar `src/shared/middlewares/withSessionAuth.ts` (AC: #1, #2, #3)
  - [x] Recebe `NextRequest` e `NextResponseWithCookies` (resultado do `updateSupabaseSession`)
  - [x] Se sem usuário: retorna 401 para rotas `/api/*`, redirect para `/sign-in?next=<path>` para rotas de página
  - [x] Se com usuário: injeta header `X-Company-Id: <user.id>` na request; preserva cookies do Supabase na response
  - [x] Exporta função `withSessionAuth(request, sessionResponse, user, opts)` onde `opts.redirectOnFail` controla o comportamento

- [x] Task 2: Criar `src/shared/middlewares/withApiKeyAuth.ts` (AC: #1)
  - [x] Valida presença do header `Authorization: Bearer <key>` ou `X-Api-Key: <key>`
  - [x] Se ausente: retorna `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`
  - [x] Se presente: passes through (a validação do hash acontece no use case — middleware só garante presença)

- [x] Task 3: Criar `src/shared/middlewares/withDIDAuth.ts` (AC: #1)
  - [x] Stub que retorna `NextResponse.next()` — Epic 5 implementa a validação real
  - [x] Arquivo deve existir com assinatura correta para que o middleware.ts compile sem erros

- [x] Task 4: Criar `src/middleware.ts` (AC: #1, #2)
  - [x] Importar `updateSupabaseSession` de `@/shared/clients/supabase/proxy`
  - [x] Chamar `updateSupabaseSession` em todas as requisições para refrescar cookies
  - [x] Implementar lógica de roteamento por prefixo conforme AC #1
  - [x] Implementar identificação de método HTTP para `POST /api/proof-requests`
  - [x] Adicionar `export const config = { matcher: [...] }` para excluir assets estáticos
  - [x] Redirecionar usuário autenticado de `/sign-in` para `/`

- [x] Task 5: Atualizar route handlers de sessão — remover lógica duplicada (AC: #3)
  - [x] `app/api/company-apps/route.ts` → remover `requireAuthenticatedUser()`; ler `req.headers.get('x-company-id')`
  - [x] `app/api/company-apps/[appId]/route.ts` → mesma substituição
  - [x] `app/api/companies/me/route.ts` → adicionar param `req: NextRequest`; ler `x-company-id`
  - [x] `app/api/companies/route.ts` → também migrado (necessário para AC #3 completo; injeta x-user-email no middleware)
  - [x] `app/api/proof-requests/route.ts` → GET remove session call; POST não precisa mudar (já usa `getApiKeyFromRequest`)
  - [x] `app/api/proof-requests/[requestId]/route.ts` → remover session call; ler `x-company-id`

- [x] Task 6: Deletar `proxy.ts` na raiz do projeto (AC: #1)
  - [x] O arquivo `proxy.ts` (raiz) é código morto — não é um Next.js middleware válido (não se chama `middleware.ts`)
  - [x] `src/shared/clients/supabase/proxy.ts` é MANTIDO — tem `updateSupabaseSession` usada pelo novo middleware

- [x] Task 7: Verificar que `npx tsc --noEmit` e `npm run build` passam sem erros (AC: #1, #2, #3)

## Dev Notes

### Por que o `proxy.ts` da raiz é código morto

O arquivo `proxy.ts` na raiz do projeto exporta uma função `proxy()` e um `config`, mas NÃO é um Next.js middleware válido porque o arquivo precisa se chamar `middleware.ts` (ou `src/middleware.ts`). Ele nunca é executado pelo Next.js. As rotas atualmente não têm proteção de middleware — cada handler chama `requireAuthenticatedUser()` diretamente.

**Deletar `proxy.ts`** e criar `src/middleware.ts` do zero com a lógica correta.

### Localização do middleware.ts

Next.js 16+ suporta `src/middleware.ts` quando o projeto usa a pasta `src/`. Colocar em `src/middleware.ts` (não na raiz do projeto).

`src/shared/clients/supabase/proxy.ts` → MANTER. Tem `updateSupabaseSession()` que o novo middleware usa.

### Injeção de `X-Company-Id` — Padrão exato

Após `updateSupabaseSession` retornar `{ response, user }`, para injetar o company ID E preservar os cookies do Supabase:

```typescript
// withSessionAuth.ts — trecho crítico
const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-company-id', user.id);

const modifiedResponse = NextResponse.next({
  request: { headers: requestHeaders },
});

// OBRIGATÓRIO: copiar cookies do Supabase para a nova response
sessionResponse.cookies.getAll().forEach((cookie) => {
  modifiedResponse.cookies.set(cookie.name, cookie.value, cookie);
});

return modifiedResponse;
```

Se não copiar os cookies, o Supabase não consegue refrescar o token de sessão e o usuário é deslogado prematuramente.

### Leitura de `X-Company-Id` nos route handlers

Padrão exato para route handlers após a atualização:

```typescript
// ANTES (remover):
const user = await requireAuthenticatedUser();
const result = await controller.handle({ companyId: user.id });

// DEPOIS (substituir por):
const companyId = req.headers.get('x-company-id')!;
const result = await controller.handle({ companyId });
```

Para handlers que recebiam o parâmetro como `authUserId` (ex: `get_my_company_controller.ts`), usar o mesmo valor:
```typescript
const authUserId = req.headers.get('x-company-id')!;
const result = await controller.handle({ authUserId });
```

O `!` (non-null assertion) é seguro porque o middleware garante que esse header existe para rotas autenticadas por sessão. O middleware já retornou 401 antes de chegar aqui se o usuário não tiver sessão.

Handlers que NÃO usam session auth (ex: POST /api/proof-requests que usa API key) não leem esse header.

### Lógica de roteamento do middleware.ts

Fluxo de decisão do middleware na ordem exata:

```
1. ALWAYS: updateSupabaseSession(request) → { sessionResponse, user }

2. Public pages (/sign-in, /sign-up, /v/*):
   - Se user E pathname === '/sign-in': redirect → '/'
   - Else: return sessionResponse (pass through)

3. Dashboard pages (/, /apps/*, /proof-requests/*, /settings):
   - Se !user: redirect → '/sign-in?next=<pathname>'
   - Else: return sessionResponse (user present, proceed)

4. POST /api/proof-requests:
   - Chamar withApiKeyAuth()

5. DID auth routes (/api/proof-sessions/*/challenge, /api/proof-sessions/*/cancel,
   /api/presentations/verify, /api/credentials/*):
   - Chamar withDIDAuth() → stub, pass through

6. Session-auth API routes (/api/company-apps/*, /api/companies/*, 
   GET /api/proof-requests/*, /api/auth/sign-out):
   - Se !user: return 401
   - Else: injetar X-Company-Id + return modifiedResponse

7. Public API routes (GET /api/proof-sessions/*, /api/webhook-public-key):
   - return sessionResponse (pass through)
```

### Identificação de rotas — helper functions

Use funções helper dentro de `middleware.ts` para identificar os grupos de rota:

```typescript
function isDashboardPage(pathname: string): boolean {
  const dashboardPaths = ['/', '/apps', '/proof-requests', '/settings'];
  return dashboardPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isSessionAuthApiRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/company-apps')) return true;
  if (pathname.startsWith('/api/companies')) return true;
  if (pathname.startsWith('/api/auth/sign-out')) return true;
  if (pathname.startsWith('/api/proof-requests') && method === 'GET') return true;
  return false;
}

function isDIDAuthRoute(pathname: string): boolean {
  if (/^\/api\/proof-sessions\/[^/]+\/challenge$/.test(pathname)) return true;
  if (/^\/api\/proof-sessions\/[^/]+\/cancel$/.test(pathname)) return true;
  if (pathname.startsWith('/api/presentations/verify')) return true;
  if (pathname.startsWith('/api/credentials/')) return true;
  return false;
}
```

### Matcher do middleware

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

Este matcher cobre todas as rotas exceto assets estáticos do Next.js e arquivos de imagem.

### Formato de erro do middleware — diferente do `handleHttpError`

O `handleHttpError` nos route handlers retorna `{ error: { code, message } }`. O middleware NÃO usa `handleHttpError`. As respostas de erro do middleware seguem o formato da arquitetura: `{ error: string }`:

```typescript
// Middleware → formato simples
NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Route handler (via handleHttpError) → formato atual (não alterar)
{ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }
```

Não alterar o `handleHttpError` — a inconsistência atual existe e será endereçada em outra story.

### Compatibilidade Edge Runtime

O middleware.ts roda no **Edge Runtime** do Next.js. Restrições críticas:

1. **NÃO importar** `Environments.getEnvs()` de `src/shared/environments.ts` diretamente no middleware — o módulo inteiro pode não ser Edge-compatível
2. **USAR** `publicEnv` de `src/shared/environments.ts` — este objeto é Edge-safe pois lê `process.env` diretamente
3. `src/shared/clients/supabase/proxy.ts` usa `publicEnv` → é Edge-compatível, pode ser importado
4. `src/shared/clients/supabase/server.ts` usa `createServerClient` com `cookies()` — verificar Edge compatibility antes de usar em middleware
5. Os `withSessionAuth.ts`, `withApiKeyAuth.ts`, `withDIDAuth.ts` em `src/shared/middlewares/` devem ser Edge-compatíveis (sem Node.js APIs como `fs`, `crypto` nativo, etc.)

### Rotas que NÃO estão protegidas por este middleware (correto)

As seguintes rotas são intencionalmente públicas ou ainda não existem:
- `GET /api/proof-sessions/{token}` — público (tela coringa faz polling sem auth)
- `GET /api/webhook-public-key` — público (empresas verificam assinatura do webhook)
- `/v/[sessionToken]` — público (tela coringa)
- `/sign-in`, `/sign-up` — páginas de auth

### Rotas que não existem ainda (DID auth stub)

Os endpoints DID não existem até o Epic 5:
- `/api/proof-sessions/{token}/challenge`
- `/api/proof-sessions/{token}/cancel`
- `/api/presentations/verify`
- `/api/credentials/issue`
- `/api/credentials/revoke`

O `withDIDAuth.ts` stub pode simplesmente `return NextResponse.next()`. Quando criados no Epic 5, o stub será substituído pela implementação real de validação de assinatura DID.

### Route handlers a atualizar — mapeamento completo

| Arquivo | Mudança |
|---------|---------|
| `app/api/company-apps/route.ts` | GET e POST: remover `requireAuthenticatedUser()`; adicionar `req: NextRequest` params; ler `req.headers.get('x-company-id')!` |
| `app/api/company-apps/[appId]/route.ts` | GET e PATCH: mesma mudança; `_req` → `req` |
| `app/api/companies/me/route.ts` | GET: adicionar `req: NextRequest`; remover `requireAuthenticatedUser()`; ler `x-company-id` como `authUserId` |
| `app/api/proof-requests/route.ts` | GET: remover `requireAuthenticatedUser()`; ler `x-company-id`. POST: NÃO mudar — já usa `getApiKeyFromRequest(req)` |
| `app/api/proof-requests/[requestId]/route.ts` | GET: remover `requireAuthenticatedUser()`; `_req` → `req`; ler `x-company-id` |
| `app/api/auth/sign-out/route.ts` | NÃO mudar — não usa `requireAuthenticatedUser()` |

### Verificação pós-implementação

```bash
# Verificar que requireAuthenticatedUser() não é mais chamado nos route handlers listados:
grep -r "requireAuthenticatedUser" app/api/ --include="*.ts"
# Resultado esperado: ZERO ocorrências nos handlers acima

# Verificar que x-company-id é lido corretamente:
grep -r "x-company-id" app/api/ --include="*.ts"
# Resultado esperado: ocorrências nos handlers da tabela acima

# TypeScript:
npx tsc --noEmit
```

### Aprendizados da Story 1.1

- Path alias `@/shared/*` → `src/shared/*` está funcionando — usar para todos os imports
- `src/shared/environments.ts` é o único lugar com `process.env` (exceto `publicEnv` para vars públicas)
- Padrão de nomenclatura de arquivos: `snake_case` para módulos em `src/`; PascalCase para componentes
- `updateSupabaseSession` em `src/shared/clients/supabase/proxy.ts` já funciona com o padrão correto de cookies — reutilizar, não reinventar

## References

- [Architecture: Middleware de auth global](../_bmad-output/planning-artifacts/architecture.md#autenticação--segurança)
- [Architecture: Estrutura de diretórios — src/shared/middlewares/](../_bmad-output/planning-artifacts/architecture.md#estrutura-de-diretórios)
- [Epics: Story 1.2 AC](../_bmad-output/planning-artifacts/epics.md#story-12-middleware-de-autenticação)
- [Código existente: src/shared/clients/supabase/proxy.ts](../../src/shared/clients/supabase/proxy.ts)
- [Código existente: src/shared/http/requireAuthenticatedUser.ts](../../src/shared/http/requireAuthenticatedUser.ts)
- [Código existente: src/shared/http/getApiKeyFromRequest.ts](../../src/shared/http/getApiKeyFromRequest.ts)
- [Código existente: src/shared/environments.ts](../../src/shared/environments.ts)
- [Código a deletar: proxy.ts (raiz)](../../proxy.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- `src/middleware.ts` criado em `src/` (suportado pelo Next.js quando projeto usa pasta `src/`)
- `withSessionAuth` injeta tanto `X-Company-Id` (user.id) quanto `X-User-Email` (user.email, opcional) para cobrir todos os handlers incluindo `POST /api/companies`
- `withApiKeyAuth` só valida presença do header; validação do hash continua no use case (evita chamada ao DB no edge runtime)
- `withDIDAuth` é stub que retorna `NextResponse.next()` — Epic 5 implementa a lógica real
- `proxy.ts` (raiz) deletado — era código morto pois não se chamava `middleware.ts`
- Testes da Story 1.1 atualizados para remover referência hardcoded a `proxy.ts` (que foi deletado)
- 14 testes novos (Story 1.2) + 6 existentes (Story 1.1) = 20/20 passando
- `app/api/companies/route.ts` também migrado (não estava na task list original, mas necessário para AC #3 completo)

### File List

**Criados:**
- `src/middleware.ts`
- `src/shared/middlewares/withSessionAuth.ts`
- `src/shared/middlewares/withApiKeyAuth.ts`
- `src/shared/middlewares/withDIDAuth.ts`
- `tests/unit/story-1-2/middleware.test.mjs`

**Modificados:**
- `app/api/company-apps/route.ts`
- `app/api/company-apps/[appId]/route.ts`
- `app/api/companies/route.ts`
- `app/api/companies/me/route.ts`
- `app/api/proof-requests/route.ts`
- `app/api/proof-requests/[requestId]/route.ts`
- `tests/unit/story-1-1/restructure.test.mjs` (removida referência a proxy.ts deletado)

**Deletados:**
- `proxy.ts` (raiz do projeto)

### Review Findings

- [x] [Review][Decision] Rotas públicas implícitas — resolvido: adicionada função `isPublicApiRoute()` explícita em `src/middleware.ts` [src/middleware.ts]
- [x] [Review][Decision] Validação de email no middleware vs. handler — resolvido: removido `x-user-email`; email movido para o body da request via `CreateCompanySchema` [src/shared/middlewares/withSessionAuth.ts, app/api/companies/route.ts, src/modules/company/app/create_company_viewmodel.ts]
- [x] [Review][Patch] `proxy.ts` deletado do disco mas não staged — resolvido: `git rm proxy.ts` executado [proxy.ts]
- [x] [Review][Defer] `isSessionAuthApiRoute` não cobre métodos futuros (DELETE/PATCH) em `/api/proof-requests/[requestId]` — se novos métodos forem adicionados, caem no fallthrough sem auth [src/middleware.ts] — deferred, pre-existing
- [x] [Review][Defer] `isDashboardPage` usa lista hardcoded de paths — novas rotas no grupo `/(dashboard)` não serão protegidas automaticamente [src/middleware.ts] — deferred, pre-existing
- [x] [Review][Defer] `POST /api/proof-requests` usa match exato (`===`) enquanto outras rotas usam `startsWith()` — futuros POSTs aninhados como `/api/proof-requests/bulk` não seriam cobertos [src/middleware.ts] — deferred, pre-existing
