# Story 11.5: Composite `deploy-amplify` + Job Encadeado na Pipeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Nota de contexto:** quinta story do Epic 11 (Pipeline de CI/CD de Produção, Sprint Change
> 2026-08-08). As Stories 11.1 (`GET /api/health`), 11.2 (`amplify.yml` + desabilitar auto-build),
> 11.3 (composite `tests` + orquestrador base `production.yml`) e 11.4 (composite `deploy-supabase`
> + job `needs: tests`) já estão `done`. Esta story adiciona o **terceiro composite action** da
> pipeline distribuída (`.github/jobs/deploy-amplify/action.yml`) e **encadeia** um job
> `deploy-amplify` no `production.yml` com **`needs: deploy-supabase`** — ou seja, o app só é
> publicado no Amplify **depois** que as migrations do Supabase Cloud forem aplicadas (Story 11.4).
> O job seguinte (`smoke-test` — Story 11.6) será encadeado via `needs: deploy-amplify` em story
> futura.
>
> **Estrutura distribuída (§4-D da proposta):** cada job vive em `.github/jobs/<nome>/action.yml`
> como **composite action** (reusable workflows do GitHub só podem ficar em `.github/workflows/`;
> composite actions podem morar em qualquer pasta e são chamados por `uses: ./.github/jobs/<nome>`).
> O `production.yml` é fino: apenas orquestra os composites. Como o composite `deploy-amplify`
> **precisa de secrets** (credenciais bootstrap AWS, ARN do role de deploy, app-id, branch, env
> vars server-side), eles são passados via `with:` (inputs) a partir do orquestrador — **nunca
> hardcoded**, **nunca ecoados nos logs** (mesma disciplina de secrets do composite `deploy-supabase`
> da Story 11.4).
>
> **Estado encontrado na codebase:** `.github/workflows/production.yml` já contém os jobs `tests`
> (11.3) e `deploy-supabase` (11.4); `.github/jobs/tests/` e `.github/jobs/deploy-supabase/` já
> existem. Esta story ESTENDE `production.yml` (adiciona o job `deploy-amplify`) e ADICIONA o
> diretório novo `.github/jobs/deploy-amplify/`. GitHub Actions e a AWS **não** rodam no sandbox —
> os testes são estruturais/de contrato (parse YAML via `js-yaml`), mesmo padrão das Stories
> 11.2/11.3/11.4.

## Story

Como pipeline de CI/CD de produção (Epic 11, orquestrada pelo GitHub Actions na branch `prod`),
Quero um composite action `deploy-amplify` reutilizável (`.github/jobs/deploy-amplify/action.yml`)
que autentique na AWS via `aws-actions/configure-aws-credentials` com **assunção de role**
(`sts:AssumeRole`, pois OIDC está indisponível), **sincronize** as env vars para o Amplify por
**merge (lendo as vars atuais e reenviando sem sobrescrever cegamente)**, dispare o deploy via
`aws amplify start-job` com job type **`RELEASE`** e faça **polling com timeout** até um estado
terminal — falhando explicitamente em qualquer estado terminal diferente de `SUCCEED` —, além de um
job `deploy-amplify` no orquestrador `production.yml` que rode com **`needs: deploy-supabase`**,
Para que o app Next.js SSR seja publicado no AWS Amplify de forma segura e determinística — depois
das migrations (Story 11.4) e antes do smoke-test (Story 11.6) — com autenticação least-privilege,
sincronização de env vars que **nunca** apaga secrets server-side nem os transforma em `NEXT_PUBLIC_*`,
e sem nunca hardcodear ou ecoar secrets.

## Acceptance Criteria

1. **Given** o repositório do projeto
   **When** o arquivo `.github/jobs/deploy-amplify/action.yml` é inspecionado
   **Then** ele existe, é YAML válido, e é um **composite action** — contém `runs.using: "composite"`
   e uma lista `runs.steps` não vazia

2. **Given** o composite action `deploy-amplify`
   **When** sua seção `inputs` é inspecionada
   **Then** ele declara inputs para os secrets/parâmetros necessários — no mínimo: credenciais
   bootstrap AWS (`aws-access-key-id`, `aws-secret-access-key`), a região (`aws-region`), o ARN do
   role de deploy a assumir (`aws-role-to-assume`), o Amplify `amplify-app-id` e a `amplify-branch-name`
   — para que o orquestrador os passe via `with:` (**nunca hardcoded** no composite)
   **And** os inputs de secret são marcados `required: true`

3. **Given** o composite action `deploy-amplify`
   **When** seus `runs.steps` são inspecionados
   **Then** existe um passo que autentica na AWS via `aws-actions/configure-aws-credentials`
   **And** esse passo usa **assunção de role** (`role-to-assume` a partir do input do ARN do role)
   — evidenciando o fluxo `sts:AssumeRole` (bootstrap creds → deploy role), pois OIDC está indisponível
   **And** todo passo `run` declara `shell:` (obrigatório em composite actions)

4. **Given** o composite action `deploy-amplify` (§5.4 CRÍTICO — sync de env sem sobrescrever)
   **When** o passo de sincronização de env vars é inspecionado
   **Then** ele **lê as env vars atuais** do branch Amplify (ex.: `aws amplify get-branch`) e as
   **mescla** com as novas antes de reenviar via `aws amplify update-branch --environment-variables`
   — **nunca** um `update-branch` que envie apenas o subconjunto novo (o que apagaria as demais)
   **And** o merge é evidenciável no `run` (leitura + combinação + reenvio), não um overwrite cego

5. **Given** o composite action `deploy-amplify` (§5.8 CRÍTICO — polling finito)
   **When** os passos de deploy e espera são inspecionados
   **Then** existe um passo `aws amplify start-job` com **`--job-type RELEASE`**
   **And** existe um passo de **polling** que consulta o status do job (ex.: `aws amplify get-job`)
   até um estado terminal, com **timeout / número máximo de tentativas** (loop finito, nunca infinito)
   **And** o polling **falha explicitamente** (exit não-zero) em qualquer estado terminal diferente
   de `SUCCEED` (ex.: `FAILED`, `CANCELLED`)

6. **Given** o composite action `deploy-amplify` (§5.4 / §5.7 — segurança de secrets e env)
   **When** o texto bruto do YAML é inspecionado
   **Then** **nenhum literal de secret** aparece hardcoded (nenhuma access key `AKIA...`, secret key,
   ou private key); os valores vêm exclusivamente dos `inputs` (`${{ inputs.* }}`)
   **And** os secrets **não** são ecoados em `run:` (sem `echo`/`cat`/`printenv` de credenciais ou
   env vars sensíveis)
   **And** o composite **não** cria/renomeia nenhum secret server-side como `NEXT_PUBLIC_*` (nenhum
   `NEXT_PUBLIC_` recebendo valor de um input/env de secret)

7. **Given** o workflow `production.yml`
   **When** a seção `jobs` é inspecionada
   **Then** existe um job `deploy-amplify` que roda em `runs-on: ubuntu-latest`, declara
   **`needs: deploy-supabase`** (gate sequencial após a Story 11.4), faz checkout do código
   (`actions/checkout`) e chama o composite via `uses: ./.github/jobs/deploy-amplify`
   **And** o job passa os secrets ao composite via `with:` referenciando `${{ secrets.* }}`
   (nunca literais) — os secrets ficam centralizados no orquestrador

8. **Given** o workflow `production.yml`
   **When** o encadeamento dos jobs é inspecionado
   **Then** os jobs `tests` (11.3) e `deploy-supabase` (11.4) permanecem intactos e nesta ordem
   (`deploy-supabase` com `needs: tests`), e o job `deploy-amplify` só executa após `deploy-supabase`
   passar (via `needs: deploy-supabase`)
   **And** esta story **não** adiciona o job `smoke-test` (11.6) — os únicos jobs em `production.yml`
   devem ser `tests`, `deploy-supabase` e `deploy-amplify`

## Tasks / Subtasks

- [x] Task 1: Criar o composite action `.github/jobs/deploy-amplify/action.yml` (AC: #1, #2, #3, #4, #5, #6)
  - [x] Definir `name` e `description` do composite (documentar §5.4/§5.7/§5.8 em comentários)
  - [x] Declarar `inputs`: `aws-access-key-id` (required), `aws-secret-access-key` (required),
    `aws-region` (required), `aws-role-to-assume` (required), `amplify-app-id` (required),
    `amplify-branch-name` (required), e um input para as env vars server-side a sincronizar
    (`amplify-environment-variables`, required), com `description` em cada um
  - [x] Definir `runs.using: "composite"`
  - [x] Passo `uses: aws-actions/configure-aws-credentials@v4` com `aws-access-key-id`,
    `aws-secret-access-key`, `aws-region` (bootstrap) **e** `role-to-assume` (o ARN do input) —
    evidenciando `sts:AssumeRole` (bootstrap → deploy role)
  - [x] Passo de **sync de env (merge)**: `aws amplify get-branch` para ler as env vars atuais →
    combinar com as novas (via `jq '$current * $incoming'`) → `aws amplify update-branch`
    com o mapa **mesclado** (nunca só o subconjunto novo). `shell: bash`. Secrets via `env:` (inputs).
  - [x] Passo `aws amplify start-job --job-type RELEASE` (captura o `jobId` em `GITHUB_OUTPUT`). `shell: bash`.
  - [x] Passo de **polling finito**: loop com `max_attempts`/timeout (60×15s) chamando `aws amplify get-job`
    até estado terminal; `SUCCEED` → `exit 0`; `FAILED`/`CANCELLED`/inesperado → `exit 1`;
    estouro do timeout → `exit 1`. `shell: bash`.
  - [x] Garantir que NENHUM literal de secret aparece; tudo via `${{ inputs.* }}` / `env:`; nunca
    `echo`/`cat`/`printenv` de credenciais ou env vars sensíveis; nenhum `NEXT_PUBLIC_*` recebendo secret
  - [x] Validar que o YAML é sintaticamente válido e tem `runs.using == "composite"`

- [x] Task 2: Encadear o job `deploy-amplify` no `.github/workflows/production.yml` (AC: #7, #8)
  - [x] Adicionar job `deploy-amplify` com `runs-on: ubuntu-latest` e `needs: deploy-supabase`
  - [x] Passo `uses: actions/checkout@v4` (necessário para resolver o composite local)
  - [x] Passo `uses: ./.github/jobs/deploy-amplify` com bloco `with:` passando os inputs a partir de
    `${{ secrets.* }}` (creds bootstrap, role ARN, app-id, branch, env vars server-side)
  - [x] Manter os jobs `tests` e `deploy-supabase` intactos (não regredir 11.3/11.4)
  - [x] NÃO adicionar `smoke-test` (fora de escopo)
  - [x] Confirmar que o bloco `permissions` do workflow continua least-privilege (`contents: read`)

- [x] Task 3: Criar testes estruturais/de contrato em `tests/unit/story-11-5/` (AC: #1–#8)
  - [x] Criar `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` com **parse real via `js-yaml`**
  - [x] Testar que `.github/jobs/deploy-amplify/action.yml` existe, parseia, e tem `runs.using == "composite"`
  - [x] Testar os inputs obrigatórios (creds AWS, região, role ARN, app-id, branch, env vars) com `required: true`
  - [x] Testar o step `configure-aws-credentials` usando `role-to-assume` (AssumeRole) via input, e `shell` em todo `run`
  - [x] **Testar o sync por merge** (§5.4): o step de env lê as vars atuais (`get-branch`) antes do
    `update-branch` — não um overwrite cego (inclui asserção de ordem get→update e do merge via jq)
  - [x] Testar `start-job --job-type RELEASE`
  - [x] **Testar o polling finito** (§5.8): existe loop de espera com timeout/max attempts (sem `while true`)
    e falha explícita em terminal não-`SUCCEED`
  - [x] Testar que NENHUM literal de secret aparece no YAML bruto; valores vêm de `${{ inputs.* }}`;
    secrets não são ecoados; nenhum `NEXT_PUBLIC_*` recebe secret
  - [x] Testar o job `deploy-amplify` com `needs: deploy-supabase`, `ubuntu-latest`, checkout antes do
    composite, `uses` do composite e `with:` referenciando `${{ secrets.* }}` (não literais)
  - [x] Testar que os jobs de `production.yml` são exatamente `tests`, `deploy-supabase` e `deploy-amplify`
  - [x] Adicionar script `test:story:11.5` em `package.json`
  - [x] **Atualizar o teste AC7 da Story 11.4** (`deepEqual(jobKeys, ["deploy-supabase", "tests"])`) para
    incluir `deploy-amplify` — análogo ao ajuste que a 11.4 fez no teste AC5 da 11.3. Único arquivo de
    outra story que esta story pode tocar, e apenas por esse motivo documentado.
  - [x] Rodar `npm test` e confirmar 0 falhas novas

### Review Findings

Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline — diff pequeno de infra
YAML + testes de contrato). 0 decision-needed, 0 patch, 3 defer, 0 dismiss. Acceptance Auditor: os 8
ACs estão implementados e cobertos por testes (AssumeRole, merge de env, RELEASE, polling finito,
não-vazamento de secrets, `needs: deploy-supabase`, apenas 3 jobs). Suíte após review: 771 sync + 14
dinâmicos, 0 falhas (nenhum patch aplicado — nada a re-testar).

- [x] [Review][Defer] `aws-actions/configure-aws-credentials@v4` pinada por tag de major (não SHA) —
  versão não determinística entre releases [.github/jobs/deploy-amplify/action.yml] — deferido para a
  Story 11.7 (hardening operacional), consistente com o defer de SHA-pinning das actions registrado nas
  Stories 11.3/11.4.
- [x] [Review][Defer] O polling (`aws amplify get-job`) roda sob `set -euo pipefail` sem tolerância a
  erros transitórios da API AWS — uma única falha de rede aborta a espera do deploy
  [.github/jobs/deploy-amplify/action.yml] — não reproduzível no sandbox (AWS não roda aqui); avaliar
  retry/backoff tolerante no primeiro release real. Deferido para validação operacional (Story 11.7).
- [x] [Review][Defer] O sync de env assume que `amplify-environment-variables` é JSON válido
  (`jq --argjson`); um payload malformado faz o step falhar sem mensagem dedicada
  [.github/jobs/deploy-amplify/action.yml] — fail-fast aceitável; considerar validação/mensagem
  explícita no hardening. Deferido para a Story 11.7.

## Dev Notes

- **Escopo estritamente de infraestrutura de CI, sem código de aplicação.** Como as Stories 11.1–11.4,
  esta story não toca `src/modules/*`, `application/usecases/`, nem camadas controller/presenter/
  viewmodel. Entrega um novo composite YAML, estende o `production.yml` e adiciona testes estruturais.
  Não altera schema do banco, `amplify.yml` (Story 11.2), nem `environments.ts`.
- **§5.4 CRÍTICO — sync de env vars por MERGE (propriedade de segurança-chave desta story):**
  `aws amplify update-branch --environment-variables` **substitui o mapa inteiro** de env vars do
  branch. Se o passo enviar apenas as vars novas, TODAS as demais (inclusive os secrets server-side
  como `SUPABASE_SECRET_KEY`, `ISSUER_PRIVATE_KEY` etc.) seriam apagadas e a app quebraria no boot.
  Por isso o composite DEVE: (1) `aws amplify get-branch` para ler o mapa atual, (2) mesclar com as
  novas vars (ex.: `jq -s '.[0] * .[1]'` ou equivalente), (3) reenviar o mapa **mesclado**. **Nunca**
  overwrite cego. Este merge precisa de um teste dedicado (AC #4).
- **§3.3 — `STAGE=PROD` exige env obrigatórias:** `src/shared/environments.ts` valida no boot
  (`superRefine`) `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY`,
  `BLOCKCHAIN_CONTRACT_ADDRESS` quando `STAGE ∈ {PROD, HOMOLOG}`. Todas devem existir no Amplify como
  **secrets server-side** (nunca `NEXT_PUBLIC_*`) — é exatamente o merge do passo de sync que garante
  que elas permaneçam presentes a cada release. Se o sync apagasse alguma, a app falharia no boot.
- **§5.7 — IAM least-privilege (AssumeRole):** OIDC está indisponível, então a autenticação usa
  **credenciais bootstrap de um IAM User** (access key + secret) que só tem permissão de `sts:AssumeRole`.
  O `configure-aws-credentials` assume então o **deploy role** (`role-to-assume` = ARN do input), que
  possui apenas `amplify:StartJob/GetJob/GetBranch/UpdateBranch/ListJobs` no ARN do app. **Sem**
  `AdministratorAccess`, **sem** `Action:"*"/Resource:"*"`. Esta story **WIRES** o uso do assume-role
  (o JSON das policies IAM é documentação da Story 11.7); o teste afirma que `role-to-assume` é usado.
- **§5.8 — Polling FINITO:** o wait do job Amplify DEVE ter timeout / máximo de tentativas e falhar
  explicitamente (exit não-zero) em qualquer estado terminal ≠ `SUCCEED` (`FAILED`, `CANCELLED`) e
  também no estouro do timeout — **nunca** um `while true` sem saída. Estados do job Amplify:
  `PENDING`, `PROVISIONING`, `RUNNING`, `SUCCEED`, `FAILED`, `CANCELLED`. Só `SUCCEED` é sucesso.
- **§4-D — Secrets via `with:` (nunca hardcoded / nunca ecoados):** como o composite `deploy-supabase`
  (11.4), este consome secrets: creds bootstrap AWS, ARN do role, app-id, branch e o payload de env
  vars server-side. Todos entram como `inputs` e são passados pelo orquestrador via `with:` referenciando
  `${{ secrets.* }}`. **Nenhum literal** desses valores no YAML; **nada** de `echo $AWS_SECRET_ACCESS_KEY`
  ou similar. As env vars sensíveis vão via `env:` a partir dos inputs, nunca impressas.
- **`aws-actions/configure-aws-credentials@v4`:** action oficial da AWS. Pinada por tag de major
  (consistente com `actions/checkout@v4`, `actions/setup-node@v4`, `supabase/setup-cli@v1`; SHA pinning
  foi deferido à Story 11.7 de hardening — ver `deferred-work.md`). Aceita `aws-access-key-id`,
  `aws-secret-access-key`, `aws-region` e `role-to-assume` (para AssumeRole). O `aws` CLI já vem
  pré-instalado no runner `ubuntu-latest`; `jq` também.
- **`needs: deploy-supabase` (AC #7):** o deploy do app é o passo de infra que vem DEPOIS das migrations
  (§4-B/NFR11: `tests → deploy-supabase → deploy-amplify → smoke-test`). Encadeamento via `needs`.
- **Checkout obrigatório antes do composite local:** como nas Stories 11.3/11.4, um composite action
  local (`uses: ./.github/jobs/deploy-amplify`) só resolve **após** `actions/checkout`.
- **`shell:` obrigatório em composite:** todo step `run` dentro de um composite action DEVE declarar
  `shell:` (ex.: `bash`), senão o GitHub Actions rejeita o action em runtime.
- **Sem execução real do workflow no sandbox:** GitHub Actions e a AWS não rodam no sandbox. Os testes
  são estruturais/de contrato — parseiam o YAML via `js-yaml` e afirmam sobre a estrutura, o merge de
  env e o polling finito. Esperado e correto (mesmo padrão das Stories 11.2/11.3/11.4).
- **Parsing YAML via `js-yaml`:** já é devDependency. Reusar `yaml.load()`. Atenção: a chave nua `on`
  do workflow pode virar booleano `true` em YAML 1.1 — tolerar `doc.on ?? doc[true]` como nas 11.3/11.4.
- **Contrato do teste AC7 da Story 11.4 muda AGORA:** a 11.4 afirma
  `deepEqual(jobKeys, ["deploy-supabase", "tests"])`. Ao adicionar `deploy-amplify`, esse teste quebra;
  atualizá-lo para `["deploy-amplify", "deploy-supabase", "tests"]` (mantendo a intenção: nenhum job de
  11.6 ainda). Este é o único arquivo de outra story que esta story pode tocar, e apenas por esse motivo
  documentado — análogo ao ajuste que a 11.4 fez no teste AC5 da 11.3.
- **Baseline de testes pré-existente (não relacionado):** eventuais falhas pré-existentes em Epic 1
  (Stories 1.5/1.6) estão fora de escopo e não devem ser tocadas. "0 falhas novas" = nenhuma regressão
  introduzida por esta story.

### Project Structure Notes

- Arquivo novo: `.github/jobs/deploy-amplify/action.yml` — terceiro composite action da pipeline
  distribuída; consome secrets via `inputs` (como o `deploy-supabase`).
- Arquivo modificado: `.github/workflows/production.yml` — adiciona o job `deploy-amplify`
  (`needs: deploy-supabase`); jobs `tests` e `deploy-supabase` permanecem intactos.
- Arquivo novo: `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` — segue a convenção
  `tests/unit/story-{epic}-{story}/` de todas as stories anteriores.
- Arquivo modificado: `package.json` — novo script `test:story:11.5`.
- Arquivo modificado: `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` — ajuste do teste
  AC7 (`jobKeys` agora inclui `deploy-amplify`), conforme documentado acima.
- Nenhuma alteração em `src/`, `app/`, `middleware.ts`, `amplify.yml`, `supabase/migrations/`, ou
  qualquer módulo de domínio.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md (tabela §4-D, linha
  Story 11.5)] — contrato exato: "`.github/jobs/deploy-amplify/action.yml` (AssumeRole → sync env
  merge → `start-job RELEASE` → polling c/ timeout); job (needs: deploy-supabase)".
- [Source: sprint-change-proposal-2026-08-08.md#Seção 5, risco 4 (§5.4)] — `update-branch
  --environment-variables` substitui o mapa inteiro; ler → mesclar → reenviar; secrets nunca viram
  `NEXT_PUBLIC_*`; nada de secret nos logs.
- [Source: sprint-change-proposal-2026-08-08.md#Seção 5, risco 7 (§5.7)] — IAM least-privilege:
  bootstrap só `sts:AssumeRole`; deploy role só `amplify:StartJob/GetJob/GetBranch/UpdateBranch/ListJobs`
  no ARN do app.
- [Source: sprint-change-proposal-2026-08-08.md#Seção 5, risco 8 (§5.8)] — polling finito com
  timeout/max tentativas; falha explícita em estado ≠ `SUCCEED`.
- [Source: sprint-change-proposal-2026-08-08.md#Seção 5, risco 3 (§3.3)] — `STAGE=PROD` exige
  `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY`/`BLOCKCHAIN_WALLET_PRIVATE_KEY`/
  `BLOCKCHAIN_CONTRACT_ADDRESS` presentes no Amplify — garantido pelo merge do sync.
- [Source: sprint-change-proposal-2026-08-08.md#4-B, #4-C] — sequência de gates `tests →
  deploy-supabase → deploy-amplify → smoke-test`; auto-build do Amplify desabilitado; deploy via
  `start-job RELEASE`.
- [Source: _bmad-output/implementation-artifacts/stories/11-4-workflow-job-deploy-supabase.md] — story
  anterior do mesmo épico: padrão de composite com secrets via `inputs`, disciplina de não-vazamento,
  convenção de testes via `js-yaml`, e o precedente de atualizar o teste `jobKeys` da story anterior.
- [Source: .github/workflows/production.yml] — orquestrador existente (jobs `tests` + `deploy-supabase`
  + `permissions`) a ser estendido.
- [Source: .github/jobs/deploy-supabase/action.yml] — padrão de composite com secrets via `inputs`/`env`
  (nunca hardcoded/ecoado) a ser seguido.
- [Source: src/shared/environments.ts] — `productionRequiredEnvNames` + `superRefine`: env obrigatórias
  no boot quando `STAGE ∈ {PROD, HOMOLOG}`.
- [Source: package.json] — comando de teste, `js-yaml` como devDependency, convenção `test:story:*`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run test:story:11.5`: 26 passed / 0 failed.
- `npm run test:story:11.4` (regressão do ajuste AC7): 29 passed / 0 failed.
- `npm test` (suíte completa): 771 passed / 0 failed (síncrono) + 14 passed / 0 failed (dinâmico).

### Completion Notes List

- `.github/jobs/deploy-amplify/action.yml` criado — terceiro composite action da pipeline. Declara
  os `inputs` `aws-access-key-id`/`aws-secret-access-key`/`aws-region`/`aws-role-to-assume`/
  `amplify-app-id`/`amplify-branch-name`/`amplify-environment-variables` (todos `required: true`).
  Steps: `aws-actions/configure-aws-credentials@v4` (bootstrap + `role-to-assume` = AssumeRole) →
  sync de env por MERGE (`get-branch` lê o mapa atual → `jq '$current * $incoming'` mescla →
  `update-branch --cli-input-json` reenvia o mapa mesclado) → `amplify start-job --job-type RELEASE`
  → polling finito (60×15s = 15 min: `SUCCEED`→exit 0; `FAILED`/`CANCELLED`/inesperado/timeout→exit 1).
- **§5.4 (sync por merge):** o `update-branch` recebe o mapa mesclado (atual ∪ novo, com o novo
  vencendo em coincidências), nunca só o subconjunto novo — preserva secrets server-side exigidos no
  boot por `environments.ts` (`STAGE=PROD`). Coberto por teste dedicado (ordem get→update + evidência
  do `jq '* '`).
- **§5.7 (AssumeRole least-privilege):** creds bootstrap (só `sts:AssumeRole`) assumem o deploy role
  via `role-to-assume` (ARN vindo de input). O JSON das policies IAM é escopo da Story 11.7.
- **§5.8 (polling finito):** loop com `max_attempts`/timeout e falha explícita (`exit 1`) em terminal
  ≠ `SUCCEED` e no estouro do timeout; guardrail de teste garante ausência de `while true`.
- **Segurança de secrets:** nenhum literal de credencial/ARN no YAML; env vars sensíveis via `env:`
  (inputs); nada de `echo`/`cat` de credenciais; nenhum `NEXT_PUBLIC_*` recebe secret.
- `.github/workflows/production.yml` estendido — novo job `deploy-amplify` (`runs-on: ubuntu-latest`,
  `needs: deploy-supabase`), com `actions/checkout@v4` ANTES de `uses: ./.github/jobs/deploy-amplify`.
  Secrets centralizados no orquestrador e passados via `with:` referenciando `${{ secrets.* }}`. Jobs
  `tests` e `deploy-supabase` intactos; `permissions: contents: read` mantido. `smoke-test` (11.6) não
  adicionado.
- Teste AC7 da Story 11.4 atualizado (`jobKeys` agora `["deploy-amplify", "deploy-supabase", "tests"]`),
  conforme o precedente da 11.4 sobre a 11.3.
- Sem execução real de GitHub Actions/AWS no sandbox — testes de contrato/estruturais, esperado
  (mesmo padrão das Stories 11.2/11.3/11.4).

### File List

- `.github/jobs/deploy-amplify/action.yml` (novo — dev-story)
- `.github/workflows/production.yml` (modificado — dev-story; job `deploy-amplify` encadeado)
- `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` (novo — dev-story; 26 testes)
- `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` (modificado — ajuste do teste AC7)
- `package.json` (modificado — novo script `test:story:11.5`)
- `tests/unit/story-11-5/deploy-amplify-contract.test.mjs` (novo — QA; 10 testes de contrato)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificado — 3 itens deferidos do code review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (modificado — seção Story 11.5 — QA)

## Change Log

- 2026-08-09: Story criada via `bmad-create-story`. Status → ready-for-dev.
- 2026-08-09: Implementação completa — `.github/jobs/deploy-amplify/action.yml` (composite:
  configure-aws-credentials + AssumeRole → sync env por merge → `start-job RELEASE` → polling finito),
  job `deploy-amplify` (`needs: deploy-supabase`) em `production.yml`, 26 testes estruturais novos
  (parse real via `js-yaml`) e ajuste do teste AC7 da Story 11.4. Suíte completa 771 sync + 14
  dinâmicos, 0 falhas. Status → review.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline) — 0
  decision-needed, 0 patch, 3 defer (SHA-pinning da action AWS; tolerância a erro transitório no
  polling; validação do payload JSON de env → Story 11.7, registrados em `deferred-work.md`), 0
  dismiss. Nenhum patch a aplicar; suíte permanece 771 sync + 14 dinâmicos, 0 falhas. Status → test.
- 2026-08-09: QA adicionou `tests/unit/story-11-5/deploy-amplify-contract.test.mjs` (10 testes):
  ordem completa auth→sync→start-job→polling, "exatamente um start-job RELEASE" (sem deploy duplicado),
  jobId via GITHUB_OUTPUT consumido pelo polling, alinhamento exato `with:`↔`inputs`, fronteira de
  secrets (composite só usa `inputs.*`), `needs` exatamente `[deploy-supabase]`, região via env em todo
  step AWS e reforço do merge de env. Suíte da story: 36 testes (26 dev + 10 QA). Suíte completa: 781
  síncronos + 14 dinâmicos, 0 falhas. `test-summary.md` atualizado. Status → done.
