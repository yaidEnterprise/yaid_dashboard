# Story 11.3: Composite `tests` + Orquestrador Base da Pipeline

Status: done

> **Nota de contexto:** terceira story do Epic 11 (Pipeline de CI/CD de Produção, Sprint Change
> 2026-08-08). As Stories 11.1 (`GET /api/health`) e 11.2 (`amplify.yml` + desabilitar auto-build)
> já estão `done`. Esta story cria a **fundação da pipeline distribuída**: o primeiro composite
> action (`.github/jobs/tests/action.yml`) e o orquestrador base (`.github/workflows/production.yml`)
> com o trigger na branch `prod` e o job `tests` que consome o composite. Os jobs seguintes
> (`deploy-supabase`, `deploy-amplify`, `smoke-test` — Stories 11.4/11.5/11.6) serão encadeados via
> `needs:` a partir deste job `tests` em stories futuras.
>
> **Estrutura distribuída (decisão do usuário — §4-D da proposta):** cada job vive em
> `.github/jobs/<nome>/action.yml` como **composite action** (reusable workflows do GitHub só podem
> ficar em `.github/workflows/`, subpastas não são suportadas; composite actions podem morar em
> qualquer pasta e são chamadas por `uses: ./.github/jobs/<nome>`). O `production.yml` é fino: apenas
> orquestra os composites. Secrets, quando necessários, são passados via `with:` (inputs) a partir do
> orquestrador — nunca hardcoded. O job `tests` desta story não precisa de secrets (só roda a suíte).
>
> **Estado encontrado na codebase:** `.github/` **não existe** ainda — esta é a primeira story a
> criá-lo. Node local neste ambiente é v23; o CI **deve fixar Node 22 (LTS)** — ver risco crítico §5.1.

## Story

Como pipeline de CI/CD de produção (Epic 11, orquestrada pelo GitHub Actions na branch `prod`),
Quero um composite action `tests` reutilizável (`.github/jobs/tests/action.yml`) que configure Node 22,
instale dependências com `npm ci` e rode `npm test`, além de um workflow orquestrador base
(`.github/workflows/production.yml`) disparado por push na branch `prod` com um job `tests` que consome
esse composite,
Para que nenhum deploy (Supabase/Amplify — Stories 11.4/11.5) aconteça antes da suíte de testes passar
como primeiro gate do release, e para que os jobs seguintes possam ser encadeados via `needs: tests`.

## Acceptance Criteria

1. **Given** o repositório do projeto
   **When** o arquivo `.github/jobs/tests/action.yml` é inspecionado
   **Then** ele existe, é YAML válido, e é um **composite action** — contém `runs.using: "composite"`
   e uma lista `runs.steps`

2. **Given** o composite action `tests`
   **When** seus `runs.steps` são inspecionados
   **Then** existe um passo que usa `actions/setup-node` fixando **Node 22** (`with.node-version: "22"`
   ou `"22.x"`) — **nunca** Node 18 ou 20, pois `node --test "tests/unit/**/*.test.mjs"` só expande o
   glob `**` a partir do Node 21+ (Node 18/20 coletaria zero testes silenciosamente — risco crítico §5.1)
   **And** existe um passo `run: npm ci` (instalação determinística a partir do `package-lock.json`)
   **And** existe um passo `run: npm test` (executa `node --test "tests/unit/**/*.test.mjs"` seguido de
   `npm run test:dynamic` via tsx, conforme `package.json`)
   **And** todo passo `run` declara `shell:` (obrigatório em passos `run` de composite actions)

3. **Given** o repositório do projeto
   **When** o arquivo `.github/workflows/production.yml` é inspecionado
   **Then** ele existe, é YAML válido, e dispara em push na branch `prod`
   (`on.push.branches` contém `prod`)

4. **Given** o workflow `production.yml`
   **When** a seção `jobs` é inspecionada
   **Then** existe um job `tests` que roda em `runs-on: ubuntu-latest`, faz checkout do código
   (`actions/checkout`) — necessário porque um composite action local só fica disponível após o
   checkout — e chama o composite via `uses: ./.github/jobs/tests`

5. **Given** o composite `tests` e o orquestrador `production.yml`
   **When** lidos em conjunto com o restante do Epic 11
   **Then** fica explícito que este job `tests` é o **primeiro gate** da pipeline: os jobs futuros
   (`deploy-supabase` da Story 11.4, etc.) declararão `needs: tests`, garantindo que nenhum deploy
   ocorra se a suíte falhar. O `production.yml` desta story contém **apenas** o job `tests` (base
   mínima); os demais jobs são adicionados nas stories seguintes.

## Tasks / Subtasks

- [x] Task 1: Criar o composite action `.github/jobs/tests/action.yml` (AC: #1, #2)
  - [x] Definir `name` e `description` do composite
  - [x] Definir `runs.using: "composite"`
  - [x] Passo `uses: actions/setup-node@v4` com `with.node-version: "22"` (fixar Node 22 LTS — §5.1)
  - [x] Passo `run: npm ci` com `shell: bash`
  - [x] Passo `run: npm test` com `shell: bash`
  - [x] Validar que o YAML é sintaticamente válido e tem `runs.using == "composite"`

- [x] Task 2: Criar o orquestrador `.github/workflows/production.yml` (AC: #3, #4, #5)
  - [x] Definir `name` do workflow
  - [x] Definir `on.push.branches: [prod]`
  - [x] Job `tests` com `runs-on: ubuntu-latest`
  - [x] Passo `uses: actions/checkout@v4` (necessário para o composite local ficar disponível)
  - [x] Passo `uses: ./.github/jobs/tests` (consome o composite da Task 1)
  - [x] Deixar o workflow preparado para os jobs seguintes serem encadeados via `needs: tests`

### Review Findings

- [x] [Review][Patch] `production.yml` não declarava bloco `permissions`, herdando o escopo default
  (frequentemente amplo) do `GITHUB_TOKEN` para o job `tests` [.github/workflows/production.yml] —
  corrigido: adicionado `permissions: contents: read` (least-privilege, alinhado à postura de
  segurança do Epic 11, §5.7 — o job só precisa ler o repo para o checkout). Teste novo adicionado.
- [x] [Review][Defer] GitHub Actions referenciados por tags de major mutáveis
  (`actions/checkout@v4`, `actions/setup-node@v4`) em vez de commit SHAs fixos — oportunidade de
  hardening de supply-chain. Consistente com o restante do projeto (nenhuma story fixa SHA); deferido
  para a Story 11.7 (documentação/hardening operacional). [.github/jobs/tests/action.yml,
  .github/workflows/production.yml]
- [x] [Review][Dismiss] Teste AC5 (`deepEqual(jobKeys, ["tests"])`) quebrará quando a Story 11.4
  adicionar o job `deploy-supabase` — dismissed: comportamento intencional, o AC#5 exige explicitamente
  que esta story entregue a "base mínima" com apenas o job `tests`; a Story 11.4 atualizará esse
  contrato ao encadear o próximo job.

- [x] Task 3: Criar testes estruturais/de contrato em `tests/unit/story-11-3/` (AC: #1, #2, #3, #4, #5)
  - [x] Criar `tests/unit/story-11-3/workflow-job-tests.test.mjs` fazendo **parse real via `js-yaml`**
    dos dois arquivos YAML (padrão estabelecido na Story 11.2 — `js-yaml` já é devDependency declarada),
    não apenas regex sobre texto
  - [x] Testar que `.github/jobs/tests/action.yml` existe, parseia, e tem `runs.using == "composite"`
  - [x] Testar que os steps do composite incluem `actions/setup-node` com `node-version` começando com
    `22` (afirmar explicitamente que **não** é 18 nem 20 — regressão do risco §5.1)
  - [x] Testar que os steps do composite incluem `npm ci` e `npm test`, e que todo step com `run`
    declara `shell`
  - [x] Testar que `.github/workflows/production.yml` existe, parseia, e dispara em push na branch `prod`
  - [x] Testar que existe o job `tests` com `runs-on: ubuntu-latest`, um step `actions/checkout` e um
    step `uses: ./.github/jobs/tests`
  - [x] Adicionar script `test:story:11.3` em `package.json` (convenção de todas as stories anteriores)
  - [x] Rodar `npm test` e confirmar 0 falhas novas (baseline pré-existente de 2 falhas em Story
    1.5/1.6 permanece inalterada — fora de escopo, Epic 1)

## Dev Notes

- **Escopo estritamente de infraestrutura de CI, sem código de aplicação.** Como as Stories 11.1/11.2,
  esta story não toca `src/modules/*`, `application/usecases/`, nem camadas
  controller/presenter/viewmodel. Entrega dois arquivos YAML de GitHub Actions + testes estruturais.
- **RISCO CRÍTICO §5.1 — Node 22 obrigatório:** `npm test` executa
  `node --test "tests/unit/**/*.test.mjs"`. O padrão de glob `**` (globstar) só é expandido pelo
  próprio Node a partir do **Node 21+**. Em Node 18 ou 20, o runner de testes não encontraria nenhum
  arquivo e o comando **passaria com zero testes coletados** — um falso verde que deixaria o gate
  inútil. Por isso o `setup-node` **deve** fixar Node 22 (LTS). Este é o detalhe de correção mais
  importante da story. O `package.json` declara `engines.node: ">=18"`, mas isso é o mínimo para
  *build/runtime*; o **CI de testes** precisa de 22 por causa do globstar.
- **Por que composite action e não reusable workflow:** decisão do usuário (§4-D). Reusable workflows
  do GitHub só podem ficar em `.github/workflows/` (subpastas não suportadas). Para manter cada job em
  seu próprio arquivo sob `.github/jobs/<nome>/`, usa-se composite actions, chamados por
  `uses: ./.github/jobs/<nome>`. Um composite action local só é resolvido **após** o `checkout` do
  repositório — por isso o job `tests` precisa de um step `actions/checkout` antes do `uses: ./...`.
- **`shell:` obrigatório em composite:** diferente de steps `run` em jobs normais de workflow, todo
  step `run` dentro de um composite action **deve** declarar `shell:` explicitamente (ex.: `bash`),
  senão o GitHub Actions rejeita o action em tempo de execução.
- **`npm ci` (não `npm install`):** instalação determinística a partir do `package-lock.json`,
  apropriada para CI — falha se `package.json` e o lockfile divergirem, garantindo builds reproduzíveis.
- **Sem execução real do workflow neste ambiente:** GitHub Actions não roda no sandbox. Os testes são
  estruturais/de contrato — parseiam o YAML via `js-yaml` e afirmam sobre a estrutura (mesmo padrão da
  Story 11.2, que introduziu `js-yaml` como devDependency declarada). Isso é esperado e correto.
- **Parsing YAML via `js-yaml`:** `js-yaml` já está em `devDependencies` (adicionado na Story 11.2 QA).
  Reusar `js-yaml.load()` para parse semântico real dos dois YAMLs, em vez de só regex — fecha o mesmo
  gap que foi deferido/depois resolvido na Story 11.2.
  - **Atenção YAML `on`:** em YAML 1.1 (que o `js-yaml` implementa), a chave nua `on` pode ser
    interpretada como booleano `true`. Ao afirmar sobre o trigger, considerar que a chave parseada pode
    vir como `true` (booleano) e não a string `"on"` — testar de forma robusta (ex.: procurar a chave
    de trigger tolerando `true`/`"on"`), ou escrever a chave como `"on":` no YAML para forçar string.
- **Consumidores diretos:** Stories 11.4/11.5/11.6 adicionarão jobs `deploy-supabase`, `deploy-amplify`
  e `smoke-test` ao `production.yml`, todos encadeados via `needs:` a partir de `tests`. Esta story só
  entrega a base (`tests`) — não implementa os jobs de deploy.
- **Baseline de testes pré-existente (não relacionado):** o working tree tem 2 falhas pré-existentes em
  `tests/unit/story-1-5/` e `tests/unit/story-1-6/` (Epic 1, `window.location.href` vs `router.push`).
  Elas estão **fora do escopo** desta story e não devem ser tocadas. O critério de "0 falhas novas"
  refere-se a nenhuma regressão introduzida pela Story 11.3.

### Project Structure Notes

- Arquivo novo: `.github/jobs/tests/action.yml` — primeiro composite action da pipeline distribuída;
  `.github/` não existia antes desta story.
- Arquivo novo: `.github/workflows/production.yml` — orquestrador base do release na branch `prod`.
- Arquivo novo: `tests/unit/story-11-3/workflow-job-tests.test.mjs` — segue a convenção
  `tests/unit/story-{epic}-{story}/` de todas as stories anteriores.
- Arquivo modificado: `package.json` — novo script `test:story:11.3`.
- Nenhuma alteração em `src/`, `app/`, `middleware.ts`, schema do banco, ou qualquer módulo de domínio.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#4-D] — estrutura
  distribuída da pipeline (composite actions em `.github/jobs/<nome>/action.yml`, orquestrados por
  `production.yml`); trade-off de secrets via `with:`.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md (tabela §4-C, linha
  Story 11.3)] — contrato exato: "`.github/jobs/tests/action.yml` (Node 22 → `npm ci` → `npm test`) +
  `production.yml` com trigger em `prod` e job `tests`".
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#Seção 5, risco 1] —
  Node 22 obrigatório: `node --test "tests/unit/**/*.test.mjs"` só expande `**` a partir do Node 21+.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 11: Pipeline de CI/CD de Produção] — descrição
  do épico e estrutura distribuída dos jobs.
- [Source: _bmad-output/implementation-artifacts/stories/11-2-amplify-yml-e-desabilitar-auto-build.md] —
  story anterior do mesmo épico: convenção de testes estruturais com parse YAML real via `js-yaml`,
  formato do arquivo de story e profundidade das Dev Notes.
- [Source: package.json] — comando de teste (`node --test "tests/unit/**/*.test.mjs" && npm run
  test:dynamic`), `js-yaml` já como devDependency, `engines.node: ">=18"`.

## Change Log

- 2026-08-09: Story criada via `bmad-create-story`. Status → ready-for-dev.
- 2026-08-09: Implementação completa — `.github/jobs/tests/action.yml` (composite, Node 22),
  `.github/workflows/production.yml` (trigger `prod` + job `tests`) e 15 testes estruturais novos
  (parse real via `js-yaml`). Suíte completa 707 síncronos + 14 dinâmicos, 0 falhas. Status → review.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor inline) — 0
  decision-needed, 1 patch (aplicado: `permissions: contents: read` least-privilege em
  `production.yml`), 1 defer (SHA pinning de actions → Story 11.7, registrado em `deferred-work.md`),
  1 dismiss (teste AC5 base-mínima é intencional). Suíte após patch: 708 síncronos + 14 dinâmicos, 0
  falhas; 16 testes na story. Status → test.
- 2026-08-09: QA adicionou `tests/unit/story-11-3/pipeline-node-version-contract.test.mjs` (7 testes)
  ligando a escolha de Node 22 ao motivo real (glob `**` do script `npm test` exige Node 21+, prova
  numérica `>= 21`), ordem dos steps do composite, `npm ci` (não `npm install`) e pinning de actions.
  Suíte completa: 715 síncronos + 14 dinâmicos, 0 falhas; 23 testes na story (16 dev + 7 QA). Status → done.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run test:story:11.3`: 15 passed / 0 failed.
- `npm test` (suíte completa): 707 passed / 0 failed (síncrono) + 14 passed / 0 failed (dinâmico).
  Observação: as 2 falhas pré-existentes de Story 1.5/1.6 citadas nas stories 11.1/11.2 não aparecem
  mais — os testes daquelas stories já foram atualizados no working tree (mudanças não commitadas,
  fora do escopo desta story e não tocadas por ela).

### Completion Notes List

- `.github/jobs/tests/action.yml` criado — primeiro composite action da pipeline distribuída (`.github/`
  não existia). `runs.using: composite`, step `actions/setup-node@v4` fixando `node-version: "22"`
  (risco crítico §5.1 — Node 18/20 coletaria zero testes pelo glob `**`), steps `npm ci` e `npm test`,
  ambos com `shell: bash` (exigência de composite actions). `cache: npm` no setup-node para acelerar.
- `.github/workflows/production.yml` criado — orquestrador base. Trigger `on.push.branches: [prod]`
  (chave `"on"` entre aspas para evitar coerção YAML 1.1 → booleano). Job único `tests` em
  `ubuntu-latest` com `actions/checkout@v4` ANTES de `uses: ./.github/jobs/tests` (composite local só
  resolve após checkout). Base mínima: apenas o job `tests`; jobs de deploy virão via `needs: tests`
  nas Stories 11.4/11.5/11.6.
- Testes estruturais em `tests/unit/story-11-3/workflow-job-tests.test.mjs` (15 testes) fazendo parse
  real dos dois YAMLs via `js-yaml.load()` — cobrem os 5 ACs, incluindo asserção explícita de que
  `node-version` começa com `22` e NÃO é 18 nem 20 (regressão do §5.1).
- Script `test:story:11.3` adicionado a `package.json`.
- Não há execução real de GitHub Actions no sandbox — testes são de contrato/estruturais, conforme
  esperado e alinhado à Story 11.2.

### File List

- `.github/jobs/tests/action.yml` (novo — dev-story)
- `.github/workflows/production.yml` (novo — dev-story; `permissions: contents: read` adicionado no code review)
- `tests/unit/story-11-3/workflow-job-tests.test.mjs` (novo — dev-story; 1 teste de permissions adicionado no code review)
- `tests/unit/story-11-3/pipeline-node-version-contract.test.mjs` (novo — QA; 7 testes de contrato Node/§5.1 + ordem/pinning)
- `package.json` (modificado — novo script `test:story:11.3`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificado — 1 item deferido do code review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (modificado — seção Story 11.3 — QA)
