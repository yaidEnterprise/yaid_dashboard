# Story 13.1: Mover Dashboard para `/dashboard` e Ajustar Middleware/Redirects

Status: review

## Story

Como desenvolvedor,
Quero liberar a rota raiz `/` do dashboard e mover a home atual para `/dashboard`,
Para que a landing page institucional possa ocupar `/` sem quebrar o acesso autenticado.

## Acceptance Criteria

1. **Given** o Overview atual em `app/(dashboard)/page.tsx`, **when** a mudança é aplicada, **then** o mesmo conteúdo passa a viver em `app/(dashboard)/dashboard/page.tsx`, servindo `/dashboard` com o layout autenticado e sem alteração funcional.
2. **Given** `src/shared/middleware.ts`, **when** uma rota autenticada do dashboard é acessada, **then** `/dashboard`, `/apps`, `/proof-requests`, `/settings` e suas subrotas continuam protegidas, enquanto `/` deixa de ser classificada como dashboard.
3. **Given** uma requisição para `/`, **when** existe usuário autenticado, **then** o middleware redireciona para `/dashboard`; **when** não existe usuário autenticado, **then** a requisição prossegue sem redirect de autenticação.
4. **Given** um usuário autenticado em `/sign-in` ou `/sign-up`, **when** o middleware processa a requisição, **then** redireciona para `/dashboard`.
5. **Given** login ou cadastro concluído sem um parâmetro `next` seguro, **when** o frontend escolhe o destino padrão, **then** navega para `/dashboard`; um `next` interno válido continua sendo preservado e URLs absolutas/protocol-relative continuam rejeitadas.
6. **Given** `components/layout/app-sidebar.tsx`, **when** o pathname é `/dashboard`, **then** o item “Overview” aponta para `/dashboard` e fica ativo sem alterar os demais itens.
7. **Given** a suíte que tratava `/` como Overview, **when** a mudança termina, **then** referências e testes são atualizados para `/dashboard`, os testes da story cobrem a matriz de redirects e a suíte completa passa.

## Tasks / Subtasks

- [x] Mover o Overview sem refatoração funcional (AC: #1)
  - [x] Criar `app/(dashboard)/dashboard/` e mover `app/(dashboard)/page.tsx` para `app/(dashboard)/dashboard/page.tsx` preservando o conteúdo byte a byte sempre que possível.
  - [x] Atualizar contratos/testes que leem o caminho antigo; não alterar fetches, estados, conteúdo ou layout do Overview.
- [x] Ajustar a classificação e os redirects do middleware (AC: #2–#4)
  - [x] Trocar `"/"` por `"/dashboard"` em `dashboardPaths`, preservando a proteção das subrotas e evitando falso positivo como `/dashboard-extra`.
  - [x] Adicionar tratamento explícito de `pathname === "/"`: redirecionar apenas quando `user` existir e retornar `sessionResponse` para visitante anônimo.
  - [x] Redirecionar usuário autenticado em `/sign-in` e `/sign-up` para `/dashboard`.
  - [x] Não alterar a classificação das APIs, `/v/*`, `/apps`, `/proof-requests` ou `/settings`.
- [x] Atualizar destinos do frontend (AC: #5–#6)
  - [x] Alterar o fallback seguro do login para `/dashboard`, preservando a validação contra open redirect e o uso de `next` válido.
  - [x] Alterar o redirect pós-cadastro com sessão para `/dashboard`; manter o fallback para `/sign-in` quando a sessão não for estabelecida.
  - [x] Alterar `AppSidebar` para `href="/dashboard"` e atividade exata do Overview.
- [x] Atualizar e adicionar testes (AC: #2–#7)
  - [x] Atualizar os testes legados das Stories 1.4, 1.5, 1.6 e 3.5 que codificam `/` ou o caminho antigo do Overview.
  - [x] Criar `tests/unit/story-13-1/dashboard-route-migration.test.mjs` com contratos de arquivos, middleware, redirects, sidebar e preservação de `next`.
  - [x] Cobrir: autenticado `/` → `/dashboard`; anônimo `/` sem redirect; anônimo `/dashboard` → `/sign-in?next=/dashboard`; auth pages autenticadas → `/dashboard`; subrotas continuam protegidas.
  - [x] Executar teste da story, `npm test`, lint e typecheck/build conforme scripts existentes.

## Dev Notes

### Escopo e comportamento atual

- O Overview atual é um Client Component completo em `app/(dashboard)/page.tsx`; ele usa `fetchWithAuth`, `listApps` e `listProofRequests` e herda sidebar/topbar de `app/(dashboard)/layout.tsx`. A mudança é somente de localização.
- `src/shared/middleware.ts` atualiza cookies Supabase em toda requisição, trata páginas públicas de auth antes do dashboard e delega páginas protegidas a `withSessionAuth`. Preserve essa ordem e todos os ramos de API/DID existentes.
- `components/layout/app-sidebar.tsx` tem quatro itens. Somente o URL e a regra de atividade do Overview mudam.
- `app/sign-in/page.tsx` já valida `next` com `startsWith("/") && !startsWith("//")`; mude apenas o fallback.
- `app/sign-up/page.tsx` faz login após criar a conta; somente o redirect do caminho com sessão muda.

### Limite com a Story 13.2

- Não criar `app/page.tsx`, placeholder, hero, CTA, layout de marketing ou conteúdo institucional nesta story. Isso pertence à 13.2.
- Após a 13.1 isolada, `/` fica livre e anônima no middleware, mas pode responder 404 até a 13.2 criar a landing. Para esta story, “deixa passar” significa ausência de redirect de autenticação, não presença antecipada da landing.
- Não criar rewrite, feature flag ou verificação de sessão duplicada na página para mascarar esse estado intermediário.

### Arquitetura e implementação mínima

- Stack observada: Next.js 16 App Router/Proxy, React 19, TypeScript 5 e Tailwind CSS 4; nenhuma dependência nova é necessária.
- Route groups não fazem parte da URL: `app/(dashboard)/dashboard/page.tsx` resolve para `/dashboard` e continua herdando `app/(dashboard)/layout.tsx`.
- O Proxy do Next.js executa antes das rotas; `NextResponse.redirect(new URL("/dashboard", request.url))` é o mecanismo já adotado no projeto e suportado pelo framework.
- Prefira um move puro do arquivo e alterações literais nos quatro destinos conhecidos. Não extraia constantes ou helpers de rota sem necessidade.
- Não alterar schema, APIs, env vars, CI/CD, dependências, design ou URLs de `/apps`, `/proof-requests` e `/settings`.

### Testing Requirements

- Seguir o padrão existente em `tests/unit/story-*/`: `node:test`, `node:assert/strict` e contratos por leitura de arquivos.
- Atualizar testes legados em vez de relaxá-los. Em especial:
  - `tests/unit/story-1-4/sign-in-redirect.test.mjs` espera o fallback seguro antigo;
  - `tests/unit/story-1-5/signup-atomico.test.mjs` espera o redirect pós-cadastro antigo;
  - `tests/unit/story-1-6/login-e-protecao-de-rotas.test.mjs` espera `/` protegido, auth redirect para `/` e fallback seguro `/`;
  - `tests/unit/story-3-5/overview-dashboard.test.mjs` lê `app/(dashboard)/page.tsx`.
- O teste novo deve distinguir match exato/de subrota de prefixos semelhantes e garantir que `/` anônimo retorna o response normal.
- Rodar a suíte completa porque o middleware é compartilhado por todas as rotas protegidas.
- Existem alterações locais pré-existentes em `src/shared/environments.ts` e testes das Stories 1.1/10.2; preservá-las e não atribuí-las a esta story.

### Project Structure Notes

- Arquivo movido esperado: `app/(dashboard)/dashboard/page.tsx`.
- Arquivo removido pelo move: `app/(dashboard)/page.tsx`.
- Arquivos atualizados esperados: `src/shared/middleware.ts`, `components/layout/app-sidebar.tsx`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx` e testes legados afetados.
- Teste novo esperado: `tests/unit/story-13-1/dashboard-route-migration.test.mjs`.

### Git Intelligence

- Os commits recentes registraram os Epics 12/13 e os Correct Course correspondentes; não há implementação prévia da 13.1 para reaproveitar.
- O repositório usa Conventional Commits e testes contratuais por story. O commit da 13.1 deve excluir mudanças locais não relacionadas.

### Latest Technical Information

- A documentação oficial do Next.js 16 confirma `proxy.ts` como convenção atual, execução antes das rotas, `matcher` por pathname e `NextResponse.redirect` para redirects condicionais.
- Referência: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 13: Landing Page Institucional`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 13.1: Mover Dashboard para /dashboard e Ajustar Middleware/Redirects`]
- [Source: `_bmad-output/planning-artifacts/prd.md#Landing page institucional`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-22-landing-page.md#Análise de Impacto`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-22-landing-page.md#Handoff de Implementação`]
- [Source: `src/shared/middleware.ts`]
- [Source: `app/(dashboard)/page.tsx`]
- [Source: `components/layout/app-sidebar.tsx`]
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- 2026-08-28: conflito de estado intermediário com a 13.2 explicitado; `/` anônimo livre não implica landing presente nesta story.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-08-28: implementação concluída. O Overview foi movido byte a byte (`mv`), sem qualquer alteração de conteúdo, fetches, estados ou layout.
- `isDashboardPage` agora usa `["/dashboard", "/apps", "/proof-requests", "/settings"]` com match exato ou de subrota (`${p}/`), de modo que `/dashboard-extra` não é falso positivo. Os ramos de API, `/v/*` e DID não foram tocados; apenas a numeração dos comentários de etapa foi ajustada para acomodar a nova regra 2.
- O novo ramo `pathname === "/"` fica entre as páginas públicas de auth e as páginas de dashboard: autenticado → `NextResponse.redirect("/dashboard")`; anônimo → `sessionResponse` (sem redirect de autenticação). Nenhuma landing foi criada — `/` responde 404 até a Story 13.2.
- `AppSidebar.isActive` foi simplificado para `pathname === url || pathname.startsWith(`${url}/`)`, o que remove o caso especial de `/` e, de quebra, elimina o falso positivo que `startsWith(url)` causava em rotas como `/apps-extra`.
- `.next/types` estava obsoleto e apontava para o caminho antigo do Overview; regenerado com `npx next typegen`. `npx tsc --noEmit` fica limpo depois disso.
- Não foram tocados `sprint-status.yaml` nem `package.json` (outro agente trabalha na mesma árvore em paralelo na Story 12.1).

### File List

- `_bmad-output/implementation-artifacts/stories/13-1-mover-dashboard-para-dashboard-e-ajustar-middleware.md` (atualizado)
- `app/(dashboard)/dashboard/page.tsx` (movido de `app/(dashboard)/page.tsx`, conteúdo inalterado)
- `app/(dashboard)/page.tsx` (removido pelo move)
- `src/shared/middleware.ts` (atualizado)
- `app/sign-in/page.tsx` (atualizado)
- `app/sign-up/page.tsx` (atualizado)
- `components/layout/app-sidebar.tsx` (atualizado)
- `tests/unit/story-13-1/dashboard-route-migration.test.mjs` (novo, contrato da story)
- `tests/unit/story-1-4/sign-in-redirect.test.mjs` (atualizado — fallback `/dashboard`)
- `tests/unit/story-1-5/signup-atomico.test.mjs` (atualizado — `router.push("/dashboard")`)
- `tests/unit/story-1-6/login-e-protecao-de-rotas.test.mjs` (atualizado — `isDashboardPage`, alvo do redirect e guard de `next`)
- `tests/unit/story-3-5/overview-dashboard.test.mjs` (atualizado — novo caminho do Overview)
