# Sprint Change Proposal — 2026-08-22 (Landing Page)

**Projeto:** yaid_dashboard
**Solicitante:** Victordegasperi
**Modo:** Batch

> Nota: já existe um `sprint-change-proposal-2026-08-22.md` no mesmo dia, referente ao
> Epic 12 (documentação pública `/docs`). Este é um segundo Correct Course, no mesmo dia,
> para um trigger diferente — por isso o sufixo `-landing-page` no nome do arquivo.

---

## 1. Resumo do Issue

**Trigger:** novo requisito de stakeholder (não originado de uma story em execução).

**Problema:** o domínio da YaID não tem hoje nenhuma página pública que apresente o produto
para empresas parceiras antes de exigir login. A rota raiz (`/`) é hoje o próprio dashboard
(`app/(dashboard)/page.tsx`), protegida por autenticação — quem chega ao domínio sem sessão é
imediatamente jogado para `/sign-in`, sem nenhum contexto institucional sobre o que é a YaID ou
por que criar uma conta.

**Evidência:** solicitação direta do usuário; confirmado por leitura de
`src/shared/middleware.ts` — a função `isDashboardPage` inclui `"/"` na lista de rotas
protegidas, e o redirect pós-login (`isPublicAuthPage`) manda o usuário de volta para `"/"`.
Não existe hoje nenhum `app/page.tsx` fora do grupo `(dashboard)`.

**Decisão de escopo tomada com o usuário:**

- A landing page assume a rota raiz `/`. O dashboard atual (Overview) muda para `/dashboard`.
- Usuário autenticado que acessar `/` é redirecionado para `/dashboard`.
- Objetivo da landing: apresentação institucional/produto para empresas parceiras (proposta de
  valor, como funciona a verificação de identidade, CTA para `/sign-up`), mesmo público-alvo do
  Epic 12 (`/docs`) — a landing e o `/docs` se complementam (landing vende, `/docs` ensina a
  integrar).

---

## 2. Análise de Impacto

### Epics

- Nenhum epic existente (1–11) precisa ser alterado ou é invalidado.
- Epic 12 (Documentação Pública de Integração, criado no Sprint Change anterior de hoje) não é
  afetado — permanece `backlog`, independente deste.
- Novo epic necessário: **Epic 13 — Landing Page Institucional**. Não depende do Epic 12, mas os
  dois se referenciam mutuamente no conteúdo (a landing linka para `/docs`).
- Ordem: sem restrição — pode ser desenvolvido a qualquer momento.

### PRD

- Conflito: nenhum direto, mas **este é o único Sprint Change do dia que altera comportamento de
  uma rota já existente** (`/` deixa de ser o dashboard direto e passa a ter dois
  comportamentos conforme sessão). Isso é uma mudança de contrato de rota, não puramente aditiva
  como o Epic 12.
- Novo requisito funcional (FR36) e nova seção descritiva ("Landing page institucional").
- MVP: não é redefinido nem reduzido.

### Architecture

- `src/shared/middleware.ts`:
  - `isDashboardPage`: `dashboardPaths` passa de `["/", "/apps", "/proof-requests", "/settings"]`
    para `["/dashboard", "/apps", "/proof-requests", "/settings"]`.
  - Novo tratamento explícito para `pathname === "/"`: se houver sessão (`user`), redireciona
    para `/dashboard`; caso contrário, deixa passar (renderiza a landing pública).
  - `isPublicAuthPage`: redirect de usuário autenticado em `/sign-in`/`/sign-up` passa de
    `new URL("/", ...)` para `new URL("/dashboard", ...)`.
- Rotas de arquivo:
  - `app/(dashboard)/page.tsx` (Overview atual) move para `app/(dashboard)/dashboard/page.tsx`
    — dentro do mesmo route group `(dashboard)`, então continua protegida e com o mesmo layout
    (sidebar/topbar), só muda a URL de `/` para `/dashboard`.
  - Novo `app/page.tsx` na raiz (fora de qualquer route group) — landing pública, usa apenas o
    `app/layout.tsx` global (mesmo padrão já usado por `app/v/[sessionToken]/page.tsx`, que hoje
    roda sem sidebar/topbar por estar fora do grupo `(dashboard)`).
- Referências hardcoded a `"/"` que precisam virar `"/dashboard"`:
  - `components/layout/app-sidebar.tsx:11` — item de nav "Overview" (`url: "/"`).
  - `components/layout/app-sidebar.tsx:23` — lógica de path ativo (`pathname === "/"`).
  - `app/sign-up/page.tsx:94` — `router.push("/")` após cadastro bem-sucedido.
  - `app/sign-in/page.tsx:50` — fallback padrão do parâmetro `next` (`"/"`).
- Nenhuma mudança de schema, API ou integração externa. Nenhuma tabela de rotas formal existe em
  `architecture.md` referenciando `/` — não há edição necessária nesse documento além do que já
  é descrito no PRD.

### UI/UX

- Novo padrão de página: landing institucional (hero, proposta de valor, "como funciona" em
  passos, CTA para `/sign-up`, link para `/docs`). Sem wireframe formal no UX Spec — será
  definida na implementação da Story 13.2 seguindo a paleta/tipografia já estabelecidas (mesmo
  padrão visual de marca usado em `/v/[sessionToken]` e no futuro `/docs`).
- Navegação do dashboard (`AppSidebar`) precisa do ajuste de URL descrito acima — impacto visual
  nulo (mesmo item de menu, só muda o `href`).

### Outros artefatos

- Testes: cobertura da lógica de redirect no middleware (usuário autenticado em `/` →
  `/dashboard`; usuário anônimo em `/` → landing renderiza; `/dashboard` sem sessão → redirect
  para `/sign-in`) e renderização da landing.
- CI/CD, infraestrutura, deployment: sem impacto — mesma build do Next.js, nenhuma env var nova.
- **Risco de regressão a observar:** qualquer link/bookmark externo ou automação (ex: e2e tests)
  que hoje assuma que `/` é o dashboard precisa ser atualizado junto — ver Story 13.1.

---

## 3. Caminho Recomendado

**Opção escolhida: Ajuste Direto (Option 1)** — novo epic + 2 novas stories dentro da estrutura
atual, sem rollback e sem revisão de escopo do MVP.

- Esforço: **Médio** (maior que o Epic 12, porque mexe em uma rota já existente e protegida —
  middleware, sidebar e 2 pontos de redirect — além do conteúdo novo da landing em si).
- Risco: **Baixo-Médio** — mudança é bem delimitada e coberta por teste de middleware, mas é a
  primeira mudança do dia que toca comportamento de rota já em produção (`/`).
- Rollback (Option 2): não avaliado como viável — não há nada a reverter, o issue não decorre de
  trabalho já feito.
- Revisão de MVP (Option 3): não necessária.

---

## 4. Propostas de Mudança Detalhadas

### 4.1 PRD (`_bmad-output/planning-artifacts/prd.md`)

**Nova subseção**, inserida após a seção "Documentação pública de integração" (Epic 12) e antes
de "### APIs":

```
### Landing page institucional

- Rota pública `/` passa a exibir uma landing institucional (fora de qualquer grupo de rotas,
  usa só o layout global) apresentando a YaID para empresas parceiras: proposta de valor, como
  funciona a verificação de identidade em alto nível, CTA para `/sign-up` e link para `/docs`.
- Usuário autenticado que acessa `/` é redirecionado para `/dashboard`.
- O dashboard (Overview) passa a viver em `/dashboard` (antes em `/`); demais rotas do dashboard
  (`/apps`, `/proof-requests`, `/settings`) não mudam.
- Conteúdo é estático — nenhuma API nova é necessária.
```

**Novo requisito funcional**, adicionado ao final da lista de Functional Requirements:

```
FR36: A rota raiz (`/`) deve exibir uma landing page pública institucional apresentando a
proposta de valor da YaID para empresas parceiras (visão geral do fluxo de verificação de
identidade, CTA para criar conta) sem exigir autenticação; usuários autenticados que acessarem
`/` devem ser redirecionados para `/dashboard`, que passa a hospedar a home atual do dashboard
(Overview).
```

**FR Coverage Map**, nova linha:

```
FR36: Epic 13 — Landing page institucional + reorganização de rota do dashboard
```

**Cabeçalho do documento** — nova linha de revisão (encadeada após a do Epic 12, mesma data):

```
> **Última atualização:** 2026-08-22 (Sprint Change 2026-08-22 — Epic 13: landing page
> institucional em `/`; dashboard passa a viver em `/dashboard`. Aditivo; núcleo e MVP
> inalterados)
```

E entrada correspondente em `editHistory` no frontmatter.

---

### 4.2 Epics (`_bmad-output/planning-artifacts/epics.md`)

**Novo epic na Epic List:**

```
### Epic 13: Landing Page Institucional

Visitante anônimo que chega ao domínio da YaID encontra uma landing page pública explicando o
que é a plataforma e como funciona a verificação de identidade, com caminho claro para criar
conta. Usuário autenticado continua indo direto para o dashboard, agora em `/dashboard`.

**FRs cobertos:** FR36
```

**Nova seção de epic completa**, com 2 stories:

```
## Epic 13: Landing Page Institucional

### Story 13.1: Mover Dashboard para `/dashboard` e Ajustar Middleware/Redirects

Como desenvolvedor,
Quero liberar a rota raiz `/` do dashboard e mover a home atual para `/dashboard`,
Para que a landing page institucional possa ocupar `/` sem quebrar o acesso autenticado.

**Acceptance Criteria:**

**Given** o arquivo `app/(dashboard)/page.tsx` (Overview atual)
**When** a mudança é aplicada
**Then** o conteúdo passa a viver em `app/(dashboard)/dashboard/page.tsx`, servindo a rota
`/dashboard` com o mesmo layout (sidebar/topbar) e o mesmo comportamento de hoje

**Given** `src/shared/middleware.ts`
**When** a mudança é aplicada
**Then** `isDashboardPage` protege `/dashboard`, `/apps`, `/proof-requests` e `/settings` (não
mais `/`)
**And** a rota `/` passa por uma checagem própria: se houver sessão autenticada, redireciona
para `/dashboard`; caso contrário, deixa passar (a landing pública é renderizada)
**And** o redirect de usuário autenticado que acessa `/sign-in` ou `/sign-up` passa a apontar
para `/dashboard` (em vez de `/`)

**Given** `app/sign-up/page.tsx` e `app/sign-in/page.tsx`
**When** o cadastro é concluído ou o login é bem-sucedido sem parâmetro `next`
**Then** o redirecionamento acontece para `/dashboard` (não mais `/`)

**Given** `components/layout/app-sidebar.tsx`
**When** renderizado
**Then** o item de navegação "Overview" aponta para `/dashboard` e é destacado como ativo
corretamente quando `pathname` é `/dashboard`

**Given** a suíte de testes existente que referencia a rota `/` como dashboard
**When** executada após a mudança
**Then** os testes foram atualizados para refletir `/dashboard` e passam integralmente

---

### Story 13.2: Página Pública "/" — Landing Institucional

Como visitante anônimo (empresa parceira em potencial),
Quero encontrar uma página institucional ao acessar o domínio da YaID,
Para que eu entenda o que é a plataforma e como criar uma conta antes de precisar fazer login.

**Acceptance Criteria:**

**Given** a rota `/` (novo `app/page.tsx`, fora de qualquer route group, usando apenas o layout
global — mesmo padrão de `app/v/[sessionToken]/page.tsx`)
**When** acessada sem autenticação
**Then** a página carrega normalmente, sem sidebar/topbar do dashboard
**And** apresenta: hero com proposta de valor, seção "Como funciona" (fluxo de verificação de
identidade em alto nível, 3–4 passos), CTA principal para `/sign-up`, link secundário para
`/docs` (guia técnico de integração do Epic 12)

**Given** um usuário com sessão autenticada
**When** acessa `/`
**Then** é redirecionado para `/dashboard` (não vê a landing)

**Given** a landing page
**When** renderizada em mobile e desktop
**Then** segue a mesma identidade visual (paleta, tipografia, marca YaID) já usada nas demais
páginas públicas do produto (`/v/[sessionToken]`, `/docs`)
```

**Frontmatter de `epics.md`** — nova entrada em `sprintChangeRuns` (após a do Epic 12, mesma
data):

```yaml
  - date: '2026-08-22'
    approach: 'Novo Epic 13 (Landing Page Institucional) — landing pública assume a rota "/";
      dashboard (Overview) migra para "/dashboard". Independente do Epic 12 (/docs), mas os
      dois se referenciam no conteúdo.'
    decisions: 'Usuário autenticado em "/" é redirecionado para "/dashboard"; demais rotas do
      dashboard (/apps, /proof-requests, /settings) não mudam de URL; landing usa apenas o
      layout global (mesmo padrão de /v/[sessionToken]), sem layout próprio adicional; 2
      stories (13.1 migração de rota/middleware, 13.2 conteúdo da landing).'
```

---

### 4.3 sprint-status.yaml

Nova entrada em `development_status` (Epic 13 como `backlog`):

```yaml
  # Epic 13: Landing Page Institucional (Sprint Change 2026-08-22)
  epic-13: backlog
  13-1-mover-dashboard-para-dashboard-e-ajustar-middleware: backlog
  13-2-pagina-publica-landing-institucional: backlog
  epic-13-retrospective: optional
```

---

## 5. Handoff de Implementação

**Classificação de escopo: Moderate** — novo epic com novas stories exige reorganização de
backlog (registro em `sprint-status.yaml`); embora não altere schema, contratos de API externos
nem o core de negócio do MVP, a Story 13.1 mexe em uma rota já existente e protegida
(middleware, redirects, sidebar), o que exige atenção extra na revisão de código e na suíte de
testes — por isso não é classificado como Minor.

**Rota de handoff:** Product Owner / Developer agent.

- **Responsabilidade do PO:** validar que o Epic 13 não compete com o Epic 12 (não compete — são
  independentes) e confirmar a ordem sugerida (13.1 antes de 13.2, já que 13.2 depende da rota
  `/` estar livre).
- **Responsabilidade do Dev:** implementar as Stories 13.1 e 13.2 via `bmad-create-story` →
  `bmad-dev-story` → `bmad-code-review`, seguindo o fluxo padrão do projeto. Story 13.1 deve
  rodar a suíte de testes completa antes de avançar para 13.2, dado que altera middleware
  compartilhado por todas as rotas do dashboard.

**Critério de sucesso:** `/` acessível sem login exibindo a landing institucional; usuário
autenticado que acessa `/` vai para `/dashboard`; `/dashboard` e demais rotas do dashboard
continuam protegidas exatamente como hoje; nenhuma regressão nos fluxos de sign-in/sign-up.

---

## 6. Aprovação

- [x] Aprovado por Victordegasperi para implementação (2026-08-22)
