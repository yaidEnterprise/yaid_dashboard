---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-11'
revisedAt: '2026-08-09'
inputDocuments:
  - docs/prd.md
  - CONTEXT.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-27.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-08.md
workflowType: 'architecture'
project_name: 'yaid_dashboard'
user_name: 'Victordegasperi'
date: '2026-05-11'
editHistory:
  - date: '2026-07-27'
    changes: 'Correct Course — edição direcionada: versionamento de schema via Supabase Migrations (baseline + forward); company.can_create_apps (allowlist); company_apps.environment (homol/prod); proof_requests.updated_at reforçado em toda transição; endpoint/usecase de review manual em homologação; VC emitida como VC-JWT (EdDSA); guard de allowlist no CreateCompanyAppUseCase.'
  - date: '2026-07-28'
    changes: 'Correct Course — edição direcionada na seção Credenciais & Formato da VC: claims consolidadas (personhood + ageOver18 na mesma emissão); ageOver18 pode ser false e menoridade deixa de retornar 422; correspondência obrigatória claim ↔ proof_type na verificação da VP; proofType removido do contrato de POST /api/credentials/issue; enum ProofType compartilhado. Sem impacto em schema, blockchain ou camadas.'
  - date: '2026-07-28'
    changes: 'Correct Course (adendo §7) — Regras Obrigatórias: environments.ts entrega valores prontos (proibido remendar configuração no ponto de uso); formato de chave validado no boot e não em runtime; placeholders de TEST_ENV recusados fora do stage TEST. Origem: quatro consumidores substituindo chaves de teste localmente. Epic 10 criado.'
  - date: '2026-08-08'
    changes: 'Correct Course (Sprint Change 2026-08-08) — edição direcionada na seção Infraestrutura & Deploy: CI/CD de produção passa a modelo orquestrado pelo GitHub Actions na branch prod (gates sequenciais tests → deploy-supabase → deploy-amplify → smoke-test), com auto-build do Amplify desabilitado na branch prod; migrations via supabase db push (com --dry-run) antes do deploy do app (expand→deploy→contract); autenticação AWS via IAM sts:AssumeRole least-privilege; health check público GET /api/health com whitelisting em middleware.ts. Epic 11 introduzido. Sem impacto em schema, camadas, blockchain ou stack.'
  - date: '2026-08-09'
    changes: 'Correct Course (Sprint Change 2026-08-09) — Infraestrutura & Deploy: sync de env vars no Amplify passa de merge para AUTORITATIVO derivado do .env.local.example (replace via update-branch; nomes vêm do .env.local.example, valores resolvidos pela colocação Secrets→Variables; classificação KEY|PASSWORD|PRIVATE|SECRET|TOKEN com exceções NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY→Variable e BLOCKCHAIN_RPC_URL→Secret; secret AMPLIFY_ENVIRONMENT_VARIABLES removido). Regra nova: YAID_VERIFICATION_BASE_URL deixa de ser env var e é derivada como ${NEXT_PUBLIC_APP_URL}/v em environments.ts. Story 11.8 criada; Epic 11 reaberto. Sem impacto em schema, camadas, blockchain ou stack.'
---

# Architecture Decision Document

_Este documento é construído colaborativamente através de descoberta passo a passo. Seções são adicionadas conforme avançamos em cada decisão arquitetural juntos._

> **Revisão 2026-08-09 (Correct Course — Sprint Change Proposal 2026-08-09):** edição direcionada na
> seção *Infraestrutura & Deploy* e nas *Regras Obrigatórias*. O sync de env vars no Amplify passa de
> **merge** para **autoritativo derivado do `.env.local.example`** (replace via `update-branch`;
> valores resolvidos pela colocação Secrets→Variables; classificação por
> `KEY|PASSWORD|PRIVATE|SECRET|TOKEN` com exceções `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`→Variable e
> `BLOCKCHAIN_RPC_URL`→Secret). `YAID_VERIFICATION_BASE_URL` deixa de ser env var e é derivada como
> `${NEXT_PUBLIC_APP_URL}/v`. Story 11.8 criada; Epic 11 reaberto. Infraestrutura de entrega — sem
> impacto em schema, camadas, blockchain ou stack.
>
> **Revisão 2026-08-08 (Correct Course — Sprint Change Proposal 2026-08-08):** edição
> direcionada na seção *Infraestrutura & Deploy*. O release de produção passa a ser **orquestrado pelo
> GitHub Actions** na branch `prod`, com gates sequenciais `tests → deploy-supabase → deploy-amplify →
> smoke-test`; o **auto-build do Amplify é desabilitado** na branch `prod` (evita deploy duplicado);
> migrations aplicadas via `supabase db push` (com `--dry-run`) antes do deploy do app
> (expand→deploy→contract); autenticação AWS via IAM `sts:AssumeRole` least-privilege; health check
> público `GET /api/health` (whitelisting em `middleware.ts`). Introdução do **Epic 11** (pipeline de
> CI/CD de produção). Infraestrutura de entrega, aditiva — núcleo e MVP do produto permanecem intactos;
> sem impacto em schema, camadas, blockchain ou stack.
>
> **Revisão 2026-07-28 (Correct Course — Sprint Change Proposal 2026-07-28):** edição
> direcionada na seção *Credenciais & Formato da VC*. Claims consolidadas em uma única emissão,
> `ageOver18` podendo ser `false` (menoridade deixa de ser 422), correspondência obrigatória entre
> a claim apresentada e o `proof_type` solicitado, e remoção de `proofType` do contrato de emissão.
> Sem impacto em schema, blockchain ou separação de camadas.
>
> **Revisão 2026-07-27 (Correct Course — Sprint Change Proposal 2026-07-27):** edição
> direcionada sobre a arquitetura já finalizada. Mudanças de schema (`company.can_create_apps`,
> `company_apps.environment`, `proof_requests.updated_at`), versionamento via Supabase Migrations,
> endpoint/usecase de review manual em homologação, guard de allowlist e VC entregue como VC-JWT
> (EdDSA). As demais decisões permanecem válidas e inalteradas.

## Análise de Contexto do Projeto

### Visão Geral dos Requisitos

**Requisitos Funcionais:**

O sistema entrega cinco domínios funcionais integrados em uma única codebase Next.js:

1. **Gestão Empresarial** — Cadastro atômico (auth.users + public.company em uma transação única), CRUD de company_apps com revelação one-shot de API key, settings de webhook por app. Invariante central: toda sessão autenticada pressupõe company existente — não existe estado intermediário.

2. **Proof Requests (API B2B)** — Empresa parceira cria proof_request via API key, recebe verification_url e deep_link_url (derivadas, não persistidas), aguarda webhook assinado ou polling. Proof_type é enum de valor único (`personhood` | `age_over_18`). Ciclo de vida: `pending_user → processing → approved | rejected | expired`.

3. **Tela Coringa de Verificação** — Página pública em `/v/[sessionToken]` que guia o holder a abrir o app mobile. Seis estados visuais. Polling em `GET /api/proof-sessions/{token}` a cada 5–10s nas fases ativas. Mobile destaca deep link; desktop exibe QR code.

4. **Fluxos do App Mobile (backend-side)** — Emissão de VC (OCR em memória → assinatura Ed25519 → registro DID on-chain → retorno ao app → descarte de PII), verificação de VP (validação de assinatura holder + issuer + claims + revogação on-chain + challenge/nonce), revogação (registro de `hash(vc_id)` on-chain).

5. **Dashboard B2B** — Overview com métricas, listagem e detalhes de apps e proof_requests sem filtros ou paginação (MVP busca tudo), settings de company. Desktop-first, PT-BR fixo.

**Requisitos Não-Funcionais:**

- **Privacidade do holder** (não-negociável): zero PII em tabela relacional; apenas blockchain registra DID e hash de revogação; VC carrega apenas claims booleanos.
- **Segurança de chaves**: API key nunca em texto puro (hash SHA-256); três chaves privadas distintas sem reuso entre papéis; replay protection em auth mobile (janela ±5min).
- **Webhook assimétrico**: assinatura Ed25519 (não HMAC) — consequência direta de API key nunca estar em texto puro no backend.
- **Auditabilidade mínima**: timeline de proof_requests; blockchain como registro imutável de DIDs e revogações.
- **Demonstrabilidade acadêmica** (TCC): fluxo ponta a ponta funcional e defensável sob exame de banca.

**Escala e Complexidade:**

- Domínio primário: full-stack Next.js App Router (RSC + Route Handlers)
- Complexidade: **alta** — identidade descentralizada + blockchain + múltiplos clientes API + criptografia aplicada
- Componentes arquiteturais estimados: ~8 módulos de domínio (company, company-app, proof-request, proof-session, identity/credentials, blockchain, webhook, auth)

### Restrições e Dependências Técnicas

- **Supabase** — Auth e PostgreSQL. Auth user UUID === company UUID (vínculo estrutural, não coluna adicional).
- **Blockchain** — A integração com blockchain **deve existir**, mas os detalhes de implementação estão em aberto: qual client library usar, como tratar latência on-chain, estratégia de retry em falha de transação, como lidar com reorganizações de bloco, e separação entre ambiente de dev (local) e testnet. **⚠️ TBD: agente responsável pela integração deve questionar todos esses pontos antes de implementar.**
- **Criptografia e assinaturas** — O sistema usa assinaturas digitais em múltiplos contextos (emissão de VC, autenticação mobile, webhook). Os algoritmos e bibliotecas concretas para cada contexto **estão em aberto**. **⚠️ TBD: agente responsável deve questionar algoritmo por papel, biblioteca a usar, e estratégia de gestão de chaves antes de implementar.**
- **OCR** — Provider TBD (Google Vision, AWS Textract, IDWall etc.); integração em memória obrigatória.
- **Next.js App Router** — RSC para dashboard; Route Handlers para todas as APIs; sem pages router.
- **Arquitetura em camadas existente** — route handler → controller → use case → repository/service → infra; módulos por domínio já estabelecidos.

### Preocupações Transversais Identificadas

1. **Autenticação multi-modal** — Quatro mecanismos distintos mapeados para quatro conjuntos de rotas sem sobreposição. Middleware ou guard por rota precisa ser explícito e sem ambiguidade.
2. **Gestão de chaves privadas** — Três chaves em env vars com papéis não-intercambiáveis; validação obrigatória no boot do servidor.
3. **Integração blockchain** — Duas escritas (emissão + revogação) e leituras em cada verificação; latência on-chain afeta tempo de resposta do fluxo de verificação.
4. **Privacidade do holder** — Constraint arquitetural que exclui inteiramente qualquer persistência relacional do holder; precisa ser reforçada em code review e testes.
5. **Rastreabilidade de proof_requests** — Timeline de status changes (proof_request + proof_session) precisa ser consistente e auditável sem expor dados do holder.

## Fundação Tecnológica

### Domínio Tecnológico Primário

Full-stack Next.js (App Router + Route Handlers) — projeto já inicializado, sem starter externo.

### Stack Estabelecido

**Runtime & Framework:**
- Next.js 16.2.4 (App Router, sem Pages Router)
- React 19.2.4
- TypeScript 5

**Estilização:**
- Tailwind CSS 4
- clsx + tailwind-merge para composição de classes
- Lucide React para ícones

**Backend & Dados:**
- Supabase SSR (`@supabase/ssr`) para auth server-side e cliente de banco
- Supabase JS (`@supabase/supabase-js`) para operações client-side
- Zod 4 para validação de schemas

**UX & Feedback:**
- Sonner para sistema de toasts (bottom-right global)

**Tooling:**
- ESLint 9 + eslint-config-next para lint
- PostCSS + @tailwindcss/postcss

### Decisões Arquiteturais Estabelecidas pelo Stack

- **Tipagem estática** em todo o projeto via TypeScript
- **Validação de entrada** centralizada com Zod (schemas compartilhados entre frontend e backend)
- **Auth server-side** via Supabase SSR (cookies, sem exposição de tokens no client)
- **Estilização utilitária** com Tailwind 4 (sem CSS-in-JS)
- **Sem ORM** — queries diretas via Supabase client

### Decisões de Escopo do MVP

- **Tela coringa** exibe um botão que redireciona para o deep link `yaid://verify?session=<token>` — sem QR code, sem exibição de URL bruta.

### Dependências a Adicionar (identificadas pelo PRD)

As seguintes dependências são necessárias mas ainda não instaladas:

- **Biblioteca de criptografia** — para assinaturas digitais (issuer, webhook, auth mobile) — **⚠️ TBD: agente responsável deve questionar qual biblioteca usar**
- **Client blockchain** — para integração com smart contract — **⚠️ TBD: agente responsável deve questionar qual client usar**
- **OCR SDK** — provider a definir — **⚠️ TBD: ver seção de TBDs no PRD**

## Decisões Arquiteturais Centrais

### Análise de Prioridades

**Decisões Críticas (bloqueiam implementação):**
- Middleware de auth global por prefixo de rota
- Shape de erro padronizado `{ error: string }`
- React Hook Form como biblioteca de formulários

**Decisões Importantes (moldam a arquitetura):**
- SHA-256 para hash de API key
- Fetch wrapper customizado com 401-redirect
- GitHub Actions orquestra o release em `prod` (gates sequenciais); Amplify com auto-build desabilitado

**Decisões Deferidas (pós-MVP):**
- Monitoramento externo (Sentry, Datadog etc.) — implementar somente se houver tempo

---

### Arquitetura de Dados

- **Migrations (versionamento de schema):** **Supabase Migrations** via CLI, com o diretório
  `supabase/` versionado (`config.toml`, `migrations/`, `seed.sql`). A CLI é linkada ao
  project-ref `lygkwhcwsrxfozswhxyo`. Um **baseline** (`supabase db pull`) captura o schema
  hoje deployado — encerrando o drift entre código e base — e cada mudança estrutural posterior
  passa a ser um arquivo de migration timestampado. Fluxo: `supabase db reset` (local) →
  `supabase db push` (remoto); CI opcional roda `supabase db diff --check` no PR. SQL manual
  pelo dashboard do Supabase **deixa de ser** a fonte estrutural. `.gitignore` cobre
  `supabase/.branches` e `supabase/.temp`.
  - **Forward migrations do Sprint Change:** `add_updated_at_to_proof_requests`,
    `add_can_create_apps_to_company` (+ backfill `true` para empresas existentes) e ajuste de
    `environment`/default em `company_apps`. O baseline reflete o schema atual (que carrega o
    drift real — `validated_at`/`external_ref`/`result`, sem `updated_at`); as forward migrations
    reconciliam o banco com o schema-alvo descrito abaixo.
- **Caching:** Nenhum — MVP busca tudo diretamente do banco.
- **Isolamento:** Server-side por `company_id` nas queries — sem RLS no MVP.
- **ORM:** Nenhum — queries diretas via Supabase client.

### Autenticação & Segurança

- **Hash de API key:** SHA-256 — mantém implementação atual. Adequado para keys longas e aleatórias.
- **Proxy de auth:** `proxy.ts` global (convenção Next.js 16) com roteamento por prefixo de rota. A lógica vive em `src/shared/middleware.ts` e cada mecanismo de auth (sessão Supabase, API key, DID signature, session token) é resolvido pelo prefixo correspondente.

### Credenciais & Formato da VC

- **Emissão da VC como VC-JWT (EdDSA):** o módulo `identity` (`issue_credential_usecase`) emite a
  Verifiable Credential como **JWT compacto assinado** (JWS EdDSA), não mais como JSON-LD com
  `proof.Ed25519Signature2020` embutido. Header `{alg:"EdDSA", typ:"JWT", kid:"<issuerDid>#key-1"}`;
  payload `{iss, sub:<holderDid>, jti, iat, nbf, vc:{...claims booleanos}}`, assinado com
  `ISSUER_PRIVATE_KEY`. `POST /api/credentials/issue` retorna a **string JWT**.
- **Verificação:** `verify_presentation_usecase` (módulo `presentation`) decodifica e valida a VC no
  formato JWT (assinatura do issuer via public key off-chain + claims booleanos + lookup on-chain de
  DID/revogação). A VP carrega a VC-JWT inteira; como a VC só tem booleanos, não há vazamento de PII.
- **Invariante preservado:** a VC continua carregando apenas claims booleanos derivados
  (`personhood`, `ageOver18`) — nunca PII. A mudança é de **formato de serialização/assinatura**, não
  de conteúdo. Coordenação externa necessária com a codebase do app mobile YaID Wallet.

#### Semântica das claims (Sprint Change 2026-07-28)

- **Claims consolidadas:** uma única emissão produz **ambas** as claims —
  `{ personhood: true, ageOver18: <boolean> }`. Não existe VC com claim isolada. O holder envia o
  documento uma vez e a credencial resultante responde às duas perguntas.
- **`ageOver18` pode ser `false`.** Menoridade não é falha de processamento: a emissão conclui com
  201 e o holder recebe `personhood: true, ageOver18: false`. O 422 fica reservado a falha real de
  OCR (documento ilegível, ou sem nome/CPF/data de nascimento) e a data de nascimento não parseável
  — não se afirma `false` quando a idade é desconhecida.
- **Contrato de entrada:** `POST /api/credentials/issue` recebe `{ documentImage, bodySignature }`.
  O campo `proofType` **não é aceito** — com claims consolidadas ele não seleciona mais nada. O
  payload assinado pelo holder é apenas `documentImage`.
- **Correspondência claim ↔ proof_type na verificação (obrigatória):** o
  `verify_presentation_usecase` carrega a `proof_request` da sessão, mapeia seu `proof_type` para a
  chave de claim e exige que a claim **exista e valha exatamente `true`**. Validar apenas que as
  claims são booleanas é insuficiente — aprovaria a credencial de um menor de idade em um pedido de
  `age_over_18`. Claim ausente nunca é aprovação.
- **Enum compartilhado:** criar `src/shared/domain/enums/ProofType.ts` (previsto na estrutura de
  diretórios abaixo, mas inexistente na codebase). É o único lugar do mapeamento
  `age_over_18` ↔ `ageOver18`, consumido por emissão e verificação.
- **Acoplamento de entrega:** a consolidação de claims e a correspondência claim ↔ proof_type
  (Stories 5.7 e 5.8) **não podem ser liberadas separadamente** — a primeira sem a segunda introduz
  a falha descrita acima.

### API & Comunicação

- **Shape de erro:** `{ error: string }` com HTTP status code adequado — mínimo e consistente.
- **Webhook:** tentativa única, falha logada. Sem retry no MVP.
- **Rate limiting:** nenhum no MVP.

### Arquitetura Frontend

- **Estado client-side:** `useState` / `useReducer` nativos — sem biblioteca externa.
- **Formulários:** React Hook Form + Zod via `zodResolver` — adicionar `react-hook-form` como dependência.
- **Fetch wrapper:** `fetchWithAuth` customizado — intercepta 401 e redireciona para `/sign-in?next=<path>`.

### Infraestrutura & Deploy

- **Hospedagem:** AWS Amplify (app **SSR / Web Compute** — `baseDirectory: .next`, não static export).
- **CI/CD (produção):** o **GitHub Actions é o ORQUESTRADOR** do release na branch `prod`, com gates
  sequenciais (`needs`): `tests → deploy-supabase → deploy-amplify → smoke-test`. O **auto-build do
  Amplify na branch `prod` é DESABILITADO** (`enableAutoBuild=false`) para evitar deploy duplicado; a
  integração GitHub↔Amplify é preservada (o Amplify continua buscando o código). Migrations são
  aplicadas via Supabase CLI (`db push`, precedido de `--dry-run`) **antes** do deploy do app,
  seguindo **expand→deploy→contract**. A autenticação AWS usa IAM bootstrap → `sts:AssumeRole` → IAM
  Role de deploy **least-privilege** (OIDC indisponível). Lint/typecheck permanecem como validação (o
  build Next.js no Amplify executa o typecheck). **Sync de env vars (revisão 2026-08-09):** é
  **autoritativo e derivado do `.env.local.example`** — a pipeline extrai dele a lista canônica de
  **nomes** e, para cada nome, resolve o valor pela **colocação no GitHub** (procura em Secrets →
  senão em Variables), enviando o mapa completo via `aws amplify update-branch`, que **substitui o
  mapa inteiro** (replace). Toda variável do `.env.local.example` passa a existir no Amplify; qualquer
  variável **fora** dessa lista **desaparece** do branch. A regra `KEY|PASSWORD|PRIVATE|SECRET|TOKEN`
  orienta a colocação (Secret vs Variable), com exceções: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` →
  Variable (pública) e `BLOCKCHAIN_RPC_URL` → Secret (embute API key do RPC). Secrets server-side
  nunca viram `NEXT_PUBLIC_*` nem aparecem em logs; secrets de infra (AWS_*, SUPABASE_ACCESS_TOKEN,
  AMPLIFY_*) são filtrados fora por não constarem no `.env.local.example`. Estrutura distribuída:
  cada job vive em `.github/jobs/<nome>/action.yml` (composite action), orquestrado por
  `.github/workflows/production.yml`.
- **Health check:** `app/api/health/route.ts` — endpoint público e leve (`force-dynamic`, sem
  DB/secrets, retorna `{ status: "ok" }`), liberado em `src/shared/middleware.ts` (`isPublicApiRoute`).
  Usado como validação pós-deploy (`GET /api/health` com retries no gate `smoke-test`).
- **Monitoramento:** ⚠️ TBD pós-MVP — serviço externo (Sentry, Datadog etc.) somente se houver tempo. CloudWatch/Amplify logs como fallback mínimo.

## Schema do Banco de Dados

Quatro tabelas centralizadas — todas sobre o lado empresarial. Nenhuma tabela sobre o holder.

```sql
-- company
-- id = auth.users.id (mesmo UUID — vínculo estrutural, sem coluna auth_user_id separada)
CREATE TABLE company (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  document_number TEXT NOT NULL,                       -- CNPJ obrigatório no cadastro
  status      TEXT NOT NULL DEFAULT 'active',          -- active | inactive
  can_create_apps BOOLEAN NOT NULL DEFAULT false,      -- allowlist de criação de apps (tipo assinatura, sem Stripe); backfill true p/ empresas existentes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- company_apps
CREATE TABLE company_apps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES company(id),
  name          TEXT NOT NULL,
  app_id        TEXT NOT NULL UNIQUE,   -- parte pública da API key (exibida no dashboard)
  api_key_hash  TEXT NOT NULL,          -- SHA-256 de "<app_id>.<secret>" — secret nunca persiste
  webhook_url   TEXT,                   -- nullable: empresa pode não configurar webhook
  environment   TEXT NOT NULL DEFAULT 'homol',    -- homol | prod — escolhido na criação; homol habilita review manual
  status        TEXT NOT NULL DEFAULT 'active',   -- active | disabled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- proof_requests
-- Ciclo de vida: pending_user → processing → approved | rejected | expired
CREATE TABLE proof_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES company(id),      -- para isolamento por company
  app_id              UUID NOT NULL REFERENCES company_apps(id),
  proof_type          TEXT NOT NULL,   -- personhood | age_over_18
  external_reference  TEXT,            -- nullable: referência da empresa parceira
  status              TEXT NOT NULL DEFAULT 'pending_user',
  return_url          TEXT,            -- ⚠️ TBD: URL de retorno após sucesso na tela coringa
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()        -- atualizado em cada transição de status
);

-- proof_sessions
-- Criada 1:1 junto da proof_request. session_token bruto só existe no momento da criação.
-- Ciclo de vida: waiting_user → opened → approved_by_user | expired | cancelled
-- verification_page_url e deep_link_url NÃO persistem — derivadas do token na resposta.
CREATE TABLE proof_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_request_id      UUID NOT NULL REFERENCES proof_requests(id),
  session_token_hash    TEXT NOT NULL UNIQUE,  -- hash do token bruto
  challenge_nonce_hash  TEXT,                  -- nullable até o holder abrir a sessão
  challenge_created_at  TIMESTAMPTZ,           -- nullable até o holder abrir a sessão
  expires_at            TIMESTAMPTZ NOT NULL,  -- created_at + 30 minutos (hardcoded)
  status                TEXT NOT NULL DEFAULT 'waiting_user',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Invariantes do Schema

- `company.id === auth.users.id` — toda sessão autenticada tem company; estado "usuário sem company" não existe.
- `api_key_hash` nunca contém o secret — apenas `SHA-256("<app_id>.<secret>")`.
- `session_token_hash` — o token bruto é devolvido uma única vez na resposta de criação da proof_request e nunca mais armazenado.
- `challenge_nonce_hash` e `challenge_created_at` — `NULL` enquanto status = `waiting_user`; preenchidos quando o holder abre a sessão.
- `proof_requests.updated_at` — seta `NOW()` em **toda** transição de status (`updateStatus()` grava `status` **e** `updated_at`). É a fonte única do "Atualizada em" no dashboard; nunca mais aliasado de `validated_at`.
- `company.can_create_apps` — gate de allowlist: só empresas com `true` criam apps. Default `false`; empresas pré-existentes recebem `true` via backfill na migration (evita bloqueio retroativo).
- `company_apps.environment` (`homol` | `prod`) — atributo **do app**, não da sessão/company. `homol` habilita review manual de proof_requests; `prod` não. Uma proof_request continua "real" em qualquer ambiente (sem chains/registries separados nem modo mock).
- Nenhuma tabela referencia holder, DID, VC ou VP. Esses dados existem apenas na blockchain e no app mobile.

## Padrão de Arquitetura Backend

Todo código server-side segue a skill `nextjs-backend` — separação estrita de camadas, sem exceções.

### Estrutura de Diretórios

```
src/
  modules/
    {feature}/
      app/
        {action}_{feature}_usecase.ts
        {action}_{feature}_viewmodel.ts
        {action}_{feature}_controller.ts
        {action}_{feature}_presenter.ts

  shared/
    clients/          # wrappers de SDKs externos (OCR, blockchain, DID/VC/VP)
    domain/
      entities/
      enums/
      interfaces/
        repositories/ # interfaces de repositório (ex: CompanyRepository.ts)
                      # qualquer outra interface com equivalente concreto em infra/
                      # (ex: ApiKeyHasher.ts, OcrProvider.ts, BlockchainClient.ts)
    infra/
      dto/            # DTOs de persistência + mappers
      repositories/   # implementações concretas
      providers/
    environments.ts   # único lugar que lê process.env
    errors/
    middlewares/
    config/

app/
  api/
    {resource}/
      route.ts        # rota estática
      [id]/
        route.ts      # rota dinâmica
```

### Responsabilidades por Camada

| Camada | Responsabilidade | Proibido |
|--------|-----------------|----------|
| `route.ts` | Adapter HTTP fino — lê body/params, chama presenter→controller, converte `ControllerResponse` em `NextResponse` | Business logic, DB, `process.env`, SDKs externos |
| **Presenter** | Composition root — lê `environments.ts`, instancia dependências concretas, retorna controller | Business logic, validação, formatação de resposta |
| **Controller** | Valida input, cria DTO de entrada, executa try/catch, mapeia erros esperados para `statusCode` | Business logic, DB, SDKs, instanciar concretos |
| **Use Case** | Lógica de negócio/aplicação — orquestra entidades e interfaces | `NextRequest`/`NextResponse`, `process.env`, infra concreta |
| **ViewModel** | Define shape público da resposta — remove campos sensíveis | Business logic, DB, env vars |
| `shared/domain` | Entidades, enums, interfaces de repositório/provider, erros de domínio | Next.js, DB clients, SDKs, `process.env`, concretos |
| `shared/infra` | Implementações concretas de repositórios, DTOs de persistência, mappers | Business logic, formatação HTTP |
| `shared/clients` | Wrappers de SDKs externos (OCR, blockchain, etc.) | Business logic — use cases dependem de interface, não do client diretamente |
| `environments.ts` | Lê e valida `process.env` no boot, exporta config tipada | Business logic, requests |

### Fluxo Padrão de Request

```
Request → route.ts → presenter() → controller.handle()
→ use case.execute() → interfaces → shared/infra
→ output DTO → viewmodel → ControllerResponse → NextResponse
```

### Convenções de Nomenclatura

Para feature `company`, action `create`:

| Artefato | Caminho |
|----------|---------|
| Use Case | `src/modules/company/app/create_company_usecase.ts` |
| ViewModel | `src/modules/company/app/create_company_viewmodel.ts` |
| Controller | `src/modules/company/app/create_company_controller.ts` |
| Presenter | `src/modules/company/app/create_company_presenter.ts` |
| Interface de repositório | `src/shared/domain/interfaces/repositories/company_repository.ts` |
| Implementação concreta | `src/shared/infra/repositories/company_repository_impl.ts` |
| Entidade | `src/shared/domain/entities/company.ts` |
| Enum | `src/shared/domain/enums/company_status.ts` |
| DTO de persistência | `src/shared/infra/dto/company_dto.ts` |
| Mapper | `src/shared/infra/dto/company_mapper.ts` |

**Classes:** `CreateCompanyUseCase`, `CreateCompanyController`, `CreateCompanyViewModel`, `makeCreateCompanyController`, `CompanyRepositoryImpl`, `CompanyMapper`, `CompanyDTO`

### Regras de Dependência

```
Permitido:
  route.ts → presenter → controller → usecase → shared/domain
  shared/infra → shared/domain (interfaces)
  presenter → environments.ts, shared/infra, shared/clients

Proibido:
  shared/domain → shared/infra
  shared/domain → Next.js
  usecase → NextRequest / NextResponse
  usecase → repositório concreto
  controller → cliente de banco direto
  route.ts → DB / process.env / SDK externo
```

### Separação de DTOs

Manter sempre distintos — nunca passar um onde o outro é esperado:

1. Payload externo de request
2. DTO de entrada do use case
3. Entidade de domínio
4. DTO de persistência
5. DTO de saída do use case
6. ViewModel público

### Estratégia de Erros

- Erros esperados: explícitos e tipados, mapeados no controller para `statusCode`
- Use cases: sem conhecimento de HTTP
- Erros de domínio: sem HTTP status codes
- Erros inesperados: mensagem genérica segura — nunca expor stack trace, secrets, queries SQL
- Shape público de erro: `{ error: string }` (definido no Step 4)

## Padrões de Implementação & Regras de Consistência

### Pontos Críticos de Conflito Identificados

5 áreas onde agentes diferentes poderiam fazer escolhas incompatíveis.

### Padrões de Nomenclatura

**Banco de Dados (PostgreSQL/Supabase):**
- Tabelas: `snake_case`; tabela de empresa é `company` (singular, conforme schema deployado), demais tabelas usam nomes existentes como `company_apps`, `proof_requests`, `proof_sessions`
- Colunas: `snake_case` — `company_id`, `created_at`, `proof_type`
- Chaves estrangeiras: `{entidade}_id` — `company_id`, `app_id`

**Endpoints REST:**
- Plural, kebab-case — `/api/proof-requests`, `/api/company-apps`
- Parâmetros de rota: `[id]`, `[appId]`, `[sessionToken]` (camelCase)
- Headers customizados: `X-YaID-*`

**Código TypeScript:**
- Componentes React: PascalCase — `MetricCard`, `StatusBadge`
- Arquivos de componentes: PascalCase — `MetricCard.tsx`
- Arquivos de módulo/rota: kebab-case — `proof-requests/`, `create_company_usecase.ts`
- Funções e variáveis: camelCase — `companyId`, `createdAt`
- Classes: PascalCase — `CreateCompanyUseCase`, `CompanyRepositoryImpl`
- Interfaces/Types: PascalCase — `CompanyRepository`, `CreateCompanyInput`
- Enums: PascalCase — `ProofType`, `ProofRequestStatus`

### Padrões de Formato

**Respostas de Sucesso da API:**
- Campos em camelCase — ViewModel transforma snake_case do banco
- Datas em ISO 8601 string — `"2026-05-11T21:00:00.000Z"`
- Resposta direta sem wrapper — o corpo é o dado

**Respostas de Erro da API:**
- `{ error: string }` com HTTP status code adequado
- Mensagem genérica para erros inesperados — nunca expor stack trace ou detalhes internos

**Campos booleanos:** `true`/`false` — nunca `1`/`0`

### Padrões de Estrutura

**Testes:** co-locados ao módulo, ao lado dos arquivos de source
**Utilitários compartilhados:** `src/shared/`
**Clientes externos:** `src/shared/clients/`
**Variáveis de ambiente:** somente em `src/shared/environments.ts`

### Padrões de Processo

**Estados de loading:** por componente via `useState` — sem estado de loading global
**Submissão de formulários:** React Hook Form + Zod via `zodResolver`; botão desabilitado durante envio; toast de sucesso/erro via Sonner após conclusão
**Fetch client-side:** `fetchWithAuth` — intercepta 401 e redireciona para `/sign-in?next=<path>`

### Regras Obrigatórias para Todos os Agentes

- `process.env` somente em `src/shared/environments.ts`
- **`environments.ts` entrega valores prontos para uso.** Nenhum use case, provider ou client pode inspecionar, comparar contra placeholder ou substituir valor de configuração no ponto de uso. Se um valor precisa de tratamento para ser utilizável, o tratamento pertence ao `environments.ts` — não ao consumidor. (Sprint Change 2026-07-28: quatro consumidores remendavam chaves de teste localmente.)
- **Formato de chave é validado no boot, não em runtime.** `z.string().min(1)` é insuficiente para chaves criptográficas; o schema valida o formato concreto (hex de 64 caracteres para chaves Ed25519, endereço válido para o contrato). Precedente: `EthersBlockchainClient` já valida `ethers.isAddress` no construtor para "gerar erro acionável no boot, não em tempo de requisição".
- **Placeholders de `TEST_ENV` são recusados fora do stage `TEST`** — são valores publicamente conhecidos e versionados no repositório.
- **`YAID_VERIFICATION_BASE_URL` é derivada, não configurada (revisão 2026-08-09).** Não é uma env
  var própria: `environments.ts` a computa como `${NEXT_PUBLIC_APP_URL}/v`. Não é lida de
  `process.env` nem sincronizada ao Amplify (evita uma variável só para acrescentar `/v`).
- Campos camelCase em todas as respostas da API (ViewModel é responsável pela transformação)
- Datas sempre ISO 8601 nas respostas
- Shape de erro sempre `{ error: string }`
- Nunca retornar entidade de domínio ou DTO de persistência sem ViewModel
- Nunca expor secret, hash de API key, stack trace ou query SQL em resposta pública

## Estrutura do Projeto & Fronteiras

### Árvore Completa de Diretórios

```
yaid_dashboard/
├── .env.local
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── proxy.ts                               # entrypoint Next.js 16 para auth global por prefixo
├── next.config.ts
├── package.json
├── tsconfig.json
│
├── supabase/                              # ★ versionamento de schema (Supabase CLI, project-ref lygkwhcwsrxfozswhxyo)
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/                        # baseline (db pull) + forward timestampadas
│
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # overview com métricas
│   │   ├── apps/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx               # criar app + modal API key one-shot
│   │   │   └── [appId]/page.tsx
│   │   ├── proof-requests/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx               # helper de teste (sessão, não API key)
│   │   │   └── [requestId]/page.tsx       # detalhe + timeline
│   │   └── settings/page.tsx
│   ├── sign-in/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── sign-up/
│   │   └── page.tsx                       # ★ a criar — signup atômico
│   ├── v/
│   │   └── [sessionToken]/page.tsx        # tela coringa
│   └── api/
│       ├── auth/
│       │   ├── sign-out/route.ts
│       │   └── sign-up/route.ts           # ★ a criar — signup atômico
│       ├── companies/
│       │   ├── route.ts                   # POST
│       │   └── me/route.ts                # GET + PATCH
│       ├── company-apps/
│       │   ├── route.ts                   # POST + GET
│       │   └── [appId]/route.ts           # GET + PATCH
│       ├── proof-requests/
│       │   ├── route.ts                   # POST (API key) + GET (sessão)
│       │   └── [requestId]/
│       │       ├── route.ts               # GET
│       │       └── review/route.ts        # ★ POST (sessão) — aprovar/reprovar em apps homol
│       ├── proof-sessions/
│       │   └── [sessionToken]/
│       │       ├── route.ts               # GET (público)
│       │       ├── challenge/route.ts     # ★ GET (app mobile)
│       │       └── cancel/route.ts        # ★ POST (app mobile)
│       ├── credentials/
│       │   ├── issue/route.ts             # ★ POST (app mobile)
│       │   └── revoke/route.ts            # ★ POST (app mobile)
│       ├── presentations/
│       │   └── verify/route.ts            # ★ POST (app mobile)
│       └── webhook-public-key/route.ts    # ★ GET (público)
│
├── src/
│   ├── modules/
│   │   ├── company/app/
│   │   │   ├── create_company_{usecase,viewmodel,controller,presenter}.ts
│   │   │   ├── get_my_company_{usecase,viewmodel,controller,presenter}.ts
│   │   │   └── update_company_{usecase,viewmodel,controller,presenter}.ts
│   │   ├── company-app/app/
│   │   │   ├── create_company_app_{usecase,viewmodel,controller,presenter}.ts
│   │   │   ├── get_company_app_{usecase,viewmodel,controller,presenter}.ts
│   │   │   ├── list_company_apps_{usecase,viewmodel,controller,presenter}.ts
│   │   │   └── update_company_app_{usecase,viewmodel,controller,presenter}.ts
│   │   ├── proof-request/app/
│   │   │   ├── create_proof_request_{usecase,viewmodel,controller,presenter}.ts
│   │   │   ├── get_proof_request_{usecase,viewmodel,controller,presenter}.ts
│   │   │   ├── list_proof_requests_{usecase,viewmodel,controller,presenter}.ts
│   │   │   └── review_proof_request_{usecase,viewmodel,controller,presenter}.ts  # ★ review manual (homol)
│   │   ├── proof-session/app/             # ★ separado de proof-request
│   │   │   ├── get_proof_session_{usecase,viewmodel,controller,presenter}.ts
│   │   │   ├── get_challenge_{usecase,viewmodel,controller,presenter}.ts
│   │   │   └── cancel_proof_session_{usecase,viewmodel,controller,presenter}.ts
│   │   ├── identity/app/                  # ★ emissão e revogação de VC
│   │   │   ├── issue_credential_{usecase,viewmodel,controller,presenter}.ts
│   │   │   └── revoke_credential_{usecase,viewmodel,controller,presenter}.ts
│   │   ├── presentation/app/              # ★ verificação de VP
│   │   │   └── verify_presentation_{usecase,viewmodel,controller,presenter}.ts
│   │   └── webhook/app/                   # ★ entrega de webhook
│   │       └── deliver_webhook_{usecase,viewmodel,controller,presenter}.ts
│   │
│   └── shared/
│       ├── environments.ts                # único lugar que lê process.env
│       ├── errors/
│       │   └── AppError.ts
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── Company.ts
│       │   │   ├── CompanyApp.ts
│       │   │   ├── ProofRequest.ts
│       │   │   └── ProofSession.ts
│       │   ├── enums/
│       │   │   ├── ProofType.ts
│       │   │   ├── ProofRequestStatus.ts
│       │   │   └── ProofSessionStatus.ts
│       │   └── interfaces/
│       │       ├── repositories/
│       │       │   ├── CompanyRepository.ts
│       │       │   ├── CompanyAppRepository.ts
│       │       │   ├── ProofRequestRepository.ts
│       │       │   └── ProofSessionRepository.ts
│       │       ├── ApiKeyHasher.ts
│       │       ├── OcrProvider.ts         # ⚠️ TBD: provider concreto
│       │       ├── BlockchainClient.ts    # ⚠️ TBD: implementação concreta
│       │       └── WebhookSigner.ts
│       ├── infra/
│       │   ├── repositories/
│       │   │   ├── SupabaseCompanyRepository.ts
│       │   │   ├── SupabaseCompanyAppRepository.ts
│       │   │   ├── SupabaseProofRequestRepository.ts
│       │   │   └── SupabaseProofSessionRepository.ts
│       │   └── dto/
│       │       ├── CompanyDTO.ts + CompanyMapper.ts
│       │       ├── CompanyAppDTO.ts + CompanyAppMapper.ts
│       │       ├── ProofRequestDTO.ts + ProofRequestMapper.ts
│       │       └── ProofSessionDTO.ts + ProofSessionMapper.ts
│       ├── clients/
│       │   ├── supabase/
│       │   │   ├── client.ts              # cliente browser
│       │   │   ├── server.ts              # cliente server-side (SSR)
│       │   │   └── admin.ts               # cliente admin
│       │   ├── blockchain/                # ⚠️ TBD: library a definir
│       │   └── ocr/                       # ⚠️ TBD: provider a definir
│       └── middlewares/
│           ├── withSessionAuth.ts         # valida sessão Supabase
│           ├── withApiKeyAuth.ts          # valida API key (SHA-256)
│           ├── withDIDAuth.ts             # ⚠️ TBD: algoritmo de criptografia
│           └── withSessionToken.ts        # valida posse do session token
│
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   ├── app-topbar.tsx
│   │   └── page-header.tsx
│   ├── feedback/
│   │   └── status-badge.tsx
│   ├── api/
│   │   └── code-block.tsx
│   └── yaid/
│       └── metric-card.tsx
│
└── utils/
    ├── utils.ts                           # cn() — clsx + tailwind-merge
    └── fetch-with-auth.ts                 # ★ a criar — intercepta 401
```

### Arquivos a Remover

- `app/(dashboard)/apps/novo/` — duplicata de `/apps/new`
- `app/onboarding/` — substituída por `/sign-up`
- `lib/` (completo) — Supabase migra para `shared/clients/supabase/`, restante para `utils/`

### Módulos a Migrar

Os três módulos existentes (`company`, `company-app`, `proof-request`) saem de `modules/` (raiz) e são reestruturados em `src/modules/` seguindo a convenção da skill `nextjs-backend`:
- `application/usecases/` → `app/{action}_{feature}_usecase.ts`
- `presentation/controllers/` → `app/{action}_{feature}_controller.ts`
- `factories/` → `app/{action}_{feature}_presenter.ts`
- `domain/` → `src/shared/domain/`
- `infra/` → `src/shared/infra/`

### Mapeamento de Requisitos → Módulos

| Requisito Funcional | Módulos | Rotas API |
|---------------------|---------|-----------|
| Gestão empresarial (signup, settings) | `company` | `/api/auth/sign-up`, `/api/companies/me` |
| Gestão de apps + API keys (com allowlist `can_create_apps`) | `company-app` | `/api/company-apps/**` |
| Proof Requests (B2B) + review manual em homolog | `proof-request` | `/api/proof-requests/**`, `/api/proof-requests/{id}/review` |
| Tela coringa + challenge | `proof-session` | `/api/proof-sessions/**` |
| Emissão e revogação de VC | `identity` | `/api/credentials/**` |
| Verificação de VP | `presentation` | `/api/presentations/verify` |
| Webhook assinado | `webhook` | `/api/webhook-public-key` |

### Fronteiras de Integração

**Frontend → Backend:** RSC lê dados via Supabase server client ou fetch interno; client components usam `fetchWithAuth` para endpoints autenticados por sessão.

**Backend → Banco:** somente via `shared/infra/repositories/` (Supabase client de `shared/clients/supabase/server.ts`).

**Backend → Blockchain:** somente via `shared/clients/blockchain/` — ⚠️ TBD.

**Backend → OCR:** somente via `shared/clients/ocr/` — ⚠️ TBD.

**Backend → Empresa (webhook):** módulo `webhook` (`DeliverWebhookUseCase`) dispara após transição de `proof_request`; tentativa única; falha logada. O **review manual** (`review_proof_request_usecase`, apps `homol`) transiciona para `approved`/`rejected`, seta `updated_at = NOW()` e dispara o webhook normal — mesmo caminho de um fluxo real.

**Guards de negócio server-side (defesa em profundidade):**
- `CreateCompanyAppUseCase` rejeita com `AppError(403)` quando `company.can_create_apps === false` (o frontend também desabilita o CTA, mas o guard é a fonte da verdade).
- `review_proof_request_usecase` rejeita review em app `prod` (só `homol`) e em proof_request de status terminal — o botão ausente no frontend é reforçado pelo guard.

## Validação da Arquitetura

### Validação de Coerência ✅

**Compatibilidade de Decisões:** Todas as escolhas tecnológicas são compatíveis entre si. SHA-256 é consistente com a interface `ApiKeyHasher`. `proxy.ts` global delega para `src/shared/middleware.ts` e cobre os 4 mecanismos de auth sem sobreposição. React Hook Form + Zod são compatíveis. GitHub Actions + Amplify é uma combinação suportada.

**Consistência de Padrões:** Nomenclatura `{action}_{feature}_*.ts` uniforme em todos os módulos. Transformação snake_case → camelCase delegada ao ViewModel. Shape de erro `{ error: string }` uniforme em toda a API.

**Ponto de Atenção:** A migração para `src/modules/` exige atualização do `tsconfig.json` com path aliases — deve ser a primeira ação da migração dos módulos existentes.

### Cobertura de Requisitos ✅

| RF | Módulos | Status |
|----|---------|--------|
| RF1 — Gestão empresarial | `company` + `/api/auth/sign-up` | ★ a criar |
| RF2 — Proof Requests B2B (+ review manual em homolog) | `proof-request` + `withApiKeyAuth` + `withSessionAuth` (review) | ✅ |
| RF3 — Tela Coringa | `proof-session` + `app/v/[sessionToken]` | ✅ |
| RF4 — Fluxos App Mobile (VC como VC-JWT) | `identity` + `presentation` + `withDIDAuth` | ⚠️ TBDs abertos |
| RF5 — Dashboard B2B | pages + `fetchWithAuth` + React Hook Form | ✅ |

NFRs críticos cobertos: privacidade do holder (sem tabelas de holder), segurança de chaves (`environments.ts`), webhook assimétrico (`WebhookSigner`), auditabilidade (timeline via `updated_at` + `proof_sessions`).

### Análise de Gaps

**Importantes (agente deve questionar antes de implementar):**
- `tsconfig.json` — path aliases para `src/modules` e `src/shared` não configurados
- `withDIDAuth.ts` — algoritmo de verificação de assinatura e biblioteca ⚠️ TBD
- `shared/clients/blockchain/` — library client ⚠️ TBD
- `shared/clients/ocr/` — provider concreto ⚠️ TBD

**Nice-to-have:**
- Enums PostgreSQL explícitos vs TEXT com validação — decidir na implementação

### Checklist de Completude

**Análise de Requisitos**
- [x] Contexto do projeto analisado
- [x] Escala e complexidade avaliadas
- [x] Restrições técnicas identificadas
- [x] Preocupações transversais mapeadas

**Decisões Arquiteturais**
- [x] Decisões críticas documentadas
- [x] Stack tecnológico especificado
- [x] Padrões de integração definidos
- [x] Considerações de segurança endereçadas

**Padrões de Implementação**
- [x] Convenções de nomenclatura estabelecidas
- [x] Padrões de estrutura definidos
- [x] Padrões de comunicação especificados
- [x] Padrões de processo documentados

**Estrutura do Projeto**
- [x] Estrutura de diretórios completa definida
- [x] Fronteiras de componentes estabelecidas
- [x] Pontos de integração mapeados
- [x] Mapeamento de requisitos → estrutura completo

### Avaliação de Prontidão

**Status Geral:** PRONTO PARA IMPLEMENTAÇÃO

**Nível de Confiança:** Alto

**Pontos Fortes:**
- Separação clara de responsabilidades por camada (skill `nextjs-backend`)
- TBDs explicitamente marcados — nenhum TBD oculto para o agente implementador
- Privacidade do holder reforçada na arquitetura (não só como regra de negócio)
- Módulos independentes permitem implementação paralela de tracks frontend e backend
- Schema do banco alinhado com invariantes do domínio

**Áreas para Evolução Futura (pós-MVP):**
- Migração de env vars para KMS/Vault
- RLS no PostgreSQL
- Retry exponencial de webhook com tabela `webhook_deliveries`
- Monitoramento externo estruturado (Sentry, Datadog)
- `company_members` para multi-usuário por company

### Handoff para Implementação

**Agentes devem:**
- Seguir todas as decisões arquiteturais exatamente como documentadas
- Usar os padrões de implementação consistentemente em todos os módulos
- Respeitar fronteiras de estrutura e dependências definidas na skill `nextjs-backend`
- Consultar este documento para qualquer questão arquitetural
- **Questionar explicitamente** antes de implementar qualquer item marcado com ⚠️ TBD

**Sequência de Prioridade de Implementação:**
1. Atualizar `tsconfig.json` com path aliases para `src/`
2. Migrar módulos existentes (`company`, `company-app`, `proof-request`) para `src/modules/`
3. Implementar signup atômico (`/sign-up` + `/api/auth/sign-up`)
4. Migrar dashboard de mocks/localStorage para APIs reais
5. Implementar `fetchWithAuth` e confirmações destrutivas
6. Implementar módulos de app mobile somente após resolver TBDs de criptografia e blockchain
