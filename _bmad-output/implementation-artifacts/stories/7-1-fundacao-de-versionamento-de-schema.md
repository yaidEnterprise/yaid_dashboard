# Story 7.1: Fundação de Versionamento de Schema (Supabase Migrations + Baseline)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como desenvolvedor,
Quero versionar o schema via Supabase Migrations com um baseline fiel ao banco hoje deployado,
Para que toda mudança estrutural futura tenha um ponto único de verdade e o drift entre código e banco seja encerrado.

## Acceptance Criteria

1. **Given** o projeto sem o diretório `supabase/` versionado
   **When** a infraestrutura de migrations é inicializada (`supabase init` + `supabase link --project-ref lygkwhcwsrxfozswhxyo`)
   **Then** `supabase/config.toml` (com `project_id` definido), `supabase/migrations/` e `supabase/seed.sql` estão versionados no repositório
   **And** o `.gitignore` cobre `supabase/.branches` e `supabase/.temp`

2. **Given** o banco hoje deployado no project-ref remoto
   **When** o baseline é gerado (`supabase db pull`)
   **Then** a migration inicial captura **fielmente** o schema atual — incluindo o drift real (`proof_requests` com `validated_at`/`external_ref`/`result` e **sem** `updated_at`; `company_apps` com `environment`; `company` **sem** `can_create_apps`)
   **And** nenhuma coluna nova é adicionada nesta story — as forward migrations de colunas entram nas stories que as consomem (7.2, 7.3, 7.4)

3. **Given** o baseline aplicado em ambiente local
   **When** `supabase db reset` é executado
   **Then** o schema local é recriado idêntico ao remoto, sem erros

4. **Given** um Pull Request com mudança de schema (CI opcional configurada)
   **When** `supabase db diff --check` roda no PR
   **Then** divergências entre as migrations versionadas e o schema são detectadas antes do merge

> ⚠️ **Cuidado operacional:** o baseline precisa refletir fielmente o banco de produção **antes** de qualquer `db push`. Validar o diff manualmente antes do primeiro push remoto. Esta story **não faz `db push`** — só `link` + `db pull` (leitura) + `db reset` (local).

## Tasks / Subtasks

- [x] Task 0: Pré-requisito de credenciais — **BLOQUEADOR POTENCIAL** (AC: #1)
  - [x] Verificar se o Supabase CLI já está autenticado: `supabase projects list`. Inicialmente **não autenticado** (`LegacyPlatformAuthRequiredError`)
  - [x] Usuário rodou `supabase login` interativo (em vez de `SUPABASE_ACCESS_TOKEN` via env) — CLI autenticado com sucesso, token guardado no macOS Keychain (não em arquivo `~/.supabase/profile`)
  - [x] `supabase link --project-ref lygkwhcwsrxfozswhxyo` não pediu senha no momento do link, mas `db pull`/`db diff` exigiram a senha do Postgres explicitamente via `--password`. Usuário resetou a senha em Database → Settings (Studio) e adicionou `SUPABASE_DB_PASSWORD` ao `.env`
  - [x] `supabase db reset`/`start` precisam de Docker rodando localmente — confirmado disponível e usado com sucesso
  - [x] HALT foi acionado corretamente quando as credenciais faltavam; retomado após o usuário fornecer login + senha

- [x] Task 1: Inicializar infraestrutura de migrations (AC: #1)
  - [x] `supabase init` na raiz do projeto — criou `supabase/config.toml` e `supabase/.gitignore` (o CLI atual, 2.109.1, não cria `migrations/`/`seed.sql` automaticamente — criados manualmente abaixo)
  - [x] `supabase link --project-ref lygkwhcwsrxfozswhxyo` — vinculado com sucesso (ref gravado em `supabase/.temp/project-ref`, gitignored). `config.toml` manteve `project_id = "yaid_dashboard"` (identificador local do CLI, não o project-ref — comportamento padrão desta versão, não é o mesmo campo)
  - [x] `.gitignore` cobrindo `supabase/.branches` e `supabase/.temp`: **já vem gerado pelo próprio `supabase init`** em `supabase/.gitignore` (nested, 8 linhas incluindo entradas padrão de dotenvx do próprio template do CLI) — cobre as duas entradas exigidas pela AC entre outras já padrão do CLI; não precisou de edição manual no `.gitignore` raiz
  - [x] Criados manualmente: `supabase/migrations/` (inicialmente com `.gitkeep`, removido depois que a migration baseline real passou a ocupar o diretório na Task 2) e `supabase/seed.sql` (vazio), já que o `init` desta versão não os gera

- [x] Task 2: Gerar migration baseline fiel ao schema remoto (AC: #2)
  - [x] `supabase db pull --password "$SUPABASE_DB_PASSWORD"` — gerou `supabase/migrations/20260728015653_remote_schema.sql` a partir do schema real hoje deployado (precisou da senha do Postgres explicitamente — ver Debug Log)
  - [x] Nenhuma definição gerada foi editada manualmente
  - [x] Confirmado: **sem** `proof_request.updated_at`, **sem** `company.can_create_apps` — exatamente o drift esperado pelo AC2
  - [x] Diff revisado manualmente — ver achados em Dev Notes ("Drift real confirmado pelo pull")

- [x] Task 3: Validar baseline localmente (AC: #3)
  - [x] `supabase start` + `supabase db reset` — schema local recriado do zero a partir do baseline, sem erros
  - [x] `supabase db diff --schema public` logo após o reset retornou `"No schema changes found"` — confirma que o baseline é auto-consistente

- [x] Task 4: CI opcional de diff (AC: #4) — não bloqueante para o restante do épico
  - [x] Verificado: **não existe `.github/workflows/` no repositório** — o "GitHub Actions (lint + typecheck)" descrito em `architecture.md` linha 202 nunca foi de fato configurado (mais um ponto de drift documentação-vs-realidade). Criar um pipeline de CI do zero está fora do escopo desta story (é infraestrutura de migrations, não bootstrap de CI/CD)
  - [x] **AC4 NÃO atendida — deferida, não bloqueia a story**: a AC exige `supabase db diff --check` rodando em CI a cada PR, o que não existe (não há pipeline para anexar o step). `supabase db diff` foi demonstrado funcional manualmente nas Tasks 2/3, mas isso não substitui a checagem automática em PR que a AC pede. Quando um workflow de CI existir, adicionar o step com secret `SUPABASE_ACCESS_TOKEN`

- [x] Task 5: Criar testes estruturais (AC: todos)
  - [x] `tests/unit/story-7-1/schema-baseline.test.mjs` — 10 testes estruturais, padrão `node:test` + `readFileSync`/`readdirSync` + `assert`, sem banco real
  - [x] Cobertura: existência de `supabase/config.toml`/`migrations/`/`seed.sql`; `project_id` presente; `supabase/.gitignore` cobre `.branches`/`.temp`; baseline contém as 4 tabelas (nomes reais, incluindo `proof_request` singular); ausência de `updated_at`/`can_create_apps`; presença de `environment`
  - [x] Script `test:story:7.1` adicionado ao `package.json`

- [x] Task 6: Rodar testes e validar
  - [x] `npm run test:story:7.1` — 10/10 passando
  - [x] `npm run test` (suíte completa) — 560/560 passando, zero regressão
  - [x] `npm run lint` — 21 problemas pré-existentes em outras stories (nenhum nos arquivos desta story)

### Review Findings

- [x] [Review][Patch] `DROP EXTENSION pg_net;` sem `IF EXISTS` no baseline — falha se replayado num ambiente sem a extensão pg_net [supabase/migrations/20260728015653_remote_schema.sql:2] — corrigido, `IF EXISTS` adicionado; `db reset` revalidado sem erros
- [x] [Review][Patch] Story marca AC4 como "satisfeita por equivalência", mas a AC literal exige CI rodando `supabase db diff --check` em PR, que não existe — deveria ser marcada como não atendida/deferida, não como satisfeita [_bmad-output/implementation-artifacts/stories/7-1-fundacao-de-versionamento-de-schema.md] — corrigido, Task 4 agora declara explicitamente "AC4 NÃO atendida — deferida"
- [x] [Review][Patch] `findBaselineMigration()` pega `files[0]` de `readdirSync` sem `.sort()` — ordem não é garantida, e quebra quando a Story 7.2+ adicionar uma segunda migration ao diretório [tests/unit/story-7-1/schema-baseline.test.mjs:19-22] — corrigido, `.sort()` adicionado
- [x] [Review][Patch] Teste "baseline migration was not hand-written" não verifica proveniência — só repete asserts já cobertos por testes anteriores no mesmo arquivo, nome é enganoso [tests/unit/story-7-1/schema-baseline.test.mjs:107-111] — corrigido, renomeado para "baseline has no appended forward-migration statements anywhere in the file" com comentário explicando o escopo whole-file
- [x] [Review][Patch] Dev Notes/Task 1 afirmam que `supabase/.gitignore` cobre "exatamente" `.branches`/`.temp`, mas o arquivo gerado pelo CLI tem 8 linhas incluindo entradas dotenvx não relacionadas à AC1 [supabase/.gitignore] — corrigido, wording ajustado na Task 1
- [x] [Review][Patch] Nova credencial obrigatória `SUPABASE_DB_PASSWORD` não foi adicionada a `.env.local.example` — próximo desenvolvedor não descobre que precisa dela para `db pull`/`db push` [.env.local.example] — corrigido, entrada adicionada com comentário "CLI only"
- [x] [Review][Patch] `supabase/migrations/.gitkeep` commitado junto da migration real — o diretório não está mais vazio, placeholder é peso morto [supabase/migrations/.gitkeep] — corrigido, arquivo removido
- [x] [Review][Patch] "Project Structure Notes" da story afirma que `config.toml` contém `project_id = "lygkwhcwsrxfozswhxyo"` (o project-ref), mas o arquivo real tem `project_id = "yaid_dashboard"` — contradiz as próprias notas da Task 1 no mesmo documento [_bmad-output/implementation-artifacts/stories/7-1-fundacao-de-versionamento-de-schema.md] — corrigido, tabela atualizada com o valor real
- [x] [Review][Defer] Baseline captura grants amplos (`DELETE, INSERT, SELECT, UPDATE`) para `anon`/`authenticated` em todas as tabelas públicas, com RLS habilitado e zero políticas definidas [supabase/migrations/20260728015653_remote_schema.sql] — deferido, estado pré-existente no banco de produção (capturado fielmente, não introduzido por esta story); app usa service role key server-side, não depende de RLS hoje (architecture.md confirma "sem RLS no MVP"), mas vale uma story de governança dado o tema do Epic 7
- [x] [Review][Defer] `GRANT ALL ON FUNCTION public.rls_auto_enable()` estendido a `anon`/`authenticated`, permitindo `EXECUTE` direto numa função `SECURITY DEFINER` fora do contexto de trigger [supabase/migrations/20260728015653_remote_schema.sql] — deferido, estado pré-existente no banco de produção (artefato injetado pela própria plataforma Supabase), fora do escopo de uma story de captura de baseline

## Dev Notes

### O que esta story NÃO faz

- **Não adiciona colunas novas.** `updated_at` (proof_requests), `can_create_apps` (company) e qualquer ajuste em `company_apps.environment`/default entram como forward migrations nas Stories 7.2, 7.3 e 7.4 respectivamente — depois que o baseline existir.
- **Não faz `supabase db push`.** O baseline é gerado localmente a partir de leitura do remoto (`db pull`); o remoto já é a fonte, então não há nada para empurrar nesta story.
- **Não corrige o drift documentado em `architecture.md`.** O papel desta story é *capturar* o schema real como ele está hoje (com o drift), não fazer com que o banco bata com a documentação. A reconciliação vem nas stories seguintes.

### Drift conhecido a esperar no baseline (não é bug, é o ponto da story)

Confirmado lendo o código atual (`src/shared/infra/dto/*Mapper.ts`), o schema real diverge do documentado em `architecture.md` (que já descreve o **estado-alvo pós Sprint Change**, não o estado atual):

| Tabela | Coluna esperada no baseline (real, hoje) | O que `architecture.md` descreve (alvo, stories futuras) |
|---|---|---|
| `proof_requests` | `result`, `external_ref`, `validated_at` — **sem** `updated_at` | `external_reference`, `updated_at` (Story 7.2 adiciona) |
| `company` | sem `can_create_apps` | `can_create_apps BOOLEAN DEFAULT false` (Story 7.3 adiciona) |
| `company_apps` | tem `environment` (já existe, confirmado no mapper) | mesmo — sem mudança nesta área |

Adicionalmente, `CompanyAppMapper`/`CompanyApp` (entity) **não têm** um campo `app_id` (parte pública da API key) separado do `id` — diferente do que o bloco SQL ilustrativo em `architecture.md` (linha ~226) sugere. **Confie no que `supabase db pull` trouxer do banco real, não no bloco SQL do architecture.md** — esse bloco é a documentação do schema-alvo/aspiracional, os Mappers em `src/shared/infra/dto/` são a fonte mais confiável do que o código hoje espera, e `supabase db pull` é a fonte de verdade absoluta do que o banco realmente tem.

### Drift real confirmado pelo pull (achados além do previsto no AC2)

O `supabase db pull` (Task 2) confirmou os 3 pontos de drift acima **exatamente como esperado**, e revelou mais divergências entre `architecture.md`/`epics.md` e o banco real que vale documentar para as próximas stories:

- **A tabela é `proof_request` (singular)**, não `proof_requests` (plural) como em toda a documentação de planejamento. Já é assim no código: `SupabaseProofRequestRepository.ts` usa `const TABLE = "proof_request"`. Baseline captura o nome real.
- **`company_apps` não tem coluna `app_id`** separada (parte pública da API key) — confirma o que já era visível no `CompanyAppMapper`. A "API key" pública/privada é resolvida só por `id` + `api_key_hash`.
- **`proof_sessions` não tem `expires_at`** — diferente do que `architecture.md` descreve (`expires_at TIMESTAMPTZ NOT NULL`). O código já sabia disso: `ProofSessionMapper.ts:4` tem o comentário `"proof_sessions has no expires_at column; TTL is fixed and derived from created_at."` — a expiração é calculada em memória (`createdAt + SESSION_TTL_MS`), nunca persistida.
- **`proof_sessions` tem `opened_at` e `approved_at`**, não documentados em `architecture.md`, usados por `ProofSession` entity para o ciclo de vida da sessão.
- **`proof_request` não tem `return_url`** — confirma o `⚠️ TBD` do architecture.md; nunca foi implementado.
- `DROP EXTENSION pg_net;` aparece no início do baseline gerado — é o `db pull` reconciliando uma extensão presente na imagem-padrão do shadow DB mas ausente no remoto; comportamento esperado do CLI, não um erro.

Nenhum desses achados exige ação nesta story — são só confirmação de que o baseline capturou o real, e contexto útil para quem for mexer em `proof_sessions`/`proof_request`/`company_apps` nas próximas stories do épico.

### Ambiente e credenciais (leia antes de começar)

- Supabase CLI **2.109.1** já instalado no ambiente (`supabase --version`).
- **Não autenticado** no momento da criação desta story — `supabase projects list` retorna `LegacyPlatformAuthRequiredError`. É necessário `SUPABASE_ACCESS_TOKEN` (personal access token, não a service key do projeto) para os comandos de link/pull funcionarem.
- `project-ref` = `lygkwhcwsrxfozswhxyo` — confirmado batendo com o host em `NEXT_PUBLIC_SUPABASE_URL` do `.env` local (`https://lygkwhcwsrxfozswhxyo.supabase.co`).
- `supabase link` pede a senha do Postgres do projeto (diferente da service key/anon key já usadas pela aplicação) — não está em nenhum `.env` existente.
- `supabase db reset` sobe um Postgres local via Docker — precisa de Docker Desktop/daemon rodando na máquina.
- Ver Task 0 — se qualquer credencial não puder ser obtida, é um HALT legítimo, não algo para contornar ou simular.

### Arquitetura de Dados (source: architecture.md linhas 149-167)

> "Migrations (versionamento de schema): Supabase Migrations via CLI, com o diretório `supabase/` versionado (`config.toml`, `migrations/`, `seed.sql`). A CLI é linkada ao project-ref `lygkwhcwsrxfozswhxyo`. Um baseline (`supabase db pull`) captura o schema hoje deployado — encerrando o drift entre código e base — e cada mudança estrutural posterior passa a ser um arquivo de migration timestampado. Fluxo: `supabase db reset` (local) → `supabase db push` (remoto); CI opcional roda `supabase db diff --check` no PR. SQL manual pelo dashboard do Supabase deixa de ser a fonte estrutural."

- **Caching:** nenhum, não é relevante para esta story.
- **Isolamento:** server-side por `company_id`, não é relevante para esta story (nenhuma query de app é tocada).
- **ORM:** nenhum — queries diretas via Supabase client; migrations não mudam isso.

### Convenções de Nomenclatura do Projeto (source: architecture.md linhas 400-419)

- Tabelas: `snake_case`; nomes existentes preservados (`company`, `company_apps`, `proof_requests`, `proof_sessions`) — o baseline deve refletir exatamente esses nomes, sem renomear nada.
- Colunas: `snake_case`.
- Migrations do Supabase CLI seguem o padrão de nome `<timestamp>_<descricao>.sql` gerado automaticamente pelo próprio CLI — não inventar convenção própria.

### Testes — nota importante sobre o padrão do projeto

`architecture.md` (linha 436) diz "testes co-locados ao módulo", mas **isso não reflete a prática real**: todas as stories anteriores (1.1 a 6.2) colocam testes em `tests/unit/story-{epic}-{num}/*.test.mjs`, fora do módulo, com scripts dedicados `test:story:X.Y` no `package.json`. Siga o padrão realmente em uso (`tests/unit/story-7-1/`), não a frase isolada do architecture.md — é a mesma divergência de documentação-vs-realidade que esta story inteira existe para resolver, só que no código de app em vez de testes.

Como esta story é infraestrutura (CLI + arquivos versionados, não lógica de aplicação), os testes são **estruturais e sem tocar banco**: existência de arquivos, conteúdo de `config.toml`, conteúdo do `.gitignore`, presença/ausência de colunas específicas no SQL da migration baseline gerada. Não escrever testes que tentem conectar num banco real (nem local nem remoto) — os testes rodam em CI sem Docker/Supabase disponível.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/config.toml` | CRIAR | Gerado por `supabase init` + `supabase link`; contém `project_id = "yaid_dashboard"` (identificador local do CLI, não o project-ref — o link ao project-ref `lygkwhcwsrxfozswhxyo` fica em `supabase/.temp/project-ref`, gitignored) |
| `supabase/migrations/<timestamp>_remote_schema.sql` (nome exato definido pelo CLI) | CRIAR | Migration baseline gerada por `supabase db pull`, fiel ao schema remoto com o drift real |
| `supabase/seed.sql` | CRIAR | Gerado vazio por `supabase init` |
| `.gitignore` | MODIFICAR | Adicionar `supabase/.branches` e `supabase/.temp` |
| `tests/unit/story-7-1/*.test.mjs` | CRIAR | Testes estruturais dos artefatos de migration |
| `package.json` | MODIFICAR | Adicionar script `test:story:7.1` |
| `.github/workflows/*.yml` (se existir) | MODIFICAR (opcional) | Step opcional de `supabase db diff --check`, só se secret disponível — senão TODO comentado |

Nenhum arquivo de `src/` é tocado nesta story — é puramente infraestrutura de banco/CI. As entidades e mappers (`ProofRequest`, `Company`, `CompanyApp` e seus Mappers) só mudam nas Stories 7.2/7.3.

### References

- [Epics: Story 7.1 AC](../../planning-artifacts/epics.md#story-71-fundação-de-versionamento-de-schema-supabase-migrations--baseline)
- [Sprint Change Proposal #9 — Versionamento de schema](../../planning-artifacts/sprint-change-proposal-2026-07-27.md#9--versionamento-de-schema-com-supabase-migrations)
- [Architecture: Arquitetura de Dados](../../planning-artifacts/architecture.md#arquitetura-de-dados)
- [Architecture: Schema do Banco de Dados (schema-alvo, não o baseline)](../../planning-artifacts/architecture.md#schema-do-banco-de-dados)
- [ProofRequestMapper (schema real, sem updated_at)](../../../../src/shared/infra/dto/ProofRequestMapper.ts)
- [CompanyMapper (schema real, sem can_create_apps)](../../../../src/shared/infra/dto/CompanyMapper.ts)
- [CompanyAppMapper (schema real, sem app_id separado)](../../../../src/shared/infra/dto/CompanyAppMapper.ts)

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

- `supabase projects list` → `LegacyPlatformAuthRequiredError`: CLI sem `SUPABASE_ACCESS_TOKEN`. Resolvido via `supabase login` interativo (usuário) — token persistido no macOS Keychain, não em arquivo.
- `docker info` → OK, Docker disponível localmente.
- `supabase init` → criou `config.toml` + `.gitignore` nested; **não** criou `migrations/`/`seed.sql` nesta versão do CLI (2.109.1) — criados manualmente.
- `supabase link --project-ref lygkwhcwsrxfozswhxyo` → sucesso, sem pedir senha nesse passo.
- `supabase db pull` (sem `--password`) → **falhou silenciosamente**: retornou `{"code":"LegacyDbPullInSyncError","message":"No schema changes found"}` mesmo o remoto tendo 4 tabelas reais (confirmado via introspecção direta do PostgREST, independente do CLI). Reproduzido também com `--diff-engine pg-delta` e `--schema public` — mesmo resultado. Diagnóstico: sem senha do Postgres e sem TTY interativo, o CLI não consegue abrir a conexão direta e retorna "sem mudanças" em vez de erro de autenticação claro (bug de UX desta versão).
- `supabase migration list` → confirmou que o histórico de migrations no remoto também está vazio (banco nunca foi versionado via CLI) — descartou a hipótese de "já sincronizado por histórico".
- Usuário resetou a senha do Postgres (Studio → **Database → Settings**, não em Project Settings — a orientação inicial estava incorreta) e adicionou `SUPABASE_DB_PASSWORD` ao `.env`.
- `supabase db pull --password "$SUPABASE_DB_PASSWORD"` → sucesso: `supabase/migrations/20260728015653_remote_schema.sql` gerado, `remoteHistoryUpdated: true`.
- `supabase start` (background) → sucesso, aplicou o baseline sem erros, imagens Docker já parcialmente em cache local de outros projetos.
- `supabase db reset` → sucesso, sem erros.
- `supabase db diff --schema public` (pós-reset) → `"No schema changes found"` (resultado correto desta vez — schema local recriado bate exatamente com a migration).
- `npm run test:story:7.1` → 10/10 passando. `npm run test` (suíte completa) → 560/560 passando. `npm run lint` → 21 problemas pré-existentes em outros arquivos, zero nos arquivos desta story.

### Completion Notes List

- **HALT em Task 0** (resolvido): implementação pausou até o usuário fornecer `supabase login` + resetar/fornecer `SUPABASE_DB_PASSWORD`. Nenhum comando destrutivo ou de escrita remota foi executado antes disso.
- `supabase init` (CLI 2.109.1) não cria `migrations/` nem `seed.sql` automaticamente — criados manualmente para atender ao AC1.
- `supabase db pull` sem senha falha silenciosamente com uma mensagem enganosa (`"No schema changes found"`) em vez de erro de autenticação — documentado em Debug Log para não confundir futuras execuções desta story ou stories seguintes que rodem `db pull`/`db push`.
- Baseline gerado bate exatamente com o drift previsto no AC2 (sem `updated_at` em `proof_request`, sem `can_create_apps` em `company`, `environment` presente em `company_apps`) e revelou drift adicional não documentado nos artefatos de planejamento — ver seção "Drift real confirmado pelo pull" em Dev Notes.
- AC3 validada via `supabase start` + `supabase db reset`, ambos sem erro, e `supabase db diff` pós-reset confirmando zero divergência.
- AC4 (CI) deferida — não existe `.github/workflows/` no repositório para anexar o step; criar um pipeline de CI do zero está fora do escopo desta story. `supabase db diff` já demonstrado funcional para quando o CI existir.
- Nenhuma coluna nova foi adicionada; nenhum `db push` foi executado — a story permaneceu estritamente de leitura em relação ao banco remoto, como planejado.

### File List

**Criados:**
- `supabase/config.toml`
- `supabase/.gitignore`
- `supabase/migrations/20260728015653_remote_schema.sql`
- `supabase/seed.sql`
- `tests/unit/story-7-1/schema-baseline.test.mjs`
- `tests/unit/story-7-1/migrations-regression.test.mjs` (QA)

**Modificados:**
- `package.json` (script `test:story:7.1`)
- `.env.local.example` (documenta `SUPABASE_DB_PASSWORD`, patch do review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Epic 7 registrado; 7.1 done)
- `_bmad-output/implementation-artifacts/deferred-work.md` (2 itens deferidos do review)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` (cobertura da Story 7.1)

**Deletados:**
- `supabase/migrations/.gitkeep` (criado na Task 1, removido no patch do review após a migration real ocupar o diretório — nunca chegou a ser commitado)

## Change Log

- 2026-07-28: Story criada e implementada via bmad-story-pipeline. Infraestrutura de Supabase Migrations inicializada (`init` + `link` ao project-ref `lygkwhcwsrxfozswhxyo`); baseline gerado via `db pull` capturando fielmente o schema real (incluindo drift: `proof_request` sem `updated_at`, `company` sem `can_create_apps`, nome de tabela `proof_request` singular, ausência de `app_id`/`expires_at`/`return_url`); validado localmente via `db reset` sem erros. 10 testes estruturais novos, 560/560 na suíte completa. CI de diff deferido por não existir pipeline no repositório.
- 2026-07-28: Code review — 8 patches aplicados (DROP EXTENSION IF EXISTS, wording de AC4/gitignore/project_id corrigido na story, sort determinístico no teste, teste renomeado, `.gitkeep` removido, `SUPABASE_DB_PASSWORD` documentada em `.env.local.example`), 2 itens deferidos para `deferred-work.md` (grants amplos + RLS sem políticas; GRANT ALL em `rls_auto_enable()` — ambos estado pré-existente do banco, não introduzidos por esta story).
- 2026-07-28: QA — `tests/unit/story-7-1/migrations-regression.test.mjs` adicionado com 8 testes: verificação comportamental real do `.gitignore` via `git check-ignore`, regressão dos 3 patches com efeito funcional, wiring do script npm, compilação TypeScript. 18/18 testes da story, 568/568 na suíte completa.
