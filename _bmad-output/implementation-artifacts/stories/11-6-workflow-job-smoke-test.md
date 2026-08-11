# Story 11.6: Composite `smoke-test` + Job Encadeado (Gate Final da Pipeline)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Nota de contexto:** sexta e última story do fluxo de release do Epic 11 (Pipeline de CI/CD de
> Produção, Sprint Change 2026-08-08). As Stories 11.1 (`GET /api/health`), 11.2 (`amplify.yml` +
> desabilitar auto-build), 11.3 (composite `tests` + orquestrador base `production.yml`), 11.4
> (composite `deploy-supabase` + job `needs: tests`) e 11.5 (composite `deploy-amplify` + job
> `needs: deploy-supabase`) já estão `done`. Esta story adiciona o **quarto e último composite action**
> da pipeline distribuída (`.github/jobs/smoke-test/action.yml`) e **encadeia** o job `smoke-test` no
> `production.yml` com **`needs: deploy-amplify`** — ou seja, a validação pós-deploy só roda **depois**
> que o app for publicado no Amplify com sucesso (Story 11.5). Com isso a cadeia completa fica
> `tests → deploy-supabase → deploy-amplify → smoke-test`.
>
> **Estrutura distribuída (§4-D da proposta):** cada job vive em `.github/jobs/<nome>/action.yml`
> como **composite action** (reusable workflows do GitHub só podem ficar em `.github/workflows/`;
> composite actions podem morar em qualquer pasta e são chamados por `uses: ./.github/jobs/<nome>`).
> O `production.yml` é fino: apenas orquestra os composites. O composite `smoke-test` **não consome
> secrets sensíveis** de credenciais, mas recebe a **`PRODUCTION_URL`** via `with:` (input) a partir
> do orquestrador (de um secret ou variable) — **nunca hardcoded**.
>
> **Consome a Story 11.1:** o smoke-test valida o endpoint público `GET /api/health` entregue pela
> Story 11.1 (`app/api/health/route.ts` → HTTP 200 `{status:"ok"}`, `force-dynamic`, sem DB/secrets,
> já `done` nesta branch e liberado como rota pública no middleware).
>
> **Estado encontrado na codebase:** `.github/workflows/production.yml` já contém os jobs `tests`
> (11.3), `deploy-supabase` (11.4) e `deploy-amplify` (11.5); `.github/jobs/tests/`,
> `.github/jobs/deploy-supabase/` e `.github/jobs/deploy-amplify/` já existem. Esta story ESTENDE
> `production.yml` (adiciona o job final `smoke-test`) e ADICIONA o diretório novo
> `.github/jobs/smoke-test/`. GitHub Actions e HTTP contra produção **não** rodam no sandbox — os
> testes são estruturais/de contrato (parse YAML via `js-yaml`), mesmo padrão das Stories
> 11.2/11.3/11.4/11.5.

## Story

Como pipeline de CI/CD de produção (Epic 11, orquestrada pelo GitHub Actions na branch `prod`),
Quero um composite action `smoke-test` reutilizável (`.github/jobs/smoke-test/action.yml`) que faça
`GET $PRODUCTION_URL/api/health` com **retries finitos** (timeout / número máximo de tentativas),
considere sucesso apenas em **HTTP 200** (opcionalmente validando o corpo `{status:"ok"}`) e **falhe
explicitamente** ao esgotar as tentativas — nunca um loop infinito —, além de um job `smoke-test` no
orquestrador `production.yml` que rode com **`needs: deploy-amplify`**,
Para que cada release seja validado end-to-end: a aplicação recém-publicada no Amplify só é
considerada no ar depois que o health check responder 200, fechando a cadeia
`tests → deploy-supabase → deploy-amplify → smoke-test` como gate final e determinístico, sem
hardcodear a URL de produção.

## Acceptance Criteria

1. **Given** o repositório do projeto
   **When** o arquivo `.github/jobs/smoke-test/action.yml` é inspecionado
   **Then** ele existe, é YAML válido, e é um **composite action** — contém `runs.using: "composite"`
   e uma lista `runs.steps` não vazia

2. **Given** o composite action `smoke-test`
   **When** sua seção `inputs` é inspecionada
   **Then** ele declara um input `production-url` (a URL base de produção) marcado `required: true`,
   para que o orquestrador o passe via `with:` (**nunca hardcoded** no composite)

3. **Given** o composite action `smoke-test`
   **When** seus `runs.steps` são inspecionados
   **Then** existe um passo que executa `GET` contra `${production-url}/api/health` (ex.: via `curl`)
   — a URL vem do input, não literal
   **And** todo passo `run` declara `shell:` (obrigatório em composite actions)

4. **Given** o composite action `smoke-test` (§5.8 CRÍTICO — retries finitos)
   **When** o passo de smoke-test é inspecionado
   **Then** o `GET /api/health` é repetido com **retries** que têm **timeout / número máximo de
   tentativas** (loop finito, nunca infinito — sem `while true`)
   **And** o passo **falha explicitamente** (exit não-zero) ao esgotar as tentativas sem sucesso

5. **Given** o composite action `smoke-test` (critério de sucesso §6)
   **When** a resposta do health check é avaliada
   **Then** o sucesso é definido por **HTTP 200** (ex.: checando o status code do `curl`)
   **And** opcionalmente o corpo é validado como `{status:"ok"}`

6. **Given** o composite action `smoke-test` (§4-D — sem hardcode)
   **When** o texto bruto do YAML é inspecionado
   **Then** **nenhuma URL de produção literal** aparece hardcoded (nenhum `https://...` fixo como
   alvo do health check); o alvo vem exclusivamente do input (`${{ inputs.production-url }}`)

7. **Given** o workflow `production.yml`
   **When** a seção `jobs` é inspecionada
   **Then** existe um job `smoke-test` que roda em `runs-on: ubuntu-latest`, declara
   **`needs: deploy-amplify`** (gate final após a Story 11.5), faz checkout do código
   (`actions/checkout`) e chama o composite via `uses: ./.github/jobs/smoke-test`
   **And** o job passa a `production-url` ao composite via `with:` referenciando `${{ secrets.* }}`
   ou `${{ vars.* }}` (nunca literal) — a URL fica centralizada no orquestrador

8. **Given** o workflow `production.yml`
   **When** o encadeamento dos jobs é inspecionado
   **Then** os jobs `tests` (11.3), `deploy-supabase` (11.4) e `deploy-amplify` (11.5) permanecem
   intactos e nesta ordem, e o job `smoke-test` só executa após `deploy-amplify` passar (via
   `needs: deploy-amplify`), formando a cadeia completa
   `tests → deploy-supabase → deploy-amplify → smoke-test`
   **And** os únicos jobs em `production.yml` são exatamente `tests`, `deploy-supabase`,
   `deploy-amplify` e `smoke-test`

## Tasks / Subtasks

- [x] Task 1: Criar o composite action `.github/jobs/smoke-test/action.yml` (AC: #1, #2, #3, #4, #5, #6)
  - [x] Definir `name` e `description` do composite (documentar §5.8 e o consumo da Story 11.1 em comentários)
  - [x] Declarar `inputs`: `production-url` (required), com `description` (passado via `${{ secrets.* }}`/`${{ vars.* }}`)
  - [x] Definir `runs.using: "composite"`
  - [x] Passo de smoke-test (`shell: bash`): loop com `max_attempts`/timeout chamando
    `curl` contra `$PRODUCTION_URL/api/health`; sucesso = HTTP 200 (checar status code via
    `-w '%{http_code}'`); reforço: validar corpo `{status:"ok"}`.
    A URL vem de `env:` a partir do input. Entre tentativas, `sleep`. Ao esgotar → `exit 1`.
  - [x] Garantir que NENHUMA URL de produção literal aparece; alvo via `${{ inputs.production-url }}` / `env:`
  - [x] Validar que o YAML é sintaticamente válido e tem `runs.using == "composite"`

- [x] Task 2: Encadear o job `smoke-test` no `.github/workflows/production.yml` (AC: #7, #8)
  - [x] Adicionar job `smoke-test` com `runs-on: ubuntu-latest` e `needs: deploy-amplify`
  - [x] Passo `uses: actions/checkout@v4` (necessário para resolver o composite local)
  - [x] Passo `uses: ./.github/jobs/smoke-test` com bloco `with:` passando `production-url` a partir de
    `${{ secrets.PRODUCTION_URL }}`
  - [x] Manter os jobs `tests`, `deploy-supabase` e `deploy-amplify` intactos (não regredir 11.3/11.4/11.5)
  - [x] Confirmar que o bloco `permissions` do workflow continua least-privilege (`contents: read`)
  - [x] Atualizar os comentários de cabeçalho do `production.yml` para refletir a cadeia completa

- [x] Task 3: Criar testes estruturais/de contrato em `tests/unit/story-11-6/` (AC: #1–#8)
  - [x] Criar `tests/unit/story-11-6/workflow-job-smoke-test.test.mjs` com **parse real via `js-yaml`**
  - [x] Testar que `.github/jobs/smoke-test/action.yml` existe, parseia, e tem `runs.using == "composite"`
  - [x] Testar o input `production-url` com `required: true`
  - [x] Testar que o smoke-test faz `GET .../api/health` (via `curl`) e que todo `run` tem `shell`
  - [x] **Testar os retries finitos** (§5.8): loop com timeout/max attempts (sem `while true`) e falha
    explícita (`exit 1`) ao esgotar as tentativas
  - [x] Testar o critério de sucesso HTTP 200 (checagem de status code)
  - [x] Testar que NENHUMA URL de produção literal aparece no YAML bruto; alvo vem de `${{ inputs.production-url }}`
  - [x] Testar o job `smoke-test` com `needs: deploy-amplify`, `ubuntu-latest`, checkout antes do
    composite, `uses` do composite e `with:` referenciando `${{ secrets.* }}`/`${{ vars.* }}` (não literal)
  - [x] Testar que os jobs de `production.yml` são exatamente `tests`, `deploy-supabase`, `deploy-amplify` e `smoke-test`
  - [x] Adicionar script `test:story:11.6` em `package.json`
  - [x] **Atualizar o teste do conjunto de jobs das Stories 11.5 e 11.4** para incluir `smoke-test`:
    tanto `workflow-job-deploy-amplify.test.mjs` (AC8, 11.5) quanto
    `workflow-job-deploy-supabase.test.mjs` (AC7, 11.4) travavam a contagem EXATA de jobs via
    `deepEqual`; ambos foram relaxados para verificação de presença (o conjunto exato passa a ser
    validado pelo teste da 11.6). Análogo ao ajuste que a 11.5 fez sobre a 11.4 e a 11.4 sobre a 11.3;
    são os únicos arquivos de outras stories que esta story tocou, e apenas por este motivo documentado.
  - [x] Rodar `npm test` e confirmar 0 falhas novas

### Review Findings

Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline — diff pequeno de infra
YAML + testes de contrato, mesmo padrão da 11.5). 0 decision-needed, 0 patch, 2 defer, 1 dismiss.
Acceptance Auditor: os 8 ACs estão implementados e cobertos por testes (composite `smoke-test`,
`production-url` required, `GET /api/health` via input, retries finitos sem `while true` + `exit 1` ao
esgotar, sucesso HTTP 200 `{status:"ok"}`, sem URL hardcoded, `needs: deploy-amplify`, cadeia completa
de 4 jobs). Blind Hunter: nenhum bug de correção — o `if response="$(curl ...)"` neutraliza o `set -e`
nas falhas de rede, `--max-time` impede travar numa requisição, `tail -n1`/`sed '$d'` separam corpo e
status corretamente; nenhum vazamento de secret. Suíte após review: 801 sync + 14 dinâmicos, 0 falhas
(nenhum patch aplicado — nada a re-testar).

- [x] [Review][Defer] `actions/checkout@v4` pinada por tag de major (não SHA) no job `smoke-test`
  [.github/workflows/production.yml] — versão não determinística entre releases; deferido para a Story
  11.7 (hardening operacional), consistente com os defers de SHA-pinning registrados nas Stories
  11.3/11.4/11.5.
- [x] [Review][Defer] O smoke-test retenta uniformemente qualquer falha e, se `production-url` vier
  vazio/malformado, apenas falha após esgotar as 30 tentativas sem uma mensagem dedicada
  [.github/jobs/smoke-test/action.yml] — fail-fast aceitável (input `required`), mas uma validação
  explícita da URL / distinção de erro transitório vs. app indisponível facilitaria o diagnóstico no
  primeiro release real. Deferido para o hardening da Story 11.7.

## Dev Notes

- **Escopo estritamente de infraestrutura de CI, sem código de aplicação.** Como as Stories 11.1–11.5,
  esta story não toca `src/modules/*`, `application/usecases/`, nem camadas controller/presenter/
  viewmodel. Entrega um novo composite YAML, estende o `production.yml` e adiciona testes estruturais.
  Não altera schema do banco, `amplify.yml` (Story 11.2), `environments.ts`, nem `app/api/health/route.ts`
  (Story 11.1, já `done`) — apenas o **consome** via HTTP.
- **§5.8 CRÍTICO — retries FINITOS (propriedade-chave desta story):** o smoke-test DEVE ter timeout /
  máximo de tentativas e falhar explicitamente (exit não-zero) ao esgotar as tentativas sem obter HTTP
  200 — **nunca** um `while true` sem saída. O health check pode demorar a ficar disponível logo após o
  deploy (cold start / propagação), daí os retries com `sleep` entre tentativas; mas o limite é finito.
- **§6 — critério de sucesso:** `GET $PRODUCTION_URL/api/health` retorna **HTTP 200** `{status:"ok"}`.
  O sucesso mínimo é o status code 200; a validação do corpo `{status:"ok"}` é um reforço opcional.
  O smoke-test só roda após o Amplify `SUCCEED` (garantido por `needs: deploy-amplify`), então o app
  já deve estar publicado.
- **Story 11.1 (endpoint consumido):** `app/api/health/route.ts` responde `{status:"ok"}` com HTTP 200,
  `dynamic = "force-dynamic"`, `Cache-Control: no-store`, sem consultar o banco nem expor secrets; foi
  liberado como rota pública no middleware. É exatamente o alvo do smoke-test.
- **§4-D — `PRODUCTION_URL` via `with:` (nunca hardcoded):** diferente dos composites `deploy-supabase`
  (11.4) e `deploy-amplify` (11.5), o smoke-test não precisa de credenciais sensíveis, mas a URL de
  produção **não** deve ser hardcodeada — vem como `input` (`production-url`, required) passado pelo
  orquestrador via `with:` a partir de `${{ secrets.PRODUCTION_URL }}` ou `${{ vars.PRODUCTION_URL }}`.
- **`curl` no runner:** `curl` já vem pré-instalado no `ubuntu-latest`. Padrão para checar status code:
  `code="$(curl -s -o /dev/null -w '%{http_code}' "$PRODUCTION_URL/api/health")"` e comparar com `200`;
  ou `curl --fail --silent --show-error` dentro do loop de retry. Para validar o corpo, capturar a
  resposta e casar `{"status":"ok"}` (tolerando espaços) — opcional.
- **`needs: deploy-amplify` (AC #7):** o smoke-test é o passo de validação que vem DEPOIS do deploy do
  app (§4-B/NFR11: `tests → deploy-supabase → deploy-amplify → smoke-test`). Encadeamento via `needs`
  garante que o Amplify já tenha atingido `SUCCEED` (Story 11.5) antes de qualquer requisição.
- **Checkout obrigatório antes do composite local:** como nas Stories 11.3/11.4/11.5, um composite
  action local (`uses: ./.github/jobs/smoke-test`) só resolve **após** `actions/checkout`.
- **`shell:` obrigatório em composite:** todo step `run` dentro de um composite action DEVE declarar
  `shell:` (ex.: `bash`), senão o GitHub Actions rejeita o action em runtime.
- **Sem execução real do workflow no sandbox:** GitHub Actions e HTTP contra produção não rodam no
  sandbox. Os testes são estruturais/de contrato — parseiam o YAML via `js-yaml` e afirmam sobre a
  estrutura, os retries finitos e o critério HTTP 200. Esperado e correto (mesmo padrão das Stories
  11.2/11.3/11.4/11.5).
- **Parsing YAML via `js-yaml`:** já é devDependency. Reusar `yaml.load()`. Atenção: a chave nua `on`
  do workflow pode virar booleano `true` em YAML 1.1 — tolerar `doc.on ?? doc[true]` como nas 11.3–11.5.
- **Contrato do teste AC8 da Story 11.5 muda AGORA:** a 11.5 afirma
  `deepEqual(jobKeys, ["deploy-amplify", "deploy-supabase", "tests"])`. Ao adicionar `smoke-test`, esse
  teste quebra; atualizá-lo para incluir `smoke-test` (mantendo a intenção: agora a cadeia está
  completa). Este é o único arquivo de outra story que esta story pode tocar, e apenas por esse motivo
  documentado — análogo ao ajuste que a 11.5 fez no teste AC8 da 11.4.
- **Baseline de testes pré-existente (não relacionado):** eventuais falhas pré-existentes em Epic 1
  (Stories 1.5/1.6) estão fora de escopo e não devem ser tocadas. "0 falhas novas" = nenhuma regressão
  introduzida por esta story.

### Project Structure Notes

- Arquivo novo: `.github/jobs/smoke-test/action.yml` — quarto e último composite action da pipeline
  distribuída; recebe `production-url` via `input` (sem credenciais sensíveis).
- Arquivo modificado: `.github/workflows/production.yml` — adiciona o job `smoke-test`
  (`needs: deploy-amplify`); jobs `tests`, `deploy-supabase` e `deploy-amplify` permanecem intactos.
- Arquivo novo: `tests/unit/story-11-6/workflow-job-smoke-test.test.mjs` — segue a convenção
  `tests/unit/story-{epic}-{story}/` de todas as stories anteriores.
- Arquivo modificado: `package.json` — novo script `test:story:11.6`.
- Arquivo modificado: `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` — ajuste do teste
  AC8 (`jobKeys` agora inclui `smoke-test`), conforme documentado acima.
- Nenhuma alteração em `src/`, `app/`, `middleware.ts`, `amplify.yml`, `supabase/migrations/`, ou
  qualquer módulo de domínio.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md (tabela §4-D, linha
  Story 11.6)] — contrato exato: "`.github/jobs/smoke-test/action.yml` (`GET $PRODUCTION_URL/api/health`
  com retries); job (needs: deploy-amplify)".
- [Source: sprint-change-proposal-2026-08-08.md#Seção 5, risco 8 (§5.8)] — polling/retries finitos com
  timeout/max tentativas; falha explícita ao não obter sucesso (sem loop infinito).
- [Source: sprint-change-proposal-2026-08-08.md#Seção 6, critérios de sucesso] — `GET /api/health`
  retorna 200 `{status:"ok"}`; smoke-test só após Amplify `SUCCEED`.
- [Source: sprint-change-proposal-2026-08-08.md#4-B, #4-C, #4-D] — sequência de gates
  `tests → deploy-supabase → deploy-amplify → smoke-test`; estrutura distribuída em `.github/jobs/`.
- [Source: _bmad-output/implementation-artifacts/stories/11-5-workflow-job-deploy-amplify.md] — story
  anterior do mesmo épico: padrão de composite, polling finito, convenção de testes via `js-yaml`, e o
  precedente de atualizar o teste `jobKeys` da story anterior.
- [Source: .github/workflows/production.yml] — orquestrador existente (jobs `tests` + `deploy-supabase`
  + `deploy-amplify` + `permissions`) a ser estendido.
- [Source: .github/jobs/deploy-amplify/action.yml] — padrão de composite (polling finito com
  `max_attempts`/`sleep`) a ser seguido.
- [Source: app/api/health/route.ts] — endpoint alvo do smoke-test (Story 11.1): HTTP 200 `{status:"ok"}`.
- [Source: package.json] — comando de teste, `js-yaml` como devDependency, convenção `test:story:*`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run test:story:11.6`: 20 passed / 0 failed.
- `npm run test:story:11.5` (regressão do ajuste AC8): 36 passed / 0 failed.
- `npm run test:story:11.4` (regressão do ajuste AC7): confirmada verde na suíte completa.
- `npm test` (suíte completa): 801 passed / 0 failed (síncrono) + 14 passed / 0 failed (dinâmico).

### Completion Notes List

- `.github/jobs/smoke-test/action.yml` criado — quarto e último composite action da pipeline.
  Declara o input `production-url` (`required: true`). Único step (`shell: bash`): loop finito
  (30×10s = 5 min) que faz `curl -sS --max-time 15 -w '%{http_code}'` contra `$PRODUCTION_URL/api/health`;
  sucesso = HTTP 200 **e** corpo casando `{status:"ok"}` (reforço); a cada tentativa sem sucesso faz
  `sleep`; ao esgotar as tentativas → `::error::` + `exit 1`. A URL vem de `env:` a partir do input
  (barra final normalizada com `${PRODUCTION_URL%/}`), nunca hardcoded.
- **§5.8 (retries finitos):** loop com `max_attempts`/`sleep` e falha explícita (`exit 1`) ao esgotar;
  guardrail de teste garante ausência de `while true`. `--max-time` também impede uma requisição travar.
- **§6 (critério de sucesso):** status HTTP 200 é o critério mínimo (lido via `-w '%{http_code}'`); o
  corpo `{status:"ok"}` é validado como reforço para não aprovar um health degradado.
- **Consome a Story 11.1:** valida `GET /api/health` (endpoint público já `done`), sem tocar no código.
- `.github/workflows/production.yml` estendido — novo job final `smoke-test` (`runs-on: ubuntu-latest`,
  `needs: deploy-amplify`), com `actions/checkout@v4` ANTES de `uses: ./.github/jobs/smoke-test`. A
  `production-url` é centralizada no orquestrador e passada via `with:` a partir de
  `${{ secrets.PRODUCTION_URL }}`. Jobs `tests`/`deploy-supabase`/`deploy-amplify` intactos;
  `permissions: contents: read` mantido. Comentários de cabeçalho atualizados para a cadeia completa.
- Testes das Stories 11.5 (AC8) e 11.4 (AC7) atualizados: ambos travavam a contagem EXATA de jobs via
  `deepEqual`; relaxados para verificação de presença. O conjunto EXATO de 4 jobs
  (`tests`, `deploy-supabase`, `deploy-amplify`, `smoke-test`) passa a ser validado pelo teste da 11.6.
- Sem execução real de GitHub Actions/HTTP no sandbox — testes de contrato/estruturais, esperado
  (mesmo padrão das Stories 11.2/11.3/11.4/11.5).

### File List

- `.github/jobs/smoke-test/action.yml` (novo — dev-story)
- `.github/workflows/production.yml` (modificado — dev-story; job `smoke-test` encadeado + comentários)
- `tests/unit/story-11-6/workflow-job-smoke-test.test.mjs` (novo — dev-story; 20 testes)
- `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` (modificado — ajuste do teste AC8)
- `tests/unit/story-11-4/workflow-job-deploy-supabase.test.mjs` (modificado — ajuste do teste AC7)
- `package.json` (modificado — novo script `test:story:11.6`)
- `tests/unit/story-11-6/smoke-test-contract.test.mjs` (novo — QA; 13 testes de contrato)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificado — 2 itens deferidos do code review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (modificado — seção Story 11.6 — QA)

## Change Log

- 2026-08-09: Story criada via `bmad-create-story`. Status → ready-for-dev.
- 2026-08-09: Implementação completa — `.github/jobs/smoke-test/action.yml` (composite: `curl` a
  `$PRODUCTION_URL/api/health` com retries finitos, sucesso = HTTP 200 `{status:"ok"}`, falha explícita
  ao esgotar), job final `smoke-test` (`needs: deploy-amplify`) em `production.yml` fechando a cadeia
  `tests → deploy-supabase → deploy-amplify → smoke-test`, 20 testes estruturais novos (parse real via
  `js-yaml`) e ajuste dos testes de conjunto de jobs das Stories 11.5/11.4. Suíte completa 801 sync +
  14 dinâmicos, 0 falhas. Status → review.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, inline) — 0
  decision-needed, 0 patch, 2 defer (SHA-pinning do `actions/checkout` no job smoke-test; validação da
  URL / distinção de erro transitório no retry → Story 11.7, registrados em `deferred-work.md`), 1
  dismiss. Nenhum patch a aplicar; suíte permanece 801 sync + 14 dinâmicos, 0 falhas. Status → test.
- 2026-08-09: QA adicionou `tests/unit/story-11-6/smoke-test-contract.test.mjs` (13 testes): fronteira
  de secrets (composite só usa `inputs.*`), alinhamento exato `with:`↔`inputs`, `needs` exatamente
  `[deploy-amplify]`, cadeia completa de `needs`, smoke-test como FOLHA, alvo exato `/api/health`,
  step único de smoke-test, `sleep` entre tentativas, `max_attempts` inteiro positivo finito, sem URL
  hardcoded e `permissions: contents: read`. Suíte da story: 33 testes (20 dev + 13 QA). Suíte
  completa: 814 síncronos + 14 dinâmicos, 0 falhas. `test-summary.md` atualizado. Status → done.
