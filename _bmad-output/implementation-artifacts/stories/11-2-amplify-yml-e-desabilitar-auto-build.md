# Story 11.2: amplify.yml e Desabilitar Auto-Build

Status: done

> **Nota de contexto:** segunda story do Epic 11 (Pipeline de CI/CD de Produção, Sprint Change
> 2026-08-08). A Story 11.1 criou o endpoint `GET /api/health`, consumido pelo gate `smoke-test`
> (Story 11.6, ainda `backlog`). Esta story é puramente infraestrutura de build/deploy — versiona
> a especificação de build do AWS Amplify (`amplify.yml`) no repositório e documenta a ação manual
> necessária para desabilitar o auto-build do Amplify na branch `prod`, preparando o terreno para
> a Story 11.5 (job de deploy via GitHub Actions) assumir o disparo de deploys em vez do Amplify
> fazê-lo automaticamente a cada push.

## Story

Como pipeline de CI/CD de produção (Epic 11, jobs de deploy das Stories 11.4/11.5),
Quero uma especificação de build (`amplify.yml`) versionada no repositório, correta para uma
aplicação Next.js SSR (Web Compute, não static export), e o auto-build do Amplify desabilitado na
branch `prod`,
Para que o Amplify apenas execute o build/deploy quando disparado explicitamente pelo workflow do
GitHub Actions (Story 11.5), em vez de reagir automaticamente a cada push — permitindo que testes
(Story 11.3) e migrations (Story 11.4) rodem e passem antes de qualquer deploy real acontecer.

## Acceptance Criteria

1. **Given** o repositório do projeto
   **When** o arquivo `amplify.yml` é inspecionado na raiz do projeto
   **Then** ele existe, é YAML válido, e define ao menos as fases `preBuild` (`npm ci`) e `build`
   (`npm run build`, equivalente a `next build`) sob `version: 1` com uma seção `frontend`

2. **Given** o `amplify.yml`
   **When** a seção `artifacts` é inspecionada
   **Then** `baseDirectory` está configurado como `.next` (Next.js Web Compute/SSR) — **nunca**
   `out` ou qualquer diretório de static export, pois a aplicação usa rotas de API, middleware de
   autenticação e SSR (`next.config.ts` não define `output: "export"`)

3. **Given** o `amplify.yml`
   **When** a seção `cache` é inspecionada
   **Then** `node_modules/**/*` está listado em `paths` para acelerar builds subsequentes (prática
   padrão de build spec do Amplify para projetos Node.js)

4. **Given** o AWS Amplify App conectado a este repositório (ambiente real, fora do escopo de
   execução automatizada desta story — sem acesso a credenciais AWS neste ambiente)
   **When** um desenvolvedor ou operador segue a documentação desta story
   **Then** existe documentação clara e localizável (novo arquivo em `docs/` ou seção em documento
   operacional existente) explicando **por que** e **como** desabilitar `enableAutoBuild` na branch
   `prod` do Amplify App — via Console AWS (toggle "Auto build" nas configurações de build da
   branch) ou via AWS CLI (`aws amplify update-branch --app-id <id> --branch-name prod
   --no-enable-auto-build`)

5. **Given** a documentação da Story 11.2
   **When** ela é lida em conjunto com o restante do Epic 11
   **Then** ela explicita a dependência: desabilitar o auto-build é um pré-requisito para a Story
   11.5 (job de deploy via GitHub Actions/Amplify CLI) funcionar como gate controlado — se o
   auto-build permanecer ativo, o Amplify fará deploy de qualquer push à branch `prod`
   independentemente do resultado dos jobs de teste (Story 11.3) e migration (Story 11.4) do
   pipeline, quebrando a garantia de "só publica se os testes passarem"

## Tasks / Subtasks

- [x] Task 1: Criar `amplify.yml` na raiz do projeto (AC: #1, #2, #3)
  - [x] Definir `version: 1`
  - [x] Seção `frontend.phases.preBuild.commands`: `npm ci`
  - [x] Seção `frontend.phases.build.commands`: `npm run build`
  - [x] Seção `frontend.artifacts.baseDirectory: .next`
  - [x] Seção `frontend.artifacts.files: - '**/*'`
  - [x] Seção `frontend.cache.paths: - node_modules/**/*`
  - [x] Validar que o YAML resultante é sintaticamente válido (validado via testes estruturais
    regex-sobre-source, sem introduzir `js-yaml` como dependência declarada — ver Dev Notes)

- [x] Task 2: Documentar a desabilitação do auto-build na branch `prod` (AC: #4, #5)
  - [x] Criar `docs/ops/amplify-deploy.md` (novo arquivo — `docs/ops/` não existia, diretório
    criado) explicando:
    - Por que o auto-build precisa ser desabilitado (a Story 11.5 assume o controle do disparo de
      deploy, gated pelos jobs de teste/migration das Stories 11.3/11.4)
    - Passo a passo via Console AWS (App settings → Branch settings → branch `prod` → desabilitar
      "Auto build")
    - Comando equivalente via AWS CLI: `aws amplify update-branch --app-id <APP_ID> --branch-name
      prod --no-enable-auto-build`
    - Nota explícita: esta é uma ação manual de configuração da infraestrutura AWS real: **não**
      foi executada por esta story (sem acesso a credenciais AWS neste ambiente de
      desenvolvimento/sandbox) — apenas documentada para execução posterior por quem tiver acesso
      ao Amplify App
  - [x] Referenciar a dependência com a Story 11.5 explicitamente no documento

### Review Findings

- [x] [Review][Patch] `artifacts.files: ['**/*']` sob `baseDirectory: .next` incluía `.next/cache/**`
  (webpack cache, potencialmente centenas de MB) no artefato de deploy sem exclusão — inflava
  tamanho/tempo de upload sem necessidade em runtime [amplify.yml] — corrigido: adicionado
  `artifacts.excludeFiles: [cache/**/*]` e `cache.paths` passou a incluir `.next/cache/**/*`
  (acelera builds subsequentes sem inflar o artefato publicado). Testes novos adicionados.
- [x] [Review][Patch] Comando AWS CLI de desabilitação do Auto Build não tinha checagem prévia de
  estado (risco de aplicar no App/branch errado, já que o `<APP_ID>` não é documentado em lugar
  nenhum do repo) nem comando de rollback documentado [docs/ops/amplify-deploy.md] — corrigido:
  adicionado passo `aws amplify get-branch --query 'branch.enableAutoBuild'` antes da mutação, e
  seção "Rollback" com o comando `--enable-auto-build` equivalente. Testes novos adicionados.
- [x] [Review][Patch] Teste de `cache.paths` usava regex sem âncora de início de linha
  (`-\s*node_modules\/\*\*\/\*` em vez de `^\s*-\s*node_modules\/\*\*\/\*\s*$`), o que faria a
  asserção passar mesmo se a linha estivesse comentada (`# - node_modules/**/*`), pois `#` não era
  excluído antes do `-` [tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs] —
  corrigido: regex agora ancorada com `^...$` multiline, garantindo que a linha é uma entrada YAML
  ativa, não um comentário.
- [x] [Review][Defer] Testes estruturais desta story usam regex/string-matching sobre o `amplify.yml`
  bruto em vez de um parser YAML real (`js-yaml` está presente apenas transitivamente em
  `node_modules`, não declarado em `package.json`) — o AC #1 ("YAML válido") é verificado por
  proximidade de texto, não por parse semântico real; uma reordenação de chaves ou inserção de uma
  fase `postBuild` legítima entre `build` e `artifacts` poderia, em tese, escapar da captura de
  regex sem quebrar o teste. Padrão sistêmico já estabelecido em todas as stories anteriores do
  projeto (nenhuma dependência de parsing YAML declarada); introduzir `js-yaml` como dependência
  nova para uma única story de config exigiria aprovação explícita do usuário (regra do dev-story:
  "novas dependências além do especificado na story precisam de aprovação") — fora do escopo desta
  execução autônoma. [tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs]
- [x] [Review][Defer] `docs/ops/amplify-deploy.md` documenta a desabilitação do Auto Build como
  ação manual, mas nada no repositório verifica automaticamente que a ação real foi executada na
  conta AWS de produção — o status "review"/"done" desta story reflete que o código/config foi
  autorado corretamente, não que o estado do Amplify App real foi alterado. Isto é uma limitação
  inerente ao escopo declarado da story (nenhuma credencial AWS neste ambiente de execução) e não
  um defeito de implementação; mitigado pela seção "Verificação" do documento, que descreve como
  confirmar o estado real após a ação manual ser executada por quem tiver acesso. Considerar, em
  story futura do Epic 11 (ex.: parte da Story 11.7, documentação operacional), adicionar esse item
  a um checklist de rollout de produção. [docs/ops/amplify-deploy.md]
- [x] [Review][Defer] O App Amplify real também precisa estar configurado como "Web Compute" (SSR)
  no nível do próprio App (não só via `amplify.yml`) — se o App tiver sido originalmente
  detectado/criado como site estático, o `baseDirectory: .next` textualmente correto não evita um
  404 em rotas SSR/middleware. O documento já menciona essa exigência na seção "Por que
  `baseDirectory: .next`", mas, diferente da desabilitação do Auto Build, não há passo a passo
  Console/CLI nem verificação dedicada para essa precondição — mesma classe de risco, tratamento
  assimétrico. Fora do escopo de execução desta story (também depende de acesso ao Amplify App
  real); considerar formalizar via story futura ou ampliar a seção existente do documento.
  [docs/ops/amplify-deploy.md]

- [x] Task 3: Criar testes automatizados estruturais em `tests/unit/story-11-2/` (AC: #1, #2, #3, #4, #5)
  - [x] Criar `tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs` seguindo o
    padrão estrutural das stories anteriores (leitura de arquivo fonte + `assert.match`/parse)
  - [x] Testar que `amplify.yml` existe e é YAML bem-formado
  - [x] Testar que `baseDirectory` é exatamente `.next` (não `out`)
  - [x] Testar que `preBuild.commands` contém `npm ci`
  - [x] Testar que `build.commands` contém `npm run build`
  - [x] Testar que `cache.paths` contém `node_modules/**/*`
  - [x] Testar que `docs/ops/amplify-deploy.md` existe e menciona `enableAutoBuild`/"Auto build" e
    a branch `prod`
  - [x] Rodar `npm test` e confirmar 0 falhas novas (baseline confirmado: 657 passam / 2 falhas
    pré-existentes e não relacionadas antes desta story; 690 passam / 2 falhas — as mesmas 2 —
    depois de dev-story + code review + QA; 33 testes novos nesta story ao todo, todos verdes —
    ver Dev Notes)

## Dev Notes

- **Escopo estritamente de infraestrutura de build/deploy, sem código de aplicação.** Assim como a
  Story 11.1, esta story não toca `src/modules/*`, `application/usecases/`, nem camadas
  controller/presenter/viewmodel. É um arquivo de configuração YAML (`amplify.yml`) + um documento
  operacional (`docs/ops/amplify-deploy.md`).
- **Por que `baseDirectory: .next` e não `out`:** o projeto usa App Router com rotas de API
  (`app/api/*`), middleware de autenticação (`src/shared/middleware.ts`/`proxy.ts`) e SSR — nenhuma
  dessas capacidades sobrevive a um `next export` (static export). `next.config.ts` não define
  `output: "export"`, confirmando que o projeto já assume SSR/Web Compute. Um `amplify.yml` com
  `baseDirectory: out` quebraria o deploy silenciosamente (Amplify serviria um build estático
  vazio/incompleto, sem as rotas de API funcionando) — este é o risco #5.2 citado na sprint change
  proposal do Epic 11.
- **Por que documentar em vez de executar a desabilitação do auto-build:** não há credenciais AWS
  neste ambiente de desenvolvimento/sandbox. A ação real (toggle no Console AWS ou `aws amplify
  update-branch --no-enable-auto-build`) deve ser executada manualmente por um operador com acesso
  ao Amplify App de produção. O critério de sucesso desta story é que a documentação exista, seja
  clara e correta — não que a chamada de API AWS tenha sido feita.
- **Sem testes de runtime do Amplify:** não há AWS Amplify CLI disponível neste ambiente. Os testes
  desta story são estruturais/de contrato: parsear o YAML e verificar chaves/valores esperados, e
  verificar que o documento de operações existe e menciona os termos certos — seguindo o mesmo
  padrão da Story 7.1 (`tests/unit/story-7-1/schema-baseline.test.mjs`, que testa existência/conteúdo
  de arquivo, não comportamento em runtime).
- **Parsing de YAML em teste:** verificar se `js-yaml` (ou similar) já está em `devDependencies`
  antes de adicioná-lo; se não estiver, usar `assert.match` com regex sobre o texto bruto do YAML
  é aceitável e consistente com o padrão de testes 100% estruturais/regex já estabelecido no
  projeto (ver Stories 5.7, 5.8, 9.1, 11.1) — não é obrigatório introduzir uma nova dependência
  apenas para parsear um YAML de 15-20 linhas.
- **Consumidor direto:** Story 11.5 (`Workflow job: deploy Amplify`, ainda `backlog`) usará este
  `amplify.yml` como a build spec real do Amplify App e dependerá do auto-build estar desabilitado
  para poder controlar o disparo do deploy via GitHub Actions. Esta story não implementa o job de
  CI de deploy — apenas prepara a configuração que ele vai consumir.
- **Baseline de testes pré-existente (não relacionado a esta story):** `npm test` no HEAD atual
  deste worktree reporta 657 passam / 2 falham. As 2 falhas (`tests/unit/story-1-5/signup-atomico.test.mjs`
  e `tests/unit/story-1-6/login-e-protecao-de-rotas.test.mjs`, ambas esperando `window.location.href`
  onde o código-fonte atual usa `router.push`) são pré-existentes no working tree, não introduzidas
  por esta story e fora do seu escopo (Epic 1, não Epic 11). O critério de "0 falhas" desta story
  refere-se a 0 falhas **novas** introduzidas pelo trabalho da Story 11.2 — a baseline de 2 falhas
  pré-existentes deve permanecer inalterada e não deve ser "corrigida" como parte desta story (fora
  de escopo; pertence a Epic 1).

### Project Structure Notes

- Arquivo novo: `amplify.yml` — raiz do projeto (convenção AWS Amplify: build spec sempre na raiz
  do repo, mesmo nível de `package.json`).
- Arquivo novo: `docs/ops/amplify-deploy.md` — novo diretório `docs/ops/` para documentação
  operacional/runbooks do Epic 11 (não existe ainda; `docs/` hoje só contém `project-context.md`
  e afins gerados pelo BMad).
- Arquivo novo: `tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs` — segue a
  convenção `tests/unit/story-{epic}-{story}/` de todas as stories anteriores.
- Nenhuma alteração em `src/`, `app/`, `middleware.ts`, schema do banco, ou qualquer módulo de
  domínio.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#4-C] — tabela de
  stories propostas do Epic 11, linha da Story 11.2: contrato exato ("`amplify.yml` versionado...
  documentar a necessidade de desabilitar `enableAutoBuild`").
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md#5.2] — risco "App é
  SSR": `amplify.yml` precisa ser Web Compute (`baseDirectory: .next`), não static export.
- [Source: _bmad-output/planning-artifacts/architecture.md#Infraestrutura & Deploy] — "Hospedagem:
  AWS Amplify" / "CI/CD: GitHub Actions (lint + typecheck) + Amplify (build + deploy automático)".
- [Source: _bmad-output/implementation-artifacts/stories/11-1-health-check-endpoint.md] — story
  anterior do mesmo épico, referência de formato, profundidade de Dev Notes e convenção de testes.
- [Source: next.config.ts] — confirma ausência de `output: "export"`, validando a necessidade de
  `baseDirectory: .next`.

## Change Log

- 2026-08-09: Story criada via `bmad-create-story`. Status → ready-for-dev.
- 2026-08-09: Implementação completa — `amplify.yml`, `docs/ops/amplify-deploy.md` e 18 testes
  estruturais novos criados. 0 regressões (baseline pré-existente de 2 falhas em Story 1.5/1.6
  inalterado). Status → review.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor inline) — 0
  decision-needed, 3 patch (aplicados: exclusão de `.next/cache` do artefato + cache dedicado,
  checagem de estado prévia + rollback no comando AWS CLI, regex de teste ancorada contra falso
  positivo em linha comentada), 3 defer (registrados em `deferred-work.md`). Suíte após patches:
  681 testes (679 passam / 2 falhas pré-existentes inalteradas), 22 testes na story (100% verdes).
  Status → test.
- 2026-08-09: QA adicionou `js-yaml` como devDependency (decisão deliberada, mesmo padrão do
  `tsx` na Story 5.8) e criou `tests/unit/story-11-2/amplify-yml-real-parse.test.mjs` (11 testes)
  fazendo parse real do `amplify.yml` via `js-yaml.load()` em vez de regex sobre texto — fecha o
  gap "testes estruturais usam regex, não parser YAML real" registrado no code review. Suíte
  completa: 692/692 (690 estáticos passam / 2 falhas pré-existentes inalteradas), 33 testes na
  story (100% verdes). Status → done.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npm run test:story:11.2`: 18 passed / 0 failed.
- `npm test` (suíte completa) ANTES desta story: 657 passed / 2 failed (síncrono) — baseline
  pré-existente, não relacionado (Story 1.5/1.6, `window.location.href` vs `router.push`).
- `npm test` (suíte completa) DEPOIS desta story: 675 passed / 2 failed (síncrono) — as mesmas 2
  falhas pré-existentes, 0 novas; +18 testes novos desta story, todos verdes.
- `npx tsc --noEmit`: sem erros.
- `npm run lint`: 6 erros / 12 warnings pré-existentes, nenhum em arquivos tocados por esta story
  (`amplify.yml`, `docs/ops/amplify-deploy.md`, `package.json`,
  `tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs`).

### Completion Notes List

- `amplify.yml` criado na raiz do projeto: `version: 1`, fases `preBuild` (`npm ci`) e `build`
  (`npm run build`, que mapeia para `next build` via `package.json`), `artifacts.baseDirectory:
  .next` (Next.js Web Compute/SSR — nunca `out`/static export, confirmado contra `next.config.ts`
  que não define `output: "export"`), `cache.paths` incluindo `node_modules/**/*`.
- `docs/ops/amplify-deploy.md` criado (novo diretório `docs/ops/`) documentando: por que
  `baseDirectory: .next`, por que desabilitar o Auto Build do Amplify na branch `prod` (evitar
  disparo de deploy concorrente com o pipeline do GitHub Actions das Stories 11.3–11.6), passo a
  passo via Console AWS e comando equivalente via AWS CLI (`aws amplify update-branch --app-id
  <APP_ID> --branch-name prod --no-enable-auto-build`), e a dependência explícita com a Story 11.5.
  Ação real de desabilitação **não executada** (sem credenciais AWS neste ambiente) — apenas
  documentada, conforme escopo da story.
- Testes estruturais criados em `tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs`
  (18 testes) cobrindo os 5 ACs via leitura de arquivo fonte + regex, sem depender de AWS Amplify
  CLI (indisponível neste ambiente) nem introduzir `js-yaml` como nova dependência declarada
  (estava presente apenas transitivamente em `node_modules`, não em `package.json`).
- Novo script `test:story:11.2` adicionado a `package.json`, seguindo a convenção de todas as
  stories anteriores.
- Regressão completa validada: 675 testes síncronos, 2 falhas (as mesmas 2 pré-existentes de
  Story 1.5/1.6, fora do escopo desta story — Epic 1, não Epic 11), 0 falhas dinâmicas novas.

### File List

- `amplify.yml` (novo — dev-story; ajustado no code review com `excludeFiles`/cache de `.next/cache`)
- `docs/ops/amplify-deploy.md` (novo — dev-story; ajustado no code review com checagem de estado
  prévia e comando de rollback)
- `tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs` (novo — dev-story; 4
  testes adicionados/ajustados no code review)
- `tests/unit/story-11-2/amplify-yml-real-parse.test.mjs` (novo — QA; 11 testes de parse YAML
  real via `js-yaml`, fecha gap deferido no code review)
- `package.json` (modificado — novo script `test:story:11.2` — dev-story; `js-yaml` adicionado
  como devDependency — QA)
- `package-lock.json` (modificado — `js-yaml` promovido de transitivo para direct devDependency —
  QA)
- `_bmad-output/implementation-artifacts/deferred-work.md` (3 itens deferidos do code review —
  code-review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (seção Story 11.2 — QA)
