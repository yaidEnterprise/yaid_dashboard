# Sprint Change Proposal — 2026-08-08

> Nota: este arquivo foi reconstituído no worktree de execução da Story 11.2 a partir do
> contexto essencial já resumido e citado pela Story 11.1 (`11-1-health-check-endpoint.md`),
> pois o documento original ficou apenas como mudança não commitada no working tree de origem
> e não foi propagado a este worktree isolado. Contém apenas as seções necessárias para dar
> contexto ao Epic 11 (CI/CD de Produção) e à Story 11.2 especificamente.

## 4. Épicos Propostos

### 4-C. Epic 11: Pipeline de CI/CD de Produção

**Objetivo:** Estabelecer um pipeline de entrega contínua automatizado (GitHub Actions) que
testa, faz build e publica a aplicação Next.js (SSR) no AWS Amplify, com o banco de dados
gerenciado no Supabase Cloud, substituindo o fluxo manual de deploy atual.

**Stories propostas do Epic 11:**

| # | Story | Deliverable |
|---|-------|-------------|
| 11.1 | Health check endpoint | `app/api/health/route.ts` público (`{status:"ok"}`), `force-dynamic`, sem DB/secrets; whitelisting em `middleware.ts` |
| 11.2 | `amplify.yml` e desabilitar auto-build | `amplify.yml` versionado no repo (`npm ci` + `next build`, `baseDirectory: .next`, app Next.js SSR/Web Compute — não static export); documentar a necessidade de desabilitar `enableAutoBuild` na branch `prod` do Amplify App (ação manual no console/CLI AWS, fora do escopo de execução desta story) |
| 11.3 | Workflow job: tests | Job de CI que roda `npm ci` + `npm test` a cada push/PR |
| 11.4 | Workflow job: deploy Supabase | Job que aplica migrations no Supabase Cloud como parte do pipeline |
| 11.5 | Workflow job: deploy Amplify | Job que dispara o deploy no Amplify via API/CLI (já que o auto-build fica desabilitado) |
| 11.6 | Workflow job: smoke test | Job composite que faz `GET $PRODUCTION_URL/api/health` com retries, como gate final de release, consumindo o endpoint da Story 11.1 |
| 11.7 | Documentação operacional | Runbook/documentação do pipeline de ponta a ponta |

## 5. Riscos

### 5.2 — App é SSR

App é SSR: `amplify.yml` e o Amplify App precisam ser configurados como Next.js Web Compute
(`baseDirectory: .next`), não static export. Um `amplify.yml` com `baseDirectory` apontando para
um diretório de export estático (`out`) quebraria o SSR silenciosamente no primeiro deploy via
pipeline.

### 5.6 — Health x middleware

`middleware.ts` intercepta `/api/*`; `/api/health` precisa entrar em `isPublicApiRoute` para ser
realmente público (endereçado pela Story 11.1).

## NFR11 (versão emendada)

O pipeline de release deve validar, antes de considerar um deploy bem-sucedido, que a aplicação
publicada responde a `GET /api/health` com HTTP 200 (gate `smoke-test`, Story 11.6).
