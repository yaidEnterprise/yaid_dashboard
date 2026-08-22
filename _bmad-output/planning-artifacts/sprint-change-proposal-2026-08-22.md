# Sprint Change Proposal — 2026-08-22

**Projeto:** yaid_dashboard
**Solicitante:** Victordegasperi
**Modo:** Batch

---

## 1. Resumo do Issue

**Trigger:** novo requisito de stakeholder (não originado de uma story em execução).

**Problema:** empresas parceiras que integram com a YaID não têm hoje nenhum material de
autoatendimento explicando como usar a plataforma para integração — como criar conta/app no
dashboard, a diferença de comportamento entre apps de `homologação` e `produção`, e como
disparar uma solicitação de verificação (`proof_request`). Essa informação hoje só existe
espalhada no PRD/Architecture (documentos internos, não voltados à empresa parceira), o que
gera fricção de onboarding e depende de suporte manual.

**Evidência:** solicitação direta do usuário; confirmado por leitura do PRD/epics.md/estrutura
de rotas (`app/(dashboard)/*`, `app/sign-in`, `app/sign-up`, `app/v/[sessionToken]`) — não existe
hoje nenhuma rota ou seção de documentação pública voltada à empresa integradora.

**Decisão de escopo tomada com o usuário:** a documentação vive em uma **página pública
separada** (`/docs`), fora do grupo `(dashboard)`, sem autenticação — seguindo o mesmo padrão
arquitetural já usado pela tela coringa (`/v/[sessionToken]`): layout independente, sem
sidebar/topbar do dashboard.

---

## 2. Análise de Impacto

### Epics

- Nenhum epic existente (1–11) precisa ser alterado ou é invalidado — todos permanecem
  intocados (todos já `done`).
- Novo epic necessário: **Epic 12 — Documentação Pública de Integração**. Não depende de nenhum
  epic futuro; referencia comportamento já implementado nos Epics 1, 2, 3, 6 e 7 (não requer
  nenhuma API nova).
- Ordem: sem restrição — pode ser desenvolvido a qualquer momento, já que documenta features
  concluídas.

### PRD

- Conflito: nenhum. É aditivo.
- Novo requisito funcional (FR35) e nova seção descritiva ("Documentação pública de
  integração"), análoga em nível de detalhe às seções "Tela coringa" e "Telas do dashboard".
- MVP: não é redefinido nem reduzido — adição pura, no mesmo espírito dos Epics 7/8/9/10/11
  (infraestrutura/hardening aditivos ao MVP original).

### Architecture

- Nova rota pública `app/docs/` (Route Handler não é necessário — conteúdo estático,
  server component). Segue o mesmo padrão de "página pública sem middleware de auth" já
  documentado para `/v/[sessionToken]` e `GET /api/webhook-public-key`.
- Nenhuma API nova. Nenhuma mudança de schema, autenticação ou integração.

### UI/UX

- Novo padrão de layout: página de documentação com navegação por seções/âncoras, reaproveitando
  os componentes já existentes `CodeBlock`/`InlineCode` (usados hoje no dashboard) para trechos
  de código com botão de copiar. Não há wireframe formal no UX Spec para isso — será definido na
  implementação da Story 12.1 seguindo a paleta/tipografia já estabelecidas.

### Outros artefatos

- Testes: cobertura mínima (renderização da página, presença das seções, sem lógica de negócio
  nova).
- CI/CD, infraestrutura, deployment: sem impacto — é apenas uma rota estática a mais no mesmo
  build do Next.js.

---

## 3. Caminho Recomendado

**Opção escolhida: Ajuste Direto (Option 1)** — novo epic + 2 novas stories dentro da estrutura
atual, sem rollback e sem revisão de escopo do MVP.

- Esforço: **Baixo-Médio** (uma rota nova + conteúdo; nenhuma API nova).
- Risco: **Baixo** (aditivo, não toca em nenhum fluxo existente).
- Rollback (Option 2): não avaliado como viável — não há nada a reverter, o issue não decorre de
  trabalho já feito.
- Revisão de MVP (Option 3): não necessária — não reduz nem redefine escopo.

---

## 4. Propostas de Mudança Detalhadas

### 4.1 PRD (`_bmad-output/planning-artifacts/prd.md`)

**Nova subseção**, inserida após "### Tela coringa" e antes de "### APIs":

```
### Documentação pública de integração

- Rota pública `/docs` (fora do grupo `(dashboard)`, sem middleware de auth, layout
  independente — mesmo padrão de página pública da tela coringa), com marca YaID e navegação
  por seções/âncoras: Visão geral · Criando sua conta e seu primeiro app · Ambientes
  (Homologação vs Produção) · Solicitando uma Proof Request · Webhooks.
- Reaproveita os componentes `CodeBlock`/`InlineCode` já existentes no dashboard para os
  exemplos de código, com botão de copiar.
- Conteúdo é estático (sem dados dinâmicos de company) — nenhuma API nova é necessária.
- Todo exemplo de API key/segredo usa placeholder fictício (nunca uma chave real).
```

**Novo requisito funcional**, adicionado ao final da lista de Functional Requirements:

```
FR35: O sistema deve expor uma página pública de documentação (`/docs`, sem autenticação,
layout independente) orientando a empresa parceira a: (a) criar conta e primeiro app pelo
dashboard, incluindo a escolha de ambiente; (b) entender a diferença de comportamento entre
apps de homologação (review manual disponível) e produção (sem review manual); (c) criar uma
proof_request via API (`POST /api/proof-requests`) ou pelo helper do dashboard; (d) verificar a
assinatura Ed25519 dos webhooks recebidos usando `GET /api/webhook-public-key`.
```

**FR Coverage Map**, nova linha:

```
FR35: Epic 12 — Página pública de documentação de integração
```

**Cabeçalho do documento** — nova linha de revisão:

```
> **Última atualização:** 2026-08-22 (Sprint Change 2026-08-22 — Epic 12: página pública de
> documentação de integração para empresas parceiras. Aditivo; núcleo e MVP inalterados)
```

E entrada correspondente em `editHistory` no frontmatter.

---

### 4.2 Epics (`_bmad-output/planning-artifacts/epics.md`)

**Novo epic na Epic List:**

```
### Epic 12: Documentação Pública de Integração

Empresa parceira encontra, sem precisar de login, um guia passo a passo de como integrar seu
sistema com a YaID: criar conta e app pelo dashboard, entender a diferença entre ambientes de
homologação e produção, disparar uma proof_request e verificar a assinatura dos webhooks
recebidos.

**FRs cobertos:** FR35
```

**Nova seção de epic completa**, com 2 stories:

```
## Epic 12: Documentação Pública de Integração

### Story 12.1: Estrutura da Página e Seção "Conta e Apps"

Como desenvolvedor,
Quero uma página pública `/docs` com layout independente e navegação por seções,
Para que empresas parceiras acessem um guia de integração sem precisar de login.

**Acceptance Criteria:**

**Given** a rota `/docs` (fora do grupo `(dashboard)`, sem sidebar/topbar do dashboard, layout
próprio com marca YaID)
**When** acessada sem autenticação
**Then** a página carrega normalmente (rota pública, sem middleware de auth)
**And** exibe navegação por seções/âncoras: "Visão geral", "Criando sua conta e seu primeiro
app", "Ambientes: Homologação vs Produção", "Solicitando uma verificação (Proof Request)",
"Webhooks"
**And** usa os componentes `CodeBlock`/`InlineCode` já existentes no dashboard para trechos de
código, com botão de copiar

**Given** a seção "Visão geral"
**When** renderizada
**Then** descreve o fluxo ponta a ponta em alto nível (criar conta → criar app → obter API key
→ chamar `POST /api/proof-requests` → redirecionar holder → receber webhook)

**Given** a seção "Criando sua conta e seu primeiro app"
**When** renderizada
**Then** documenta passo a passo: cadastro em `/sign-up` (email, senha, nome da empresa, CNPJ),
criação de app em `/apps/new` (nome, webhook opcional, seleção de ambiente), captura obrigatória
da API key exibida uma única vez no modal

**Given** a seção "Ambientes: Homologação vs Produção"
**When** renderizada
**Then** explica que o ambiente é escolhido na criação do app e é imutável no MVP; que apps de
homologação permitem aprovação/reprovação manual da proof_request pelo dashboard
(`Aprovar`/`Reprovar`), enquanto apps de produção dependem exclusivamente do fluxo real do
holder; reforça que não há isolamento de dados entre ambientes (uma proof_request é "real" em
qualquer ambiente)

---

### Story 12.2: Conteúdo — Proof Requests e Webhooks

Como desenvolvedor,
Quero documentar como a empresa parceira cria proof requests e valida webhooks,
Para que o time de integração da empresa implemente o fluxo sem depender de suporte manual da
YaID.

**Acceptance Criteria:**

**Given** a seção "Solicitando uma verificação (Proof Request)"
**When** renderizada
**Then** documenta a chamada `POST /api/proof-requests` com header `Authorization: Bearer
<api_key>`, body `{ proofType, externalReference? }` e exemplo de request/response com
`verificationUrl`
**And** documenta o helper `/proof-requests/new` no dashboard como alternativa para testes
manuais (sem precisar de sistema externo)
**And** documenta os status possíveis da proof_request e seu significado (`waiting_user`,
`opened`, `approved`, `rejected`, `expired`)

**Given** a seção "Webhooks"
**When** renderizada
**Then** documenta o payload do webhook, os headers `X-YaID-Signature` + `X-YaID-Timestamp`, e o
passo a passo para buscar a chave pública em `GET /api/webhook-public-key` e verificar a
assinatura Ed25519
**And** inclui exemplo de código (Node.js) de verificação de assinatura
**And** reforça que a YaID nunca envia VC, VP ou dado pessoal do holder no webhook — apenas
`valid: true|false` e metadados

**Given** qualquer trecho de código nas duas stories deste epic
**When** exibido
**Then** usa dados de exemplo fictícios (nunca uma API key real) e placeholders claramente
identificáveis (ex: `sk_live_xxx`)
```

**Frontmatter de `epics.md`** — nova entrada em `sprintChangeRuns`:

```yaml
  - date: '2026-08-22'
    approach: 'Novo Epic 12 (Documentação Pública de Integração) — página pública /docs, sem
      auth, layout independente (mesmo padrão da tela coringa). Aditivo, não altera Epics 1–11.'
    decisions: 'Página única com navegação por âncoras (não um subsistema multi-página de
      docs); conteúdo estático reaproveitando CodeBlock/InlineCode já existentes; 2 stories
      (12.1 estrutura + conta/apps, 12.2 proof requests + webhooks).'
```

---

### 4.3 sprint-status.yaml

Nova entrada em `development_status` (Epic 12 como `backlog`, refletindo o checklist item 6.4
deste workflow):

```yaml
  # Epic 12: Documentação Pública de Integração (Sprint Change 2026-08-22)
  epic-12: backlog
  12-1-estrutura-da-pagina-e-secao-conta-e-apps: backlog
  12-2-conteudo-proof-requests-e-webhooks: backlog
  epic-12-retrospective: optional
```

---

## 5. Handoff de Implementação

**Classificação de escopo: Moderate** — novo epic com novas stories exige reorganização de
backlog (registro em `sprint-status.yaml`), mas não altera arquitetura, contratos de API nem o
core do MVP.

**Rota de handoff:** Product Owner / Developer agent.

- **Responsabilidade do PO:** validar que a numeração/sequenciamento do Epic 12 no backlog está
  correto e que não compete por prioridade com nenhum epic ainda em aberto (não há nenhum).
- **Responsabilidade do Dev:** implementar as Stories 12.1 e 12.2 via `bmad-create-story` →
  `bmad-dev-story` → `bmad-code-review`, seguindo o fluxo padrão do projeto.

**Critério de sucesso:** `/docs` acessível sem login, com as 5 seções descritas, reaproveitando
componentes existentes, sem nenhuma regressão nas rotas/epics já concluídos.

---

## 6. Aprovação

- [x] Aprovado por Victordegasperi para implementação (2026-08-22)
