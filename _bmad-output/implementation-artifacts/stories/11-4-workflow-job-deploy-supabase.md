# Story 11.4: Composite `deploy-supabase` + Job Encadeado na Pipeline

Status: done

> **Nota de contexto:** quarta story do Epic 11 (Pipeline de CI/CD de Produção, Sprint Change
> 2026-08-08). As Stories 11.1 (`GET /api/health`), 11.2 (`amplify.yml` + desabilitar auto-build)
> e 11.3 (composite `tests` + orquestrador base `production.yml`) já estão `done`. Esta story
> adiciona o **segundo composite action** da pipeline distribuída
> (`.github/jobs/deploy-supabase/action.yml`) e **encadeia** um job `deploy-supabase` no
> `production.yml` com `needs: tests` — ou seja, migrations só são aplicadas ao Supabase Cloud
> **depois** que a suíte de testes (gate da Story 11.3) passar. Os jobs seguintes
> (`deploy-amplify` — Story 11.5; `smoke-test` — Story 11.6) serão encadeados via `needs:` a
> partir de `deploy-supabase` em stories futuras.
>
> **Estrutura distribuída (§4-D da proposta):** cada job vive em `.github/jobs/<nome>/action.yml`
> como **composite action** (reusable workflows do GitHub só podem ficar em `.github/workflows/`;
> composite actions podem morar em qualquer pasta e são chamados por `uses: ./.github/jobs/<nome>`).
> O `production.yml` é fino: apenas orquestra os composites. Como o composite `deploy-supabase`
> **precisa de secrets** (access token, project-ref, DB password), eles são passados via `with:`
> (inputs) a partir do orquestrador — **nunca hardcoded**, **nunca ecoados nos logs**. Esta é a
> diferença central em relação ao composite `tests` da Story 11.3, que não precisava de secrets.
>
> **Estado encontrado na codebase:** `.github/workflows/production.yml` e `.github/jobs/tests/action.yml`
> já existem (Story 11.3). Esta story ESTENDE `production.yml` (adiciona o job `deploy-supabase`) e
> ADICIONA o diretório novo `.github/jobs/deploy-supabase/`. O diretório `supabase/migrations/` tem
> **1 baseline** (`20260728015653_remote_schema.sql`) — um dump de `db pull` já refletido no remoto,
> portanto `db push` deve ser **no-op** no primeiro release. Node local neste ambiente é v23+; o CI
> não roda GitHub Actions no sandbox — os testes são estruturais/de contrato (parse YAML via `js-yaml`).

## Story

Como pipeline de CI/CD de produção (Epic 11, orquestrada pelo GitHub Actions na branch `prod`),
Quero um composite action `deploy-supabase` reutilizável (`.github/jobs/deploy-supabase/action.yml`)
que configure a Supabase CLI, faça `supabase link` com o project-ref, execute `supabase db push --dry-run`
(preview) e só então `supabase db push` (apply), além de um job `deploy-supabase` no orquestrador
`production.yml` que rode com `needs: tests`,
Para que as migrations pendentes sejam aplicadas ao Supabase Cloud de forma segura (preview antes de
apply, expand→contract), como **primeiro passo de infra** do release — depois do gate `tests` e
**antes** do deploy do app (Story 11.5) — sem nunca hardcodear ou ecoar secrets.

## Acceptance Criteria

1. **Given** o repositório do projeto
   **When** o arquivo `.github/jobs/deploy-supabase/action.yml` é inspecionado
   **Then** ele existe, é YAML válido, e é um **composite action** — contém `runs.using: "composite"`
   e uma lista `runs.steps` não vazia

2. **Given** o composite action `deploy-supabase`
   **When** sua seção `inputs` é inspecionada
   **Then** ele declara inputs para os secrets/parâmetros necessários — no mínimo:
   `supabase-access-token`, `supabase-project-ref` e `supabase-db-password` — para que o orquestrador
   os passe via `with:` (**nunca hardcoded** no composite)
   **And** os inputs de secret são marcados `required: true`

3. **Given** o composite action `deploy-supabase`
   **When** seus `runs.steps` são inspecionados
   **Then** existe um passo que instala/configura a **Supabase CLI** (ex.: `supabase/setup-cli`)
   **And** existe um passo `supabase link` que usa o `supabase-project-ref` via input/env
   **And** existe um passo `supabase db push --dry-run` (preview)
   **And** existe um passo `supabase db push` (apply)
   **And** todo passo `run` declara `shell:` (obrigatório em composite actions)

4. **Given** o composite action `deploy-supabase` (ordenação = propriedade de segurança-chave da story)
   **When** a ordem dos passos é inspecionada
   **Then** o passo `db push --dry-run` ocorre **ANTES** do passo `db push` real
   (preview→apply, expand→contract §5.5) — nunca o contrário

5. **Given** o composite action `deploy-supabase`
   **When** o texto bruto do YAML é inspecionado
   **Then** **nenhum literal de secret** aparece hardcoded — em particular o project-ref
   `lygkwhcwsrxfozswhxyo`, tokens de acesso, ou senha de DB **não** podem aparecer como literais;
   os valores vêm exclusivamente dos `inputs` (`${{ inputs.* }}`)
   **And** os secrets **não** são ecoados em `run:` (sem `echo`/`cat`/`printenv` do token ou senha)

6. **Given** o workflow `production.yml`
   **When** a seção `jobs` é inspecionada
   **Then** existe um job `deploy-supabase` que roda em `runs-on: ubuntu-latest`, declara
   **`needs: tests`** (gate sequencial após o job `tests` da Story 11.3), faz checkout do código
   (`actions/checkout`) e chama o composite via `uses: ./.github/jobs/deploy-supabase`
   **And** o job passa os secrets ao composite via `with:` referenciando `${{ secrets.* }}`
   (nunca literais) — os secrets ficam centralizados no orquestrador

7. **Given** o workflow `production.yml`
   **When** o encadeamento dos jobs é inspecionado
   **Then** o job `tests` (Story 11.3) permanece intacto e continua sendo o primeiro gate, e o job
   `deploy-supabase` só executa após `tests` passar (via `needs: tests`)
   **And** esta story **não** adiciona os jobs `deploy-amplify` (11.5) nem `smoke-test` (11.6) —
   os únicos jobs em `production.yml` devem ser `tests` e `deploy-supabase`

## Tasks / Subtasks

- [x] Task 1: Criar o composite action `.github/jobs/deploy-supabase/action.yml` (AC: #1, #2, #3, #4, #5)
  - [x] Definir `name` e `description` do composite
  - [x] Declarar `inputs`: `supabase-access-token` (required), `supabase-project-ref` (required),
    `supabase-db-password` (required), com `description` em cada um
  - [x] Definir `runs.using: "composite"`
  - [x] Passo `uses: supabase/setup-cli@v1` (`with.version: latest`) para instalar a CLI
  - [x] Passo `supabase link --project-ref "$SUPABASE_PROJECT_REF"` com `shell: bash`,
    usando `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF`/`SUPABASE_DB_PASSWORD` via `env:` (inputs)
  - [x] Passo `supabase db push --dry-run` (preview) com `shell: bash` — ANTES do apply
  - [x] Passo `supabase db push` (apply) com `shell: bash` — DEPOIS do dry-run
  - [x] Garantir que NENHUM literal de secret aparece; tudo via `${{ inputs.* }}` / `env:`;
    nunca `echo`/`cat` do token ou senha
  - [x] Validar que o YAML é sintaticamente válido e tem `runs.using == "composite"`

- [x] Task 2: Encadear o job `deploy-supabase` no `.github/workflows/production.yml` (AC: #6, #7)
  - [x] Adicionar job `deploy-supabase` com `runs-on: ubuntu-latest` e `needs: tests`
  - [x] Passo `uses: actions/checkout@v4` (necessário para resolver o composite local)
  - [x] Passo `uses: ./.github/jobs/deploy-supabase` com bloco `with:` passando
    `supabase-access-token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}`,
    `supabase-project-ref: ${{ secrets.SUPABASE_PROJECT_REF }}`,
    `supabase-db-password: ${{ secrets.SUPABASE_DB_PASSWORD }}`
  - [x] Manter o job `tests` intacto (não regredir a Story 11.3)
  - [x] NÃO adicionar `deploy-amplify` nem `smoke-test` (fora de escopo)
  - [x] Confirmar que o bloco `permissions` do workflow continua least-privilege (`contents: read`)

- [x] Task 3: Criar testes estruturais/de contrato em `tests/unit/story-11-4/` (AC: #1–#7)
  - [x] Criar `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` com **parse real via `js-yaml`**
  - [x] Testar que `.github/jobs/deploy-supabase/action.yml` existe, parseia, e tem
    `runs.using == "composite"`
  - [x] Testar os inputs `supabase-access-token`, `supabase-project-ref`, `supabase-db-password`
    (`required: true`)
  - [x] Testar setup da Supabase CLI, `supabase link`, `db push --dry-run`, `db push`, e `shell` em todo `run`
  - [x] **Testar a ordenação-chave**: índice do `db push --dry-run` < índice do `db push` real
  - [x] Testar que NENHUM literal de secret aparece no YAML bruto e que os valores vêm de `${{ inputs.* }}`
  - [x] Testar que os secrets não são ecoados nos `run`
  - [x] Testar o job `deploy-supabase` com `needs: tests`, `ubuntu-latest`, checkout, `uses` do composite
    e `with:` referenciando `${{ secrets.* }}` (não literais)
  - [x] Testar que os jobs de `production.yml` são exatamente `tests` e `deploy-supabase`
  - [x] Adicionar script `test:story:11.4` em `package.json`
  - [x] Rodar `npm test` e confirmar 0 falhas novas (737 sync + 14 dinâmicos, 0 falhas)
  - [x] **Atualizar o teste AC5 da Story 11.3** (dismiss registrado na 11.3) — ajustado para garantir
    que `tests` é o gate inicial (sem `needs`) e que todo job adicional depende de `tests` via `needs`,
    sem travar a contagem exata de jobs (que cresce a cada story do Epic 11)

### Review Findings

Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline — diff pequeno de infra
YAML). 0 decision-needed, 0 patch, 2 defer, 1 dismiss. Suíte após review: 737 sync + 14 dinâmicos, 0
falhas (nenhum patch aplicado — nada a re-testar).

- [x] [Review][Defer] `supabase/setup-cli@v1` usa `version: latest` — versão da CLI não determinística
  entre releases [.github/jobs/deploy-supabase/action.yml] — deferido para a Story 11.7
  (hardening operacional), consistente com o defer de SHA-pinning das actions registrado na Story 11.3.
- [x] [Review][Defer] `supabase db push` (apply) pode aguardar confirmação interativa em runner CI
  não-TTY [.github/jobs/deploy-supabase/action.yml] — não reproduzível no sandbox (GitHub Actions/Supabase
  Cloud não rodam aqui) e não especificado no contrato §4-D da proposta; verificar no primeiro release
  real e, se necessário, adicionar flag não-interativa. Deferido para validação operacional (Story 11.7).
- [x] [Review][Dismiss] Teste AC5 da Story 11.3 foi enfraquecido (agora só verifica `needs.length > 0`,
  não `includes("tests")`) — dismissed: intencional. A checagem estrita de `needs: tests` é coberta pelo
  teste dedicado da própria Story 11.4 (`AC6: job deploy-supabase declara needs: tests`); manter o teste
  da 11.3 genérico evita contrato frágil que quebraria a cada job novo do Epic 11.

## Dev Notes

- **Escopo estritamente de infraestrutura de CI, sem código de aplicação.** Como as Stories 11.1–11.3,
  esta story não toca `src/modules/*`, `application/usecases/`, nem camadas
  controller/presenter/viewmodel. Entrega um novo composite YAML, estende o `production.yml` e adiciona
  testes estruturais. Não altera schema do banco nem cria novas migrations.
- **§5.5 CRÍTICO — Segurança de migrations (expand→contract) + ordem dry-run→push:** o baseline
  `supabase/migrations/20260728015653_remote_schema.sql` é um dump de `db pull` já refletido no remoto,
  então `db push` deve ser **no-op** no primeiro release. Ainda assim, o composite DEVE rodar
  `db push --dry-run` (preview) **antes** de `db push` (apply). Migrations destrutivas futuras
  (`DROP COLUMN`) só depois que a app publicada deixar de depender da estrutura antiga. **A ordenação
  dry-run→push é a propriedade de segurança-chave desta story** e precisa de um teste dedicado (AC #4).
- **§4-C / FR34 nota — posição na pipeline:** o `deploy-supabase` aplica migrations pendentes como o
  **primeiro passo de infra** do release, DEPOIS do gate `tests` (§4-B/NFR11: `tests → deploy-supabase
  → deploy-amplify → smoke-test`) e ANTES do deploy do app (Story 11.5, que declarará
  `needs: deploy-supabase`). Por isso `needs: tests` no job (AC #6).
- **Secrets via `with:` (nunca hardcoded / nunca ecoados) — §4-D e §5.4:** diferente do composite
  `tests`, este precisa de secrets: `SUPABASE_ACCESS_TOKEN` (auth da CLI), o **project-ref**
  `lygkwhcwsrxfozswhxyo` e a senha do banco. Todos entram como `inputs` do composite e são passados
  pelo orquestrador via `with:` referenciando `${{ secrets.* }}`. **Nenhum literal** desses valores
  pode aparecer no YAML; **nada** de `echo $SUPABASE_ACCESS_TOKEN` ou similar (vazaria nos logs). O
  `supabase/setup-cli` e a própria CLI leem `SUPABASE_ACCESS_TOKEN` do ambiente; passe-o via `env:` no
  step, a partir do input. A senha do DB pode ir via `env: SUPABASE_DB_PASSWORD` ou `--password`
  (a CLI aceita `--password`), sempre a partir do input — nunca literal.
- **`supabase/setup-cli@v1`:** action oficial da Supabase para instalar a CLI no runner. Pinada por
  tag de major (consistente com `actions/checkout@v4` e `actions/setup-node@v4` do projeto; SHA pinning
  foi deferido à Story 11.7 de hardening — ver `deferred-work.md`). `with.version` pode ser omitido
  (usa a mais recente) ou fixado; siga o padrão minimalista da Story 11.3.
- **`supabase link`:** amarra o diretório local ao projeto remoto pelo `--project-ref`. Requer
  `SUPABASE_ACCESS_TOKEN` no ambiente. A senha do DB pode ser exigida pelo link/push — passe via input.
- **Checkout obrigatório antes do composite local:** como na Story 11.3, um composite action local
  (`uses: ./.github/jobs/deploy-supabase`) só resolve **após** `actions/checkout`. O job precisa das
  migrations em `supabase/migrations/` no runner, o que o checkout garante.
- **`shell:` obrigatório em composite:** todo step `run` dentro de um composite action DEVE declarar
  `shell:` (ex.: `bash`), senão o GitHub Actions rejeita o action em runtime (mesma regra da 11.3).
- **Sem execução real do workflow no sandbox:** GitHub Actions não roda no sandbox e não há acesso ao
  Supabase Cloud aqui. Os testes são estruturais/de contrato — parseiam o YAML via `js-yaml` e afirmam
  sobre a estrutura e a ordenação. Isso é esperado e correto (mesmo padrão das Stories 11.2/11.3).
- **Parsing YAML via `js-yaml`:** `js-yaml` já é devDependency (desde a Story 11.2 QA). Reusar
  `yaml.load()` para parse semântico real. Atenção: em YAML 1.1 a chave nua `on` do workflow pode virar
  booleano `true` — tolerar `doc.on ?? doc[true]` como na Story 11.3.
- **Contrato do teste AC5 da Story 11.3 muda AGORA:** a Story 11.3 registrou um "dismiss" explícito de
  que seu teste `deepEqual(jobKeys, ["tests"])` quebraria quando a 11.4 adicionasse `deploy-supabase`,
  e que "a Story 11.4 atualizará esse contrato". Cumprir isso: ajustar aquele teste em
  `tests/unit/story-11-3/workflow-job-tests.test.mjs` para esperar `["tests", "deploy-supabase"]`
  (mantendo a intenção: nenhum job de 11.5/11.6 ainda). Este é o único arquivo de outra story que esta
  story pode tocar, e apenas por esse motivo documentado.
- **Baseline de testes pré-existente (não relacionado):** eventuais falhas pré-existentes em Epic 1
  (Stories 1.5/1.6) estão fora de escopo e não devem ser tocadas. "0 falhas novas" refere-se a nenhuma
  regressão introduzida por esta story.

### Project Structure Notes

- Arquivo novo: `.github/jobs/deploy-supabase/action.yml` — segundo composite action da pipeline
  distribuída; primeiro que consome secrets via `inputs`.
- Arquivo modificado: `.github/workflows/production.yml` — adiciona o job `deploy-supabase`
  (`needs: tests`); job `tests` da Story 11.3 permanece intacto.
- Arquivo novo: `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` — segue a convenção
  `tests/unit/story-{epic}-{story}/` de todas as stories anteriores.
- Arquivo modificado: `package.json` — novo script `test:story:11.4`.
- Arquivo modificado: `tests/unit/story-11-3/workflow-job-tests.test.mjs` — ajuste do teste AC5
  (base-mínima → agora `["tests", "deploy-supabase"]`), conforme o "dismiss" documentado na Story 11.3.
- Nenhuma alteração em `src/`, `app/`, `middleware.ts`, `supabase/migrations/`, ou qualquer módulo de
  domínio.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md (tabela §4-D, linha
  Story 11.4)] — contrato exato: "`.github/jobs/deploy-supabase/action.yml` (setup CLI → `link` →
  `db push --dry-run` → `db push`); job `deploy-supabase` (needs: tests)".
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#4-D] — estrutura
  distribuída (composite actions em `.github/jobs/<nome>/`, orquestrados por `production.yml`); secrets
  via `with:` (inputs), centralizados no orquestrador, nunca hardcoded.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#Seção 5, risco 5]
  — expand→contract: baseline é dump de `db pull` já refletido no remoto (`db push` no-op); dry-run
  antes do push; migrations destrutivas só após a app não depender mais da estrutura antiga.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#4-B, #4-C] — sequência
  de gates `tests → deploy-supabase → deploy-amplify → smoke-test`; FR34 nota: release aplica migrations
  via `db push` (precedido de `--dry-run`) como primeiro passo de infra, antes do deploy do app.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md (§evidência, linha 34)]
  — project-ref `lygkwhcwsrxfozswhxyo`; `supabase/migrations/` com 1 baseline.
- [Source: _bmad-output/implementation-artifacts/stories/11-3-workflow-job-tests.md] — story anterior
  do mesmo épico: composite `tests`, orquestrador base, convenção de testes via `js-yaml`, `permissions:
  contents: read`, dismiss explícito do teste AC5 a ser atualizado por esta story.
- [Source: .github/workflows/production.yml] — orquestrador existente (job `tests` + `permissions`) a
  ser estendido.
- [Source: .github/jobs/tests/action.yml] — padrão de composite action (using: composite, shell: bash,
  pin de actions por major tag) a ser seguido.
- [Source: package.json] — comando de teste, `js-yaml` como devDependency, convenção `test:story:*`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run test:story:11.4`: 21 passed / 0 failed.
- `npm test` (suíte completa): 737 passed / 0 failed (síncrono) + 14 passed / 0 failed (dinâmico).
- Ajuste: a mensagem de um assert usava um template literal com `${{ secrets.* }}`, que o JS
  interpreta como interpolação inválida — corrigido para texto plano (`secrets.*`).

## Change Log

- 2026-08-09: Story criada via `bmad-create-story`. Status → ready-for-dev.
- 2026-08-09: Implementação completa — `.github/jobs/deploy-supabase/action.yml` (composite com
  inputs de secret, setup CLI → link → `db push --dry-run` → `db push`), job `deploy-supabase`
  (`needs: tests`) em `production.yml`, 21 testes estruturais novos (parse real via `js-yaml`,
  incluindo a asserção da ordem dry-run→push e ausência de secrets literais/ecoados), e ajuste do
  teste AC5 da Story 11.3 (dismiss documentado). Suíte completa 737 sync + 14 dinâmicos, 0 falhas.
  Status → review.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline) — 0
  decision-needed, 0 patch, 2 defer (setup-cli `version: latest`; confirmação interativa do `db push`
  → Story 11.7, registrados em `deferred-work.md`), 1 dismiss (enfraquecimento intencional do teste AC5
  da 11.3). Nenhum patch a aplicar; suíte permanece 737 sync + 14 dinâmicos, 0 falhas. Status → test.
- 2026-08-09: QA adicionou `tests/unit/story-11-4/deploy-supabase-contract.test.mjs` (8 testes):
  ordem completa setup-cli→link→dry-run→push, "exatamente um apply" (sem push duplicado), alinhamento
  exato `with:`↔`inputs`, fronteira de secrets (composite só usa `inputs.*`, nunca `secrets.*`) e
  `needs: [tests]` exato. Suíte da story: 29 testes (21 dev + 8 QA). Suíte completa: 745 síncronos +
  14 dinâmicos, 0 falhas. `test-summary.md` atualizado. Status → done.

### Completion Notes List

- `.github/jobs/deploy-supabase/action.yml` criado — segundo composite action da pipeline; o primeiro
  a consumir secrets. Declara `inputs` `supabase-access-token`/`supabase-project-ref`/
  `supabase-db-password` (todos `required: true`). Steps: `supabase/setup-cli@v1` → `supabase link`
  → `supabase db push --dry-run` (preview) → `supabase db push` (apply). Secrets expostos aos comandos
  apenas via `env:` (a partir dos inputs); nenhum literal de secret; nenhum `echo`/`cat` de token/senha.
- `.github/workflows/production.yml` estendido — novo job `deploy-supabase` (`runs-on: ubuntu-latest`,
  `needs: tests`), com `actions/checkout@v4` ANTES de `uses: ./.github/jobs/deploy-supabase`. Secrets
  centralizados no orquestrador e passados via `with:` referenciando `${{ secrets.* }}`. Job `tests`
  intacto; `permissions: contents: read` mantido. Nenhum job de 11.5/11.6 adicionado.
- **Propriedade de segurança-chave (§5.5) coberta por teste dedicado (AC #4):** o índice do step
  `db push --dry-run` é estritamente menor que o do `db push` real — preview sempre antes do apply.
- Testes em `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` (21) — parse real via
  `js-yaml`, cobrindo os 7 ACs.
- Teste AC5 da Story 11.3 atualizado conforme o dismiss documentado: em vez de travar a contagem exata
  de jobs, garante que `tests` é o gate inicial (sem `needs`) e que jobs adicionais dependem via `needs`.
- Sem execução real de GitHub Actions/Supabase no sandbox — testes de contrato/estruturais, esperado.

### File List

- `.github/jobs/deploy-supabase/action.yml` (novo — dev-story)
- `.github/workflows/production.yml` (modificado — dev-story; job `deploy-supabase` encadeado)
- `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` (novo — dev-story; 21 testes)
- `tests/unit/story-11-3/workflow-job-tests.test.mjs` (modificado — ajuste do teste AC5, dismiss 11.3)
- `package.json` (modificado — novo script `test:story:11.4`)
- `tests/unit/story-11-4/deploy-supabase-contract.test.mjs` (novo — QA; 8 testes de contrato)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificado — 2 itens deferidos do code review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (modificado — seção Story 11.4 — QA)
