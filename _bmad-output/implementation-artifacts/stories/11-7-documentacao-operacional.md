# Story 11.7: Documentação Operacional do Release de Produção (Runbook end-to-end + IAM least-privilege)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Nota de contexto:** sétima e **última** story do Epic 11 (Pipeline de CI/CD de Produção, Sprint
> Change 2026-08-08). As Stories 11.1 (`GET /api/health`), 11.2 (`amplify.yml` + desabilitar auto-build),
> 11.3 (composite `tests` + orquestrador base `production.yml`), 11.4 (composite `deploy-supabase`),
> 11.5 (composite `deploy-amplify`) e 11.6 (composite `smoke-test` + gate final) já estão `done`, com a
> cadeia completa `tests → deploy-supabase → deploy-amplify → smoke-test` implementada em
> `.github/workflows/production.yml` + `.github/jobs/*/action.yml`.
>
> Esta story **não adiciona código de pipeline** — ela entrega o **runbook operacional end-to-end**
> (`docs/deployment/production-cicd.md`) que documenta a arquitetura da pipeline, os 4 jobs, o modelo
> de IAM least-privilege (JSON das policies bootstrap + deploy role), o setup de custom domain, a
> política de migrations expand→contract, o procedimento de rollback e o troubleshooting. Além disso,
> serve como **ponto de consolidação dos itens de hardening deferidos das Stories 11.1–11.6** (ver
> `deferred-work.md`): SHA-pinning de GitHub Actions, pinning de versão do `supabase/setup-cli`,
> exigência de "Web Compute" (SSR) no nível do App Amplify, verificação de que o auto-build foi de fato
> desabilitado, confirmação não-TTY do `db push`, validação do payload JSON de env, e tolerância a
> erros transitórios no polling/smoke-test. O objetivo é que nada fique silenciosamente perdido: cada
> item deferido vira um check/known-issue documentado no runbook.
>
> **Escopo de documentação (§2.5 item 4 / tabela §4-D da proposta):** o artefato primário é markdown.
> A Story 11.2 já entregou `docs/ops/amplify-deploy.md` (foco específico em desabilitar o auto-build) —
> este novo runbook é o guia abrangente end-to-end e deve **referenciar/cruzar** aquele doc, não
> duplicá-lo.
>
> **Testes (padrão da Story 7.1 — story de fundação/docs):** GitHub Actions e AWS não rodam no sandbox;
> os testes são **estruturais/de contrato** sobre o próprio markdown — asseguram que o doc existe e
> contém as seções obrigatórias, que o(s) bloco(s) de policy JSON de IAM realmente parseiam como JSON
> válido, e que **não** contêm `AdministratorAccess` nem wildcards (`"Action": "*"` / `"Resource": "*"`).

## Story

Como operador do release de produção da YAID (e como o próximo desenvolvedor que precisar publicar,
depurar ou reverter um deploy),
Quero um runbook operacional único e abrangente (`docs/deployment/production-cicd.md`) que documente a
arquitetura da pipeline orquestrada pelo GitHub Actions, os quatro jobs (`tests → deploy-supabase →
deploy-amplify → smoke-test`), o setup manual one-time (bootstrap) versus os passos automáticos por
release, o modelo de IAM least-privilege com o **JSON real das policies** (bootstrap user só
`sts:AssumeRole`; deploy role só ações do Amplify no ARN do app — sem `AdministratorAccess` nem
wildcards), o setup de custom domain + DNS + SSL, a política de migrations expand→contract, o
procedimento de rollback e uma seção de troubleshooting que consolide os itens de hardening deferidos
das Stories 11.1–11.6,
Para que qualquer pessoa consiga fazer o setup inicial da infra, entender e operar cada release de
forma determinística e auditável, aplicar o princípio de menor privilégio na AWS, e diagnosticar/
reverter falhas — sem que nenhum aprendizado ou pendência de segurança do Epic 11 se perca.

## Acceptance Criteria

1. **Given** o repositório do projeto
   **When** o arquivo `docs/deployment/production-cicd.md` é inspecionado
   **Then** ele existe, é um documento markdown não vazio e tem um título/heading de nível 1

2. **Given** o runbook `production-cicd.md` (arquitetura da pipeline)
   **When** seu conteúdo é inspecionado
   **Then** ele documenta a **arquitetura da pipeline**: trigger em push na branch `prod`, os gates
   sequenciais encadeados por `needs:` e a cadeia completa
   `tests → deploy-supabase → deploy-amplify → smoke-test`, além da estrutura distribuída
   (`production.yml` orquestrador fino + composite actions em `.github/jobs/<nome>/action.yml`)

3. **Given** o runbook (os 4 jobs)
   **When** seu conteúdo é inspecionado
   **Then** ele descreve cada um dos **quatro jobs/composites**: `tests` (Node 22 + `npm ci` +
   `npm test`), `deploy-supabase` (link + `db push --dry-run` + `db push`), `deploy-amplify`
   (AssumeRole + sync env por merge + `start-job RELEASE` + polling finito) e `smoke-test`
   (`GET /api/health` com retries finitos, sucesso = HTTP 200 `{status:"ok"}`)

4. **Given** o runbook (IAM least-privilege §5.7 — CRÍTICO)
   **When** seus blocos de código de policy IAM são inspecionados
   **Then** existem **pelo menos dois blocos de policy JSON**: (a) a policy do **bootstrap user**
   contendo apenas `sts:AssumeRole`, e (b) a policy do **deploy role** contendo apenas ações do
   Amplify (`amplify:StartJob`, `amplify:GetJob`, `amplify:GetBranch`, `amplify:UpdateBranch`,
   `amplify:ListJobs`) escopadas ao ARN do app
   **And** cada bloco de policy JSON é **JSON sintaticamente válido** (parseável por `JSON.parse`)

5. **Given** o runbook (IAM least-privilege §5.7 — CRÍTICO, negativo)
   **When** os blocos de policy JSON são inspecionados
   **Then** **nenhum** bloco contém `AdministratorAccess`, nem uma ação wildcard `"Action": "*"`,
   nem um recurso wildcard `"Resource": "*"` — o princípio de menor privilégio é respeitado

6. **Given** o runbook (bootstrap vs release, §6 da proposta)
   **When** seu conteúdo é inspecionado
   **Then** ele separa claramente o **setup manual one-time** (Supabase project + link, criar app
   Amplify + conectar GitHub, branch `prod` + **desabilitar auto-build**, IAM bootstrap + deploy role,
   GitHub Environment secrets/vars, custom domain + DNS + SSL) dos **passos automáticos por release**
   (tests, `db push`, AssumeRole + sync env, start-job RELEASE + wait, smoke test)

7. **Given** o runbook (custom domain)
   **When** seu conteúdo é inspecionado
   **Then** ele documenta o setup de **custom domain** (associação do domínio no Amplify, registros
   **DNS** e provisionamento de **SSL/TLS**)

8. **Given** o runbook (migrations expand→contract)
   **When** seu conteúdo é inspecionado
   **Then** ele documenta a política de **migrations expand→contract** (expand antes do deploy,
   contract só depois que o app publicado deixar de depender da estrutura antiga; `db push --dry-run`
   antes do apply)

9. **Given** o runbook (rollback)
   **When** seu conteúdo é inspecionado
   **Then** ele documenta um procedimento de **rollback** para app (Amplify) e para banco
   (implicação do expand→contract nas migrations)

10. **Given** o runbook (troubleshooting + consolidação de hardening 11.1–11.6)
    **When** sua seção de troubleshooting/known-issues é inspecionada
    **Then** ela consolida, como checks operacionais ou known-issues documentados, os itens deferidos
    das Stories 11.1–11.6: **SHA-pinning** das GitHub Actions, **pinning de versão** do
    `supabase/setup-cli`, exigência de **Web Compute (SSR)** no nível do App Amplify, **verificação**
    de que o auto-build foi desabilitado, **confirmação não-TTY** do `db push`, **validação do payload
    JSON** de env vars e **tolerância a erros transitórios** no polling do Amplify / retries do
    smoke-test

11. **Given** o runbook (cross-link, sem duplicação)
    **When** seu conteúdo é inspecionado
    **Then** ele **referencia** `docs/ops/amplify-deploy.md` (Story 11.2, desabilitar auto-build) e
    `app/api/health/route.ts` (Story 11.1, alvo do smoke-test) em vez de duplicar o conteúdo

12. **Given** a suíte de testes estruturais desta story
    **When** `npm test` é executado
    **Then** os novos testes de `tests/unit/story-11-7/` passam (0 falhas) validando os ACs #1–#11
    (existência + seções obrigatórias + parse do JSON de IAM + ausência de wildcards/AdministratorAccess),
    e nenhuma regressão é introduzida nas suítes anteriores

## Tasks / Subtasks

- [x] Task 1: Criar o runbook `docs/deployment/production-cicd.md` (AC: #1–#11)
  - [x] Título H1 + sumário/visão geral do modelo orquestrado (GitHub Actions é o orquestrador; auto-build do Amplify desabilitado na `prod`)
  - [x] Seção "Arquitetura da pipeline": trigger em `prod`, cadeia `tests → deploy-supabase → deploy-amplify → smoke-test`, `needs:` encadeados, estrutura distribuída (`production.yml` + `.github/jobs/*`), diagrama (mermaid) do fluxo por release
  - [x] Seção "Os quatro jobs": subseção por composite (`tests`, `deploy-supabase`, `deploy-amplify`, `smoke-test`) descrevendo o que cada um faz e os inputs/secrets que consome
  - [x] Seção "Setup one-time (bootstrap)" vs "Por release (automático)": diagrama mermaid ONCE/EACH; lista os passos manuais (Supabase link, Amplify app + connect GitHub, desabilitar auto-build, IAM, GitHub Environment secrets/vars, custom domain + DNS + SSL)
  - [x] Seção "IAM least-privilege (§5.7)": explicação do fluxo bootstrap creds → `sts:AssumeRole` → deploy role; **bloco JSON da trust policy / policy do bootstrap user (só `sts:AssumeRole`)**; **bloco JSON da policy do deploy role (só `amplify:StartJob/GetJob/GetBranch/UpdateBranch/ListJobs` no ARN do app)**; nota explícita: sem `AdministratorAccess`, sem `Action:"*"`/`Resource:"*"`
  - [x] Seção "Custom domain": associação no Amplify, registros DNS (CNAME/ANAME), provisionamento SSL/TLS, verificação
  - [x] Seção "Migrations (expand→contract)": `db push --dry-run` antes do apply; ordem expand→deploy→contract; baseline no-op; cuidado com migrations destrutivas
  - [x] Seção "Rollback": rollback do app no Amplify (redeploy de job anterior / revert do commit em `prod`) e implicação do expand→contract no rollback de banco
  - [x] Seção "Troubleshooting / Known-issues & checklist de hardening (11.1–11.6)": consolidar os itens deferidos como checks/known-issues
  - [x] Seção "Referências": cross-link para `docs/ops/amplify-deploy.md`, `app/api/health/route.ts`, `.github/workflows/production.yml`, `.github/jobs/*/action.yml`, `amplify.yml`, e a proposta de sprint change
  - [x] Garantir que os blocos de policy JSON são JSON VÁLIDO e least-privilege (parseáveis, sem wildcards/AdministratorAccess)
- [x] Task 2: Criar testes estruturais/de contrato em `tests/unit/story-11-7/` (AC: #12)
  - [x] Criar `tests/unit/story-11-7/documentacao-operacional.test.mjs` com `node:test`
  - [x] Testar que `docs/deployment/production-cicd.md` existe, é não vazio e tem H1
  - [x] Testar presença das seções: arquitetura (cadeia dos 4 jobs), descrição dos 4 jobs, bootstrap vs release, IAM, custom domain/DNS/SSL, migrations expand→contract, rollback, troubleshooting
  - [x] Extrair todos os blocos de código JSON do markdown, `JSON.parse` cada um (afirmar parse OK)
  - [x] Afirmar que existe policy com `sts:AssumeRole` (bootstrap) e policy com as ações `amplify:*` esperadas (deploy role) escopadas a um ARN
  - [x] Afirmar que NENHUM bloco JSON contém `AdministratorAccess`, `"Action": "*"` ou `"Resource": "*"` (regex tolerante a espaços)
  - [x] Testar a consolidação de hardening 11.1–11.6 (menções a SHA-pinning, `setup-cli` version, Web Compute/SSR, auto-build desabilitado, não-TTY `db push`, validação JSON de env, erros transitórios)
  - [x] Testar os cross-links (`docs/ops/amplify-deploy.md`, `app/api/health/route.ts`)
  - [x] Adicionar script `test:story:11.7` em `package.json`
  - [x] Rodar `npm test` e confirmar 0 falhas novas

### Review Findings

Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline — diff pequeno de
documentação: markdown novo + testes de contrato + 1 linha de `package.json`, mesmo padrão das Stories
11.5/11.6). **0 decision-needed, 0 patch, 0 defer novo, 1 dismiss. Review limpa.**

- **Blind Hunter:** a lógica dos testes estruturais é sólida e não pode dar falso verde — a extração de
  blocos ```json + `JSON.parse` + as checagens de ausência de wildcard exigem simultaneamente
  `allExpected` (todas as 5 ações amplify), `onlyAmplify` (nenhuma ação fora de `amplify:`) e
  `scopedToArn` (Resource com ARN do app). Dismiss: o runbook mostra `curl -w '%{http_code}'` enquanto a
  action real usa `-w '\n%{http_code}'` — simplificação didática, não um defeito.
- **Edge Case Hunter:** o runbook foi conferido contra os `action.yml` reais (Node 22, `db push
  --dry-run`→`db push`, AssumeRole + sync env por merge, polling 60×15s, smoke-test 30×10s / HTTP 200
  `{status:"ok"}`) — descrições precisas. Os links relativos (`../ops/amplify-deploy.md`,
  `../../app/api/health/route.ts`) resolvem corretamente a partir de `docs/deployment/`.
- **Acceptance Auditor:** os 12 ACs estão satisfeitos; 3 policies JSON least-privilege válidas (sem
  `AdministratorAccess`/wildcards); os 7 itens de hardening deferidos das Stories 11.1–11.6 consolidados
  na §9.
- **Nota importante (resolução de defers anteriores):** os itens de hardening deferidos das Stories
  11.1–11.6 em `deferred-work.md` foram explicitamente encaminhados "para a Story 11.7 (documentação/
  hardening operacional)". Esta story os **RESOLVE** ao documentá-los como checks/known-issues no
  runbook (§9) — não gera novos defers. A maioria exige AWS/GitHub real para um FIX de código; o runbook
  garante que nada se perca.

Suíte após review: 852 síncronos + 14 dinâmicos, 0 falhas (nenhum patch aplicado — nada a re-testar).

## Dev Notes

- **Story de documentação — o artefato primário é markdown.** Não toca `src/`, `app/` (exceto ler
  `app/api/health/route.ts` para referenciar), `.github/` (a pipeline já está `done`), nem
  `amplify.yml`. Segue o padrão da Story 7.1 (fundação/docs): testes estruturais/de contrato, não
  runtime. **Não** inventar testes de execução da pipeline (GitHub Actions/AWS não rodam no sandbox).
- **§5.7 IAM least-privilege (propriedade-chave desta story):** o JSON das policies precisa ser real e
  least-privilege. Dois artefatos:
  - **Bootstrap user** — apenas `sts:AssumeRole` sobre o ARN do deploy role. (Opcionalmente também a
    **trust policy** do role, permitindo o principal bootstrap assumir.)
  - **Deploy role** — apenas `amplify:StartJob`, `amplify:GetJob`, `amplify:GetBranch`,
    `amplify:UpdateBranch`, `amplify:ListJobs`, com `Resource` escopado ao ARN do app Amplify
    (ex.: `arn:aws:amplify:<region>:<account-id>:apps/<app-id>/*`). Use placeholders claros
    (`<region>`, `<account-id>`, `<app-id>`, `<deploy-role-arn>`) — o JSON ainda deve parsear.
  - **PROIBIDO:** `AdministratorAccess`, `"Action": "*"`, `"Resource": "*"`. Um teste fará
    `JSON.parse` e afirmará a ausência desses.
- **Consolidação de hardening (deferred-work.md, entradas 11.1–11.6):** transformar em checks/known-
  issues no runbook (não é obrigatório FIXAR em código — muitos exigem AWS/GitHub real):
  - **SHA-pinning** de `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`,
    `supabase/setup-cli` (hoje por tag `@v4`/`latest`) — política recomendada + como aplicar.
  - **`supabase/setup-cli` com `version: latest`** → recomendar pinar versão determinística.
  - **App Amplify deve ser "Web Compute" (SSR)** no nível do App, não só via `amplify.yml`
    (`baseDirectory: .next`) — senão 404 em rotas SSR/middleware.
  - **Verificar que o auto-build foi de fato desabilitado** na conta AWS (cross-link `amplify-deploy.md`
    seção "Verificação").
  - **`supabase db push` pode pedir confirmação interativa em CI não-TTY** — verificar no 1º release;
    se necessário, flag não-interativa/auto-confirm.
  - **Validação do payload JSON de env** (`amplify-environment-variables`) — `jq --argjson` falha sem
    mensagem dedicada se o JSON for inválido; recomendar validar/mensagem explícita.
  - **Tolerância a erros transitórios** no polling do Amplify (`get-job`) e nos retries do smoke-test —
    hoje `set -euo pipefail` aborta numa única falha de rede; avaliar retry/backoff tolerante mantendo
    o loop finito.
- **Cross-link, sem duplicar:** a Story 11.2 entregou `docs/ops/amplify-deploy.md` (foco: desabilitar
  auto-build, com passo a passo Console/CLI e verificação). O novo runbook referencia esse doc na
  seção de setup do Amplify, em vez de recolar o passo a passo.
- **Fatos verificados da codebase (para descrever os jobs com precisão):**
  - `tests`: `actions/setup-node@v4` Node 22 + cache npm → `npm ci` → `npm test`. Node 22 é
    obrigatório (glob `**` só expande no Node 21+; §5.1).
  - `deploy-supabase`: `supabase/setup-cli@v1` (`version: latest`) → `supabase link` → `db push
    --dry-run` → `db push`; secrets via `inputs`→`env`, nunca ecoados.
  - `deploy-amplify`: `aws-actions/configure-aws-credentials@v4` com `role-to-assume` → sync env por
    **merge** (`get-branch` → `jq '$current * $incoming'` → `update-branch --cli-input-json`) →
    `start-job --job-type RELEASE` → polling finito (60×15s = 15 min), falha em ≠ SUCCEED.
  - `smoke-test`: `curl -sS --max-time 15 -w '%{http_code}'` contra `$PRODUCTION_URL/api/health`,
    30×10s = 5 min, sucesso = HTTP 200 + corpo `{status:"ok"}`, `exit 1` ao esgotar.
  - `production.yml`: `permissions: contents: read`; secrets centralizados no orquestrador e passados
    via `with:`; trigger `on: push: branches: [prod]`.
  - Baseline de migration: `supabase/migrations/20260728015653_remote_schema.sql` (dump de `db pull`,
    push no-op no 1º release).
- **`js-yaml` já é devDependency** (usado por 11.2–11.6), mas esta story não precisa parsear YAML — o
  teste parseia **JSON** (via `JSON.parse` nativo) extraído dos code fences ```json do markdown.
- **Baseline de testes pré-existente (fora de escopo):** eventuais arquivos não commitados de Epic 1
  (Stories 1.5/1.6) e planning-artifacts NÃO devem ser tocados. "0 falhas novas" = nenhuma regressão
  introduzida por esta story.
- **Epic 11 encerra aqui:** esta é a 7ª e última story do Epic 11. Após `done`, todas as 7 stories
  ficam `done` — o épico pode ser marcado `done` (a skill de commit/pipeline cuida disso conforme a
  convenção do projeto).

### Project Structure Notes

- Arquivo novo: `docs/deployment/production-cicd.md` — runbook operacional end-to-end (artefato
  primário). Novo diretório `docs/deployment/`.
- Arquivo novo: `tests/unit/story-11-7/documentacao-operacional.test.mjs` — segue a convenção
  `tests/unit/story-{epic}-{story}/`.
- Arquivo modificado: `package.json` — novo script `test:story:11.7`.
- Arquivo modificado (rastreamento): `_bmad-output/implementation-artifacts/deferred-work.md` e
  `_bmad-output/implementation-artifacts/tests/test-summary.md` (nas fases de review/QA).
- Nenhuma alteração em `src/`, `app/`, `.github/`, `amplify.yml`, `supabase/migrations/`, ou módulos
  de domínio.

### References

- [Source: sprint-change-proposal-2026-08-08.md#§2.5 item 4] — deliverable: `docs/deployment/production-cicd.md`
  (arquitetura, jobs, IAM, custom domain, migrations, rollback, troubleshooting).
- [Source: sprint-change-proposal-2026-08-08.md#§4-D tabela, Story 11.7] — "Documentação operacional →
  `docs/deployment/production-cicd.md` + IAM policies + custom domain + rollback".
- [Source: sprint-change-proposal-2026-08-08.md#§5.7] — IAM least-privilege: bootstrap só
  `sts:AssumeRole`; role só `amplify:StartJob/GetJob/GetBranch/UpdateBranch/ListJobs` no ARN do app;
  sem `AdministratorAccess`/wildcards.
- [Source: sprint-change-proposal-2026-08-08.md#§6 + mermaid ONCE/EACH] — separação bootstrap
  (one-time manual) vs release (automático).
- [Source: sprint-change-proposal-2026-08-08.md#§5.1–§5.8] — riscos-chave (Node 22, Web Compute, env
  obrigatórias PROD, sync por merge, expand→contract, health vs middleware, least-privilege, polling
  finito).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — entradas deferidas das Stories
  11.1–11.6 a consolidar no runbook.
- [Source: .github/workflows/production.yml + .github/jobs/{tests,deploy-supabase,deploy-amplify,smoke-test}/action.yml]
  — os artefatos de pipeline a documentar.
- [Source: docs/ops/amplify-deploy.md (Story 11.2)] — doc a referenciar (desabilitar auto-build).
- [Source: app/api/health/route.ts (Story 11.1)] — endpoint alvo do smoke-test.
- [Source: _bmad-output/implementation-artifacts/stories/7-1-*.md] — precedente de story de docs/
  fundação com testes estruturais.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run test:story:11.7`: 38 passed / 0 failed.
- `npm run test:unit` (suíte síncrona completa): 852 passed / 0 failed.
- `npm test` (síncrono + dinâmico): 852 sync + 14 dinâmicos, 0 falhas.

### Completion Notes List

- `docs/deployment/production-cicd.md` criado — runbook operacional end-to-end (novo diretório
  `docs/deployment/`). Seções: (1) visão geral do modelo orquestrado; (2) arquitetura da pipeline
  (estrutura distribuída, trigger `prod`, permissões least-privilege, diagrama mermaid do fluxo por
  release, cadeia `tests → deploy-supabase → deploy-amplify → smoke-test`); (3) os quatro jobs descritos
  com inputs/secrets; (4) bootstrap one-time vs release automático (diagrama mermaid ONCE/EACH +
  checklist); (5) IAM least-privilege com 3 blocos JSON reais (policy bootstrap só `sts:AssumeRole`,
  trust policy do role, permission policy do deploy role só `amplify:*` no ARN do app); (6) GitHub
  Environment secrets/vars + custom domain/DNS/SSL; (7) migrations expand→contract; (8) rollback (app +
  banco); (9) troubleshooting consolidando os 7 itens de hardening deferidos das Stories 11.1–11.6;
  (10) referências com cross-links.
- **IAM (§5.7):** os 3 blocos JSON são sintaticamente válidos (parseáveis por `JSON.parse`) e
  least-privilege — nenhum contém `AdministratorAccess`, `"Action": "*"` ou `"Resource": "*"`. Um teste
  estrutural extrai cada bloco ```json, parseia, e afirma a ausência de wildcards (inclusive na forma de
  array).
- **Consolidação de hardening (deferred-work.md):** SHA-pinning das actions, pinning de versão do
  `supabase/setup-cli`, exigência de Web Compute (SSR) no App Amplify, verificação do auto-build
  desabilitado, `db push` não-TTY, validação do payload JSON de env e tolerância a erros transitórios no
  polling/smoke-test — todos documentados como checks operacionais/known-issues na §9. Nenhum FIX de
  código foi aplicado (a maioria exige AWS/GitHub real); o runbook garante que nada se perca.
- **Cross-link, sem duplicar:** o runbook referencia `docs/ops/amplify-deploy.md` (Story 11.2) para o
  passo a passo de desabilitar o auto-build e `app/api/health/route.ts` (Story 11.1) como alvo do
  smoke-test, em vez de recolá-los.
- **Story de documentação:** nenhum código de aplicação ou de pipeline foi alterado; os testes são
  estruturais/de contrato sobre o markdown (padrão da Story 7.1). GitHub Actions e AWS não rodam no
  sandbox.
- `tests/unit/story-11-7/documentacao-operacional.test.mjs` (38 testes) + script `test:story:11.7` no
  `package.json`.

### File List

- `docs/deployment/production-cicd.md` (novo — dev-story; runbook operacional end-to-end)
- `tests/unit/story-11-7/documentacao-operacional.test.mjs` (novo — dev-story; 38 testes estruturais)
- `package.json` (modificado — novo script `test:story:11.7`)
- `tests/unit/story-11-7/production-cicd-contract.test.mjs` (novo — QA; 17 testes de contrato)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (modificado — seção Story 11.7 — QA)

## Change Log

- 2026-08-09: Story criada via `bmad-create-story`. Status → ready-for-dev.
- 2026-08-09: Implementação completa — runbook `docs/deployment/production-cicd.md` (arquitetura da
  pipeline + 4 jobs, bootstrap vs release, IAM least-privilege com 3 policies JSON válidas sem
  wildcards, custom domain/DNS/SSL, migrations expand→contract, rollback, troubleshooting consolidando
  o hardening deferido das Stories 11.1–11.6) + 38 testes estruturais. Suíte completa 852 sync + 14
  dinâmicos, 0 falhas. Status → review.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline) — review limpa:
  0 decision-needed, 0 patch, 0 defer novo, 1 dismiss. Os itens de hardening deferidos das Stories
  11.1–11.6 são RESOLVIDOS por esta story (documentados como known-issues/checks na §9 do runbook).
  Nenhum patch a aplicar; suíte permanece 852 sync + 14 dinâmicos, 0 falhas. Status → test.
- 2026-08-09: QA adicionou `tests/unit/story-11-7/production-cicd-contract.test.mjs` (17 testes):
  doc-drift guard (todo cross-link do runbook existe no repo + links relativos resolvem), ≥2 diagramas
  mermaid, invariantes IAM estritas (bootstrap 1 statement só `sts:AssumeRole` c/ Resource = ARN de
  role; deploy role com o conjunto EXATO das 5 ações amplify escopadas ao `<app-id>`; trust policy c/
  Principal escopado), e consistência dos timeouts (15 min/5 min) do runbook com os composites reais.
  Suíte da story: 55 testes (38 dev + 17 QA). Suíte completa: 869 síncronos + 14 dinâmicos, 0 falhas.
  `test-summary.md` atualizado. Status → done. Última story do Epic 11 — todas as 7 stories `done`.
