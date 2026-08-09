# Story 11.1: Health Check Endpoint

Status: done

> **Nota de contexto:** este é o primeiro épico de infraestrutura de entrega (Epic 11, Sprint Change
> 2026-08-08). Diferente dos módulos de domínio (`company`, `proof-request`, `credential` etc.), este
> endpoint é infraestrutura pura — sem regra de negócio, sem acesso a banco, sem camadas
> usecase/controller/presenter/viewmodel. É intencionalmente um route handler único e mínimo,
> conforme descrito na Story 11.1 da proposta: *"`app/api/health/route.ts` público (`{status:"ok"}`),
> `force-dynamic`, sem DB/secrets; whitelisting em `middleware.ts`"*.
>
> **Estado encontrado na codebase:** `app/api/health/route.ts` e o ajuste correspondente em
> `src/shared/middleware.ts` (`isPublicApiRoute`) **já existem como mudanças não commitadas** no working
> tree, aparentemente implementados antes da formalização desta story. Este arquivo de story documenta o
> contrato esperado e a task de dev deve **validar** o código existente contra os ACs abaixo (e corrigir
> se houver divergência), não reescrevê-lo do zero. Testes automatizados também precisam ser criados —
> não existe `tests/unit/story-11-1/` ainda.

## Story

Como pipeline de CI/CD de produção (job `smoke-test`, Story 11.6),
Quero um endpoint público e leve `GET /api/health` que responda rapidamente sem tocar banco de dados
ou expor segredos,
Para que eu possa validar que a aplicação publicada no Amplify está no ar antes de considerar o release
bem-sucedido.

## Acceptance Criteria

1. **Given** uma requisição `GET /api/health` sem autenticação
   **When** o handler é executado
   **Then** retorna HTTP 200 com corpo JSON `{ "status": "ok" }`
   **And** o header `Cache-Control: no-store` está presente (evita cache do smoke-test/CDN mascarando um
   ambiente degradado)

2. **Given** a rota `app/api/health/route.ts`
   **When** o Next.js compila/executa a rota
   **Then** ela exporta `export const dynamic = "force-dynamic"` — nunca deve ser estaticamente
   otimizada/cacheada em build time, pois precisa refletir o estado real do servidor a cada chamada

3. **Given** o handler `GET /api/health`
   **When** sua implementação é inspecionada
   **Then** ele **não** consulta o banco de dados (Supabase), **não** lê `process.env` diretamente nem
   via `Environments`/`environments.ts`, e **não** importa nenhum módulo de domínio
   (`company`, `company-app`, `proof-request`, `credential`, `webhook`) — deve ser independente de
   qualquer infraestrutura externa para não falhar por motivos alheios à disponibilidade do processo
   Next.js em si

4. **Given** `src/shared/middleware.ts` (`proxy.ts` na raiz delega para este arquivo)
   **When** uma requisição `GET /api/health` chega ao middleware
   **Then** `isPublicApiRoute(pathname, method)` retorna `true` para `pathname === "/api/health"` e
   `method === "GET"` — a rota não passa por `withSessionAuth`, `withApiKeyAuth` nem `withDIDAuth`
   **And** nenhuma outra rota classificada anteriormente (dashboard pages, `/api/company-apps`,
   `/api/proof-requests`, rotas DID-auth etc.) muda de comportamento

5. **Given** o smoke-test da pipeline (Story 11.6, fora do escopo de implementação desta story, mas
   consumidor direto deste endpoint)
   **When** ele faz `GET $PRODUCTION_URL/api/health`
   **Then** o endpoint responde de forma determinística e rápida o suficiente para retries com timeout
   curto — nenhuma chamada de rede/IO bloqueante (DB, blockchain RPC, OCR provider) pode estar no
   caminho do handler

## Tasks / Subtasks

- [x] Task 1: Validar/implementar `app/api/health/route.ts` (AC: #1, #2, #3)
  - [x] Confirmar que o arquivo exporta `export const dynamic = "force-dynamic";`
  - [x] Confirmar que `GET()` retorna `NextResponse.json({ status: "ok" }, { status: 200, headers: { "Cache-Control": "no-store" } })`
  - [x] Confirmar que não há imports de `@supabase/*`, `src/shared/environments`, nem de qualquer
    `src/modules/*` — o arquivo deve depender apenas de `next/server`
  - [x] Se o arquivo já existente (não commitado) já satisfaz tudo isso, apenas validar — não reescrever
    sem necessidade

- [x] Task 2: Validar/implementar whitelisting em `src/shared/middleware.ts` (AC: #4)
  - [x] Confirmar a linha `if (pathname === "/api/health" && method === "GET") return true;` dentro de
    `isPublicApiRoute`
  - [x] Confirmar que a posição no fluxo do middleware (branch 6, "Explicit public API routes") não
    conflita com os branches anteriores (dashboard pages, DID-auth, session-auth) — `/api/health` não
    faz match em nenhum deles, então cai corretamente no branch 6
  - [x] Rodar a suíte completa (`npm test`) para confirmar zero regressão nas 24 rotas de API existentes

### Review Findings

- [x] [Review][Defer] `updateSupabaseSession` roda para toda requisição a `/api/health` antes do check `isPublicApiRoute`, fazendo uma chamada de rede ao Supabase no caminho do health check (contraria a leitura ampla do AC #5) [src/shared/middleware.ts:53] — deferred, pre-existing: o `middleware()` já refresca a sessão Supabase para toda rota (incluindo `/api/webhook-public-key`, que tem a mesma intenção "sem DB"); corrigir isso exige reestruturar a ordem de early-return do middleware para toda uma categoria de rotas públicas, fora do escopo de uma story de whitelist de uma linha.
- [x] [Review][Defer] Teste estrutural de `isPublicApiRoute` usa `indexOf("function ...")` → `indexOf("\n}", fnStart)` para delimitar o corpo da função, frágil a blocos aninhados futuros [tests/unit/story-11-1/health-check-endpoint.test.mjs] — deferred, pre-existing: mesmo padrão já usado implicitamente em outros testes estruturais do projeto; correto para o arquivo atual (nenhuma chave aninhada antes do fechamento real de nenhuma das 4 funções).

- [x] Task 3: Criar testes automatizados em `tests/unit/story-11-1/` (AC: #1, #2, #3, #4)
  - [x] Criar `tests/unit/story-11-1/health-check-endpoint.test.mjs` seguindo o padrão estrutural dos
    testes existentes (leitura de arquivo fonte + `assert.match` — ver `tests/unit/story-6-2/webhook-public-key.test.mjs`
    como referência mais próxima de um endpoint público simples)
  - [x] Testar que `route.ts` exporta `GET` retornando `{status: "ok"}` com HTTP 200
  - [x] Testar que `dynamic = "force-dynamic"` está presente
  - [x] Testar que o header `Cache-Control: no-store` está presente na resposta
  - [x] Testar que `route.ts` não importa `environments`, `supabase`, ou qualquer `src/modules/*`
    (grep estrutural no source)
  - [x] Testar que `middleware.ts` classifica `GET /api/health` como rota pública em `isPublicApiRoute`
  - [x] Rodar `npm test` e confirmar 0 falhas (baseline atual: 648 testes síncronos + 10 dinâmicos, todos
    verdes)

## Dev Notes

- **Escopo estritamente de infraestrutura, sem camadas de domínio.** Ao contrário de todos os módulos
  de negócio do projeto (que seguem `application/usecases/` → `app/{action}_{feature}_usecase.ts` com
  controller/presenter/viewmodel — convenção da skill `nextjs-backend`), este endpoint é deliberadamente
  um route handler único. Não criar usecase/controller/presenter/viewmodel para isto — seria
  over-engineering para um endpoint sem lógica de negócio.
- **Por que sem DB/secrets:** o objetivo do health check é validar que o *processo Next.js* está no ar
  no Amplify, isolado de qualquer dependência externa (Supabase, blockchain RPC, OCR provider). Se o
  endpoint dependesse de infraestrutura externa, uma falha do Supabase (por exemplo) derrubaria o
  smoke-test mesmo com o app funcionando — dando um falso negativo no gate de release.
- **Por que `force-dynamic`:** o Next.js App Router por padrão tenta otimizar rotas estaticamente em
  build time quando possível. Uma rota estaticamente otimizada retornaria sempre a mesma resposta
  cacheada no build, sem de fato provar que o servidor está respondendo requisições em tempo real.
- **Consumidor direto:** Story 11.6 (`Composite smoke-test`, ainda `backlog`) fará
  `GET $PRODUCTION_URL/api/health` com retries como último gate da pipeline de release
  (`.github/jobs/smoke-test/action.yml`). Esta story não implementa o job de CI — apenas garante que o
  endpoint que ele vai chamar existe e se comporta corretamente.
- **Middleware:** o arquivo `middleware.ts` já possui uma função dedicada `isPublicApiRoute(pathname, method)`
  (linha ~31) que centraliza todas as rotas públicas de API (`/api/proof-sessions/:id` GET,
  `/api/webhook-public-key` GET, `/api/auth/sign-up` POST). A entrada para `/api/health` segue o mesmo
  padrão — um `if` early-return dentro dessa função, sem tocar no fluxo de branches 1-5 do
  `middleware()` (dashboard pages, DID-auth routes, session-auth routes).

### Project Structure Notes

- Arquivo novo: `app/api/health/route.ts` (route handler simples, Next.js App Router convention —
  fora de `src/modules/`, como esperado para rotas sem lógica de domínio).
- Arquivo modificado: `src/shared/middleware.ts` — apenas a função `isPublicApiRoute`, uma linha
  adicionada.
- Arquivo novo: `tests/unit/story-11-1/health-check-endpoint.test.mjs` — segue a convenção de diretório
  `tests/unit/story-{epic}-{story}/` já usada por todas as stories anteriores.
- Nenhuma alteração em `src/shared/environments.ts`, schema do banco, ou qualquer módulo de domínio.
- Nenhum conflito com a estrutura unificada do projeto — este é o primeiro artefato do Epic 11, que é
  puramente infraestrutura de entrega.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#4-C] — texto oficial do
  Epic 11 e tabela de stories propostas (linha 219: contrato exato da Story 11.1).
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#Seção 5] — risco #6
  "Health x middleware": `middleware.ts` intercepta `/api/*`; `/api/health` precisa entrar em
  `isPublicApiRoute` para ser realmente público.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 11: Pipeline de CI/CD de Produção] — descrição
  do épico completo e menção ao health check como validação pós-deploy.
- [Source: _bmad-output/planning-artifacts/epics.md#NFR11] — versão emendada (Sprint Change 2026-08-08)
  citando `GET /api/health` como parte do gate `smoke-test`.
- [Source: src/shared/middleware.ts#isPublicApiRoute] — padrão existente de whitelisting de rotas
  públicas de API a ser seguido.

## Change Log

- 2026-08-08: Implementação validada e testes automatizados criados (11 testes novos, 0 regressões). Status → review.
- 2026-08-08: Code review — 0 decision-needed, 0 patch, 2 defer (registrados em `deferred-work.md`). Status → test.
- 2026-08-08: QA adicionou teste dinâmico/comportamental (`health-check-endpoint.dynamic.test.ts`, 4 testes) invocando `GET()` real. Suíte completa: 673/673 (659 estáticos + 14 dinâmicos). Status → done.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npm test` (full suite): 659 passed / 0 failed (síncrono) + 10 passed / 0 failed (dinâmico) — baseline 648+10 mais os 11 novos testes de `tests/unit/story-11-1/`.
- `node --test "tests/unit/story-11-1/**/*.test.mjs"`: 11 passed / 0 failed.
- `npx tsc --noEmit`: sem erros.
- `npm run lint`: 6 erros / 12 warnings pré-existentes, nenhum em arquivos tocados por esta story (`app/api/health/route.ts`, `src/shared/middleware.ts`, `tests/unit/story-11-1/health-check-endpoint.test.mjs`).

### Completion Notes List

- `app/api/health/route.ts` e a entrada de whitelist em `src/shared/middleware.ts#isPublicApiRoute` já existiam no working tree (não commitados) antes desta execução; validados linha a linha contra os ACs #1–#4 — nenhuma alteração de código foi necessária, ambos já satisfazem o contrato integralmente.
- Nenhuma camada usecase/controller/presenter/viewmodel foi criada — decisão intencional documentada nas Dev Notes (infraestrutura pura, sem lógica de domínio).
- Criado `tests/unit/story-11-1/health-check-endpoint.test.mjs` cobrindo os 4 ACs testáveis nesta story (AC #5 é comportamento do job `smoke-test`, Story 11.6, fora de escopo).
- Regressão completa validada: 659 testes síncronos + 10 dinâmicos, 0 falhas.

### File List

- `app/api/health/route.ts` (pré-existente, validado sem alterações)
- `src/shared/middleware.ts` (pré-existente, validado sem alterações)
- `tests/unit/story-11-1/health-check-endpoint.test.mjs` (novo — dev-story)
- `tests/unit/story-11-1/health-check-endpoint.dynamic.test.ts` (novo — QA)
- `package.json` (novo script `test:story:11.1` — QA)
- `_bmad-output/implementation-artifacts/deferred-work.md` (2 itens deferidos do code review — code-review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (seção Story 11.1 — QA)
