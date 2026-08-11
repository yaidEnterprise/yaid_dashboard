# Story 7.3: Allowlist de Criação de Apps (`can_create_apps`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como operador da YaID,
Quero controlar quais empresas podem criar apps,
Para que a criação seja liberada como uma assinatura, sem cobrança automática, sem que empresas não autorizadas criem apps livremente.

> 📋 **Referência UX:** [`ux-design-specification.md`](../../planning-artifacts/ux-design-specification.md) cita UX-DR6 (CTA "Criar app" bloqueado com banner explicativo, comportamento tipo assinatura sem Stripe) — **essa seção específica não foi encontrada no arquivo atual** (o documento parece anterior à adição da Story 7.3 no Sprint Change de 2026-07-28). Seguir a AC abaixo como fonte de verdade; o padrão visual de referência mais próximo no documento é o alerta âmbar bloqueante do `ApiKeyModal` (linha ~805) e o padrão de "Toggle de status com confirmação seletiva" — usar tokens `warning-*` já existentes no design system (ver Dev Notes).

## Acceptance Criteria

1. **Given** a fundação de migrations (Story 7.1) aplicada
   **When** a forward migration `add_can_create_apps_to_company` é criada e aplicada
   **Then** a coluna `company.can_create_apps BOOLEAN NOT NULL DEFAULT false` é adicionada
   **And** o backfill concede `can_create_apps = true` a **todas** as empresas existentes (evita bloqueio retroativo)

2. **Given** a entidade `Company` e o `CompanyMapper`
   **When** revisados
   **Then** incluem `canCreateApps`, propagado do banco à resposta de `GET /api/companies/me`

3. **Given** uma empresa com `can_create_apps = false`
   **When** chama `POST /api/company-apps`
   **Then** o `CreateCompanyAppUseCase` rejeita com erro 403 ("Company not allowed to create apps") — o guard é a fonte da verdade
   **And** uma empresa com `can_create_apps = true` cria o app normalmente

4. **Given** a página `/(dashboard)/apps` para uma empresa com `canCreateApps = false`
   **When** a página carrega
   **Then** o CTA "Criar app" fica desabilitado e um banner explicativo é exibido (tipo assinatura, sem Stripe)
   **And** `/apps/new` é bloqueada (redirect ou estado desabilitado) para essa empresa

## Tasks / Subtasks

- [x] Task 1: Forward migration `add_can_create_apps_to_company` (AC: #1)
  - [x] Criado via `npx supabase migration new add_can_create_apps_to_company` — `supabase/migrations/20260809165356_add_can_create_apps_to_company.sql` (timestamp gerado pelo CLI)
  - [x] SQL escrito com backfill explícito: `ADD COLUMN can_create_apps boolean` (nullable) → `UPDATE public.company SET can_create_apps = true WHERE can_create_apps IS NULL` → `ALTER COLUMN can_create_apps SET DEFAULT false, SET NOT NULL`
  - [x] Backfill `true` escrito antes do `SET DEFAULT false` — ordem verificada por teste dedicado (`tests/unit/story-7-3/allowlist-can-create-apps.test.mjs`, teste "backfill (true) happens before the default is set to false")
  - [x] **Validação local via `db reset`/`db diff` NÃO executada — deferida, ambiente sem Docker** (`docker info` falhou: nenhum daemon disponível nesta sessão, mesma limitação das Stories 7.1/7.2). Migration validada apenas estruturalmente via teste. Item registrado em `deferred-work.md`
  - [x] Nenhum `supabase db push` executado — mesma cautela operacional das Stories 7.1/7.2

- [x] Task 2: Atualizar entidade `Company` e `CompanyMapper` (AC: #2)
  - [x] `src/shared/domain/entities/Company.ts`: `canCreateApps: boolean` adicionado a `CompanyProps` + getter
  - [x] `src/shared/infra/dto/CompanyMapper.ts`: `can_create_apps: boolean` adicionado a `CompanyPersistence`; mapeado em `toDomain`/`toPersistence`
  - [x] `src/modules/company/app/create_company_usecase.ts`: único ponto de instanciação neste arquivo — `canCreateApps: false` setado explicitamente para empresas novas (decisão confirmada: criação é liberada como assinatura, então o estado inicial é bloqueado)
  - [x] `src/modules/company/app/get_my_company_usecase.ts` + `get_my_company_viewmodel.ts`: `canCreateApps: boolean` adicionado ao `CompanyOutputDTO` retornado por `GET /api/companies/me`
  - [x] Busca por outros pontos de instanciação (`grep -rn "new Company("`) encontrou um terceiro ponto não previsto na story original: `src/modules/company/app/update_my_company_usecase.ts` — corrigido para propagar `canCreateApps: company.canCreateApps` no objeto `Company` reconstruído em memória (exigido para compilar, já que o campo é obrigatório na entidade). **Nota de precisão (achado do Acceptance Auditor):** `SupabaseCompanyRepository.update()` já grava só `name`/`document_number` no banco — nunca persistiu `can_create_apps` (nem `email`/`status`/`created_at`), por design, já que `UpdateMyCompanyInputDTO` só expõe nome/CNPJ como editáveis. Logo essa propagação em memória não protege nenhuma persistência real (não havia risco de reset no banco); ela só evita que o objeto `Company` reconstruído carregasse `canCreateApps` com um valor arbitrário/incorreto antes de virar o DTO de resposta

- [x] Task 3: Guard 403 no `CreateCompanyAppUseCase` (AC: #3)
  - [x] `src/modules/company-app/app/create_company_app_usecase.ts`: `CompanyRepository` injetado no construtor; `execute()` busca a company via `companyRepository.findById(input.companyId)` e lança `ForbiddenError("Company not allowed to create apps")` se `!company.canCreateApps`. Usado `ForbiddenError` (403) — padrão já estabelecido no módulo
  - [x] `src/modules/company-app/app/create_company_app_presenter.ts` (`makeCreateCompanyAppController`): `await envs.getCompanyRepository()` passado como terceiro argumento do `CreateCompanyAppUseCase`
  - [x] Decisão: company não encontrada (`findById` retorna `null`) vira `NotFoundError("Company not found", "COMPANY_NOT_FOUND")` — caminho defensivo, não deveria ocorrer em uso normal (companyId vem de `x-company-id` autenticado)

- [x] Task 4: CTA bloqueado + banner em `/(dashboard)/apps` (AC: #4)
  - [x] `app/(dashboard)/apps/page.tsx`: `canCreateApps` buscado via `fetchWithAuth("/api/companies/me")` em `useEffect` próprio, estado de 3 valores (`"loading" | boolean`)
  - [x] Anti-flash: enquanto `canCreateApps === "loading"`, o CTA do header e o CTA do `EmptyState` renderizam skeleton (`animate-pulse`) em vez de habilitado/desabilitado prematuro
  - [x] Quando `canCreateApps === false`: CTA "Criar app" do header vira `<span aria-disabled>` não-navegável + `CreateAppsBlockedBanner` (tokens `warning-bg`/`warning-text`/`warning-border`, mesmo padrão do `ApiKeyModal`) exibido abaixo do `PageHeader`
  - [x] `EmptyState` recebe `canCreateApps` como prop e replica os 3 estados (skeleton/habilitado/bloqueado) no CTA "Criar primeiro app"
  - [x] `app/(dashboard)/apps/new/page.tsx`: no mount, busca `canCreateApps`; estado `"checking" | "yes" | "no"` controla um `useEffect` que faz `router.replace("/apps")` quando `"no"`; o formulário só renderiza quando `allowed === "yes"` (skeleton nos demais casos) — sem flash do formulário

- [x] Task 5: Criar testes estruturais e de comportamento (AC: todos)
  - [x] `tests/unit/story-7-3/allowlist-can-create-apps.test.mjs` criado — 8 suites / 24 testes cobrindo migration (SQL, incluindo ordem backfill/default), entity `Company`, `CompanyMapper`, os 3 pontos de instanciação de `Company`, DTO de `GET /api/companies/me`, guard 403 em `CreateCompanyAppUseCase` + presenter, CTA/banner em `/apps` e bloqueio em `/apps/new`
  - [x] Testes estruturais via inspeção de source (regex sobre arquivo), seguindo o padrão real do projeto (Stories 7.1/7.2)
  - [x] Script `"test:story:7.3"` adicionado ao `package.json`

- [x] Task 6: Rodar testes e validar
  - [x] `npm run test:story:7.3` — 24/24 passando
  - [x] `npm run test` (suíte completa) — 684/686 passando; as 2 falhas (`story-1-5`/`story-1-6`, redirect via `window.location.href`) são pré-existentes e não relacionadas (mesmas falhas já documentadas na Story 7.2)
  - [x] `npm run lint` — 6 erros/12 warnings, mesma contagem pré-existente da Story 7.2; nenhum em arquivo tocado por esta story (confirmado via grep no output)
  - [x] `npx tsc --noEmit` — limpo, zero erros
  - [x] Nenhum teste existente instancia `Company` diretamente (`grep -rn "new Company(" tests/` sem resultados) — sem efeito colateral de compilação em fixtures de outras stories

### Review Findings

- [x] [Review][Patch] Janela de corrida na migration entre `ADD COLUMN` (nullable) e `SET NOT NULL` — apontada de forma independente pelo Blind Hunter e pelo Edge Case Hunter: uma inserção concorrente nesse intervalo receberia `NULL` sem default ainda definido, fazendo o `SET NOT NULL` falhar [`supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`] — corrigido: migration reescrita para `ADD COLUMN can_create_apps boolean not null default false` em uma única instrução atômica, seguida do `UPDATE ... SET can_create_apps = true` de backfill; elimina a janela por completo (mais seguro que o padrão de 3 statements usado na Story 7.2). Testes atualizados para refletir a nova forma.
- [x] [Review][Patch] `GET /api/companies/me` tratado com type assertion bare (`as Promise<{ canCreateApps: boolean }>`), sem validação de shape em runtime — se o campo vier ausente/renomeado, `canCreateApps` vira `undefined` silenciosamente [`app/(dashboard)/apps/page.tsx`, `app/(dashboard)/apps/new/page.tsx`] — corrigido: ambas as páginas agora validam `typeof canCreate === "boolean"` antes de confiar no valor, com o mesmo fallback fail-open documentado para shapes inesperados.
- [x] [Review][Patch] Redirect silencioso em `/apps/new` quando bloqueado — usuário que navega direto para a URL é jogado de volta para `/apps` sem nenhuma explicação [`app/(dashboard)/apps/new/page.tsx`] — corrigido: `toast.error(...)` adicionado antes do `router.replace("/apps")`.
- [x] [Review][Patch] CTAs desabilitados (`aria-disabled`) sem `aria-label`/`title` explicando o motivo do bloqueio — estado decorativo, não acessível [`app/(dashboard)/apps/page.tsx`] — corrigido: `aria-label` e `title` adicionados aos dois CTAs bloqueados (header e `EmptyState`).
- [x] [Review][Patch] Completion Notes descreviam a mudança em `update_my_company_usecase.ts` como proteção contra "reset da flag em updates parciais", mas `SupabaseCompanyRepository.update()` nunca persistiu `can_create_apps` (só grava `name`/`document_number`, por design) — a narrativa superestimava o efeito real da mudança (achado do Acceptance Auditor) [`_bmad-output/implementation-artifacts/stories/7-3-allowlist-de-criacao-de-apps.md`] — corrigido: Dev Notes/Debug Log reformulados para descrever a mudança como correção de tipo/consistência em memória, não de persistência.
- [x] [Review][Defer] Migration sem transação explícita (`BEGIN`/`COMMIT`) entre `ADD COLUMN`/`UPDATE` — deferido, pré-existente como padrão do projeto (mesma observação já feita nas Stories 7.1/7.2) [`supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`]
- [x] [Review][Defer] `CompanyMapper.toDomain` sem guarda contra `raw.can_create_apps` undefined/malformado — deferido, mesmo padrão já aceito em outros mappers do projeto (ex.: `ProofRequestMapper.updated_at`, Story 7.2) [`src/shared/infra/dto/CompanyMapper.ts`]
- [x] [Review][Defer] `CreateCompanyAppUseCase.execute()` sem try/catch dedicado em torno de `companyRepository.findById()` — erro cru do Supabase propaga sem tradução até o 500 genérico da borda — deferido, padrão pré-existente em outros use cases do projeto (ex.: Story 5.8) [`src/modules/company-app/app/create_company_app_usecase.ts`]
- [x] [Review][Defer] Lógica de fetch/guard de `canCreateApps` duplicada entre `/apps` e `/apps/new`, sem hook compartilhado — deferido, risco baixo de drift; extrair se um terceiro consumidor aparecer [`app/(dashboard)/apps/page.tsx`, `app/(dashboard)/apps/new/page.tsx`]
- [x] [Review][Defer] Nenhum log/auditoria quando o guard 403 rejeita uma tentativa de criação de app — deferido, fora do escopo dos ACs desta story [`src/modules/company-app/app/create_company_app_usecase.ts`]
- [x] [Review][Defer] Sem migration de rollback para `add_can_create_apps_to_company` — deferido, consistente com Stories 7.1/7.2 (nenhuma tem rollback scriptado) [`supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`]

## Dev Notes

### O que a Story 7.1/7.2 já deixaram pronto (ler antes de começar)

- A tabela real chama-se `company` (singular) — confirmado no baseline (`supabase/migrations/20260728015653_remote_schema.sql:44`): `CREATE TABLE public.company (id uuid ..., name ..., document_number ..., email ..., status ..., created_at ...)`. Sem `can_create_apps` — esta story adiciona a coluna.
- Padrão de migration: `npx supabase migration new <nome>` para o CLI gerar o timestamp. Mesmo padrão estrutural de 3 statements (`ADD COLUMN` nullable → `UPDATE` backfill → `ALTER ... SET DEFAULT/SET NOT NULL`) usado em `20260805223534_add_updated_at_to_proof_requests.sql` — mas **cuidado**: nesta story o valor do backfill (`true`) e o `DEFAULT` final da coluna (`false`) **são diferentes**, ao contrário da 7.2 onde coincidiam. Ver Task 1.
- Ambiente sem Docker nas sessões anteriores (`docker info` falhou) — `supabase db reset`/`db diff` não puderam validar contra Postgres real; migrations foram validadas só estruturalmente e o item ficou registrado em `deferred-work.md`. Se este ambiente também não tiver Docker, seguir o mesmo caminho e registrar o item.
- Testes seguem `tests/unit/story-{epic}-{num}/*.test.mjs` com script dedicado `test:story:X.Y` — não usar testes co-locados ao módulo apesar do que `architecture.md:436` sugere.

### `CreateCompanyAppUseCase` — dependência nova precisa fluir pelo presenter

Hoje o construtor é `constructor(private readonly repo: CompanyAppRepository, private readonly hasher: ApiKeyHasher)`. Adicionar `CompanyRepository` como terceira dependência quebra a assinatura — o único lugar que instancia essa classe é `makeCreateCompanyAppController()` em `create_company_app_presenter.ts`, então o ajuste é local e não deve vazar para o `Controller` nem para a rota HTTP (`app/api/company-apps/route.ts`, não incluída no File List — não deveria precisar mudar). `Environments.getCompanyRepository()` já existe e é usado por `get_my_company_presenter.ts`/`create_company_presenter.ts` — reusar o mesmo factory.

Fonte da verdade do guard é o banco (`company.can_create_apps`), não um campo denormalizado — por isso o use case precisa buscar a company mesmo já tendo `companyId` disponível via `input.companyId` (que vem de `x-company-id`, setado pelo middleware de auth). Não confiar em nenhum valor de `canCreateApps` vindo do client/request body.

### `Company` entity — imutabilidade do padrão existente

`Company` (como `ProofRequest`) usa o padrão de `props` privado + getters, sem setters para `canCreateApps` (a flag é alterada só via SQL/admin direto nesta story — não há endpoint de toggle previsto na Story 7.3; isso pode vir em story futura de "gestão de allowlist" fora do escopo atual). Não adicionar método `grantCreateApps()`/similar sem necessidade comprovada pela AC.

### CTA bloqueado — evitar flash de estado incorreto

O padrão já estabelecido no `AppTopbar` (`components/layout/app-topbar.tsx`) para dados assíncronos client-side é: estado `loading` explícito com skeleton, nunca um valor placeholder que pareça dado real. Aplicar o mesmo em `/apps` e `/apps/new` para `canCreateApps` — especialmente em `/apps/new`, onde renderizar o formulário por um instante antes de redirecionar seria pior UX que renderizar o formulário bloqueado (a AC aceita qualquer uma das duas abordagens, mas a implementação deve escolher uma e ser consistente, sem flash intermediário).

Não existe componente `Alert`/`Banner` reusável no projeto ainda (`components/` não tem nada em `*alert*`/`*banner*`) — o alerta amber do `ApiKeyModal` (`components/apps/api-key-modal.tsx:87`) é inline, não um componente extraído. Seguir o mesmo caminho (inline, tokens `warning-*`) em vez de criar um componente novo sem necessidade comprovada por outra tela.

### Testes — padrão real do projeto

Confirmado nas Stories 7.1/7.2: testes são inspeção estrutural via regex sobre o source (`fs.readFileSync` + assertions sobre presença de trechos), não fakes/mocks de repositório — mesmo para lógica de use case (`updateStatus`, e agora o guard 403). Seguir esse padrão para consistência, a menos que o comportamento (não só a presença de código) precise ser exercitado — nesse caso, olhar como `tests/unit/story-3-3/proof-request-detail.test.mjs` resolveu antes de decidir.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/migrations/<timestamp>_add_can_create_apps_to_company.sql` | CRIAR | Forward migration: `ADD COLUMN can_create_apps BOOLEAN NOT NULL DEFAULT false`, backfill `true` nas linhas existentes |
| `src/shared/domain/entities/Company.ts` | MODIFICAR | Adicionar `canCreateApps: boolean` a `CompanyProps` + getter |
| `src/shared/infra/dto/CompanyMapper.ts` | MODIFICAR | Adicionar `can_create_apps` a `CompanyPersistence`; mapear em `toDomain`/`toPersistence` |
| `src/modules/company/app/create_company_usecase.ts` | MODIFICAR | Instanciação de `Company` passa a incluir `canCreateApps` (decidir valor inicial — ver Task 2) |
| `src/modules/company/app/get_my_company_usecase.ts` | MODIFICAR | `CompanyOutputDTO` retornado inclui `canCreateApps` |
| `src/modules/company/app/get_my_company_viewmodel.ts` | MODIFICAR | Tipo `CompanyOutputDTO` ganha `canCreateApps: boolean` |
| `src/modules/company-app/app/create_company_app_usecase.ts` | MODIFICAR | Injeta `CompanyRepository`; guard `ForbiddenError` se `!company.canCreateApps` |
| `src/modules/company-app/app/create_company_app_presenter.ts` | MODIFICAR | `makeCreateCompanyAppController` passa `envs.getCompanyRepository()` ao use case |
| `app/(dashboard)/apps/page.tsx` | MODIFICAR | Fetch de `canCreateApps`; CTA + `EmptyState` bloqueados com banner quando `false` |
| `app/(dashboard)/apps/new/page.tsx` | MODIFICAR | Fetch de `canCreateApps`; bloqueio (redirect ou estado desabilitado) quando `false` |
| `tests/unit/story-7-3/*.test.mjs` | CRIAR | Testes estruturais (migration) + comportamentais (mapper, guard, DTO) |
| `package.json` | MODIFICAR | Adicionar script `test:story:7.3` |

Arquivos a **checar mas provavelmente não tocar** (confirmar escopo antes de editar): `app/api/companies/me/route.ts` (só repassa o DTO do use case, não deveria precisar mudar), `app/api/company-apps/route.ts` (idem — o guard fica no use case).

### References

- [Epics: Story 7.3 AC](../../planning-artifacts/epics.md#story-73-allowlist-de-criação-de-apps-can_create_apps)
- [Story 7.2 (padrão de migration com backfill explícito, precedente direto)](7-2-coluna-updated-at-e-gravacao-em-toda-transicao.md)
- [Story 7.1 (fundação de migrations, precondição desta story)](7-1-fundacao-de-versionamento-de-schema.md)
- [Baseline do schema (`company` sem `can_create_apps`)](../../../../supabase/migrations/20260728015653_remote_schema.sql)
- [Company entity atual](../../../../src/shared/domain/entities/Company.ts)
- [CompanyMapper atual](../../../../src/shared/infra/dto/CompanyMapper.ts)
- [CreateCompanyAppUseCase atual (sem guard)](../../../../src/modules/company-app/app/create_company_app_usecase.ts)
- [Página /(dashboard)/apps (CTA a bloquear)](../../../../app/(dashboard)/apps/page.tsx)
- [Página /(dashboard)/apps/new (bloqueio a implementar)](../../../../app/(dashboard)/apps/new/page.tsx)
- [AppTopbar (padrão de fetch client-side de /api/companies/me + estado loading)](../../../../components/layout/app-topbar.tsx)
- [AppError/ForbiddenError (padrão de guard 403 já usado no módulo company-app)](../../../../src/shared/errors/AppError.ts)
- [ux-design-specification.md (referência UX-DR6 citada no epics, não localizada no documento atual)](../../planning-artifacts/ux-design-specification.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx supabase migration new add_can_create_apps_to_company` → sucesso, gerou `supabase/migrations/20260809165356_add_can_create_apps_to_company.sql` vazio, sem precisar de `link`/credenciais/Docker
- `docker info` → falhou (nenhum daemon Docker disponível neste ambiente) → `supabase db reset`/`supabase db diff` não puderam ser executados; migration validada apenas estruturalmente via teste
- `grep -rn "new Company("` → 3 pontos de instanciação (`CompanyMapper.toDomain`, `create_company_usecase.ts`, `update_my_company_usecase.ts`) — a story previu só os 2 primeiros; `update_my_company_usecase.ts` foi encontrado durante a implementação e corrigido
- `grep -rn "new Company(" tests/` → nenhum resultado, nenhuma fixture de teste precisou de ajuste
- `npm run test:story:7.3` → 24/24 passando (8 suites) na primeira rodada; 27/27 (8 suites) após os patches do code review (3 testes novos cobrindo os guards de shape/toast adicionados)
- `npm run test` (suíte completa) → 687/689 passando após os patches. As 2 falhas (`story-1-5/signup-atomico.test.mjs`, `story-1-6/login-e-protecao-de-rotas.test.mjs`, ambas sobre `window.location.href`) confirmadas pré-existentes e não relacionadas — já documentadas como tal na Story 7.2
- `npm run lint` → 6 erros/12 warnings, mesma contagem pré-existente da Story 7.2; confirmado via grep no output que nenhum é em arquivo tocado por esta story (reconfirmado após os patches)
- `npx tsc --noEmit` → limpo, zero erros (reconfirmado após os patches)
- Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, paralelos) → 5 patches aplicados, 6 itens deferidos, resto dispensado como ruído/já documentado — ver seção "Review Findings"

### Completion Notes List

- Migration `20260809165356_add_can_create_apps_to_company.sql` criada com backfill explícito. **Reescrita durante o code review** (Blind Hunter + Edge Case Hunter apontaram, de forma independente, uma janela de corrida entre `ADD COLUMN` nullable e `SET NOT NULL`): forma final é `ADD COLUMN can_create_apps boolean not null default false` em uma única instrução atômica, seguida de `UPDATE ... SET can_create_apps = true` para o backfill — elimina a janela por completo, mais seguro que o padrão de 3 statements da Story 7.2. Backfill (`true`) e default final (`false`) continuam deliberadamente diferentes, conforme AC1. **Não validada contra Postgres real** nesta sessão por falta de Docker — ver item em `deferred-work.md`. Nenhum `db push` executado.
- `Company` entity e `CompanyMapper` atualizados com `canCreateApps`/`can_create_apps`. Dos 3 pontos de instanciação de `Company` no código (1 a mais do que a story previu), `create_company_usecase.ts` seta `canCreateApps: false` (empresas novas nascem bloqueadas, consistente com "criação liberada como assinatura") e `update_my_company_usecase.ts` propaga `company.canCreateApps` para o objeto `Company` reconstruído em memória — correção de tipo/consistência, não de persistência: `SupabaseCompanyRepository.update()` só grava `name`/`document_number` no banco (por design, já que `UpdateMyCompanyInputDTO` só expõe esses campos como editáveis), então `can_create_apps` nunca esteve em risco de ser resetado pelo endpoint de update.
- `CreateCompanyAppUseCase` agora recebe `CompanyRepository` via construtor e rejeita com `ForbiddenError` (403) quando `!company.canCreateApps`, antes de qualquer criação de app. `makeCreateCompanyAppController` atualizado para injetar a dependência via `Environments.getCompanyRepository()`, já usado por outros presenters do módulo `company`.
- `GET /api/companies/me` agora retorna `canCreateApps` no DTO (`CompanyOutputDTO`), lido pelo client em `/apps` e `/apps/new`.
- `/apps`: CTA do header e do `EmptyState` mostram skeleton enquanto `canCreateApps` carrega, depois desabilitam com `aria-disabled` + banner explicativo (tokens `warning-*`) quando bloqueado — sem flash de estado incorreto, seguindo o padrão já usado no `AppTopbar`.
- `/apps/new`: bloqueia a renderização do formulário até a checagem de `canCreateApps` resolver; redireciona para `/apps` via `router.replace` se bloqueado, sem deixar o formulário aparecer nem por um instante.
- Decisão registrada em `deferred-work.md`: ambas as páginas "falham abertas" (assumem `true`) se o fetch de `/api/companies/me` der erro de rede — o guard real (403) no use case permanece a fonte da verdade, então o pior caso é um toast de erro no submit, não uma falha de segurança.
- Testes novos seguem o padrão de inspeção estrutural (regex sobre source) já estabelecido no projeto, consistente com as Stories 7.1/7.2.

### File List

**Criados:**
- `supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`
- `tests/unit/story-7-3/allowlist-can-create-apps.test.mjs`

**Modificados:**
- `src/shared/domain/entities/Company.ts`
- `src/shared/infra/dto/CompanyMapper.ts`
- `src/modules/company/app/create_company_usecase.ts`
- `src/modules/company/app/update_my_company_usecase.ts`
- `src/modules/company/app/get_my_company_usecase.ts`
- `src/modules/company/app/get_my_company_viewmodel.ts`
- `src/modules/company-app/app/create_company_app_usecase.ts`
- `src/modules/company-app/app/create_company_app_presenter.ts`
- `app/(dashboard)/apps/page.tsx`
- `app/(dashboard)/apps/new/page.tsx`
- `package.json` (script `test:story:7.3`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (validação local da migration sem Docker, guarda ausente em `CompanyMapper`, `findById` sem try/catch dedicado, lógica de fetch duplicada entre páginas, ausência de log/auditoria no guard 403, fail-open client-side, ausência de UI de gestão da allowlist, ausência de migration de rollback, transação explícita — 9 itens deferidos do code review, ver "Review Findings")
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status da story)

## Change Log

- 2026-08-09: Story criada e implementada via bmad-story-pipeline. Coluna `can_create_apps` adicionada a `company` via forward migration (backfill `true` para empresas existentes, default `false` para novas); `Company`/`CompanyMapper` atualizados; `CreateCompanyAppUseCase` agora rejeita com 403 (`ForbiddenError`) empresas sem a flag; `GET /api/companies/me` propaga `canCreateApps`; CTA "Criar app" bloqueado com banner explicativo em `/apps` e bloqueio de navegação em `/apps/new` quando a empresa não está liberada. 24 testes novos, 684/686 na suíte completa (2 falhas pré-existentes não relacionadas). Migration não validada contra Postgres real por falta de Docker no ambiente — deferido.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, execução paralela). 5 patches aplicados: migration reescrita para eliminar janela de corrida (statement único `NOT NULL DEFAULT false`), validação de shape da resposta de `GET /api/companies/me` em ambas as páginas client, toast explicativo antes do redirect silencioso em `/apps/new`, `aria-label`/`title` nos CTAs bloqueados, correção da narrativa das Completion Notes sobre `update_my_company_usecase.ts`. 9 itens deferidos (pré-existentes ou fora de escopo dos ACs). 3 testes novos (27 no total), 687/689 na suíte completa (mesmas 2 falhas pré-existentes). Status → `test`.
