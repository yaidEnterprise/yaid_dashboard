---
stepsCompleted: [1, 2, 3, 4, 5]
status: complete
completedAt: '2026-05-11'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# yaid_dashboard - Epic Breakdown

## Overview

Este documento fornece o detalhamento completo de épicos e stories para o yaid_dashboard, decompondo os requisitos do PRD e Architecture em stories implementáveis.

## Requirements Inventory

### Functional Requirements

FR1: O sistema deve permitir cadastro de nova empresa com email, senha e nome da empresa (CNPJ opcional) em um único formulário atômico — criando `auth.users` e `public.companies` na mesma operação; falha em qualquer passo desfaz ambos. Não existe estado "usuário sem company".

FR2: O sistema deve autenticar empresas via Supabase Auth; pós-login redireciona para "/" (ou `?next=<path>` se preenchido); tela `/sign-up` redireciona direto para "/" após cadastro bem-sucedido.

FR3: O dashboard deve exibir uma página de overview com aviso institucional de privacidade e card "próximo passo recomendado" adaptativo — alimentado por API real (sem metric cards ou tabela de métricas no MVP).

FR4: O sistema deve permitir listagem de company_apps (busca tudo, sem filtros nem paginação no MVP), alimentado por `GET /api/company-apps`.

FR5: O sistema deve permitir criação de novo company_app com formulário de 2 cards (Identificação, Webhook) + sidebar institucional; após submit deve exibir modal bloqueante com API key (font-mono, copiável), aviso "única vez", checkbox bloqueante de confirmação, e botão de conclusão desabilitado até confirmar. ESC não fecha o modal.

FR6: O sistema deve exibir detalhe de company_app com nome, badges, cards editáveis (Identificação, Webhook), card de chave (só app_id, nunca secret), e toggle de status com confirmação ao desabilitar.

FR7: O sistema deve exibir listagem de proof_requests em tabela simples (busca tudo, sem filtros nem paginação no MVP).

FR8: O sistema deve exibir detalhe de proof_request com header (Request ID + status), resumo, atributos confirmados, JSON da resposta e privacy card (sem timeline no MVP).

FR9: O sistema deve oferecer helper de criação de proof_request no dashboard (`/proof-requests/new`) com formulário contendo app + proof_type + external_reference; deve chamar endpoint interno autenticado por sessão (não por API key, pois o secret não está acessível ao dashboard).

FR10: O sistema deve exibir página de settings da company com inputs editáveis via `PATCH /api/companies/me`, Stripe card como placeholder visual e botão de logout com confirmação — alimentado por API real (não mocks).

FR11: A API deve permitir que empresas parceiras criem proof_requests via API key bearer (`POST /api/proof-requests`), recebendo `verification_url` e `deep_link_url` derivadas do token (não persistidas na tabela).

FR12: O sistema deve criar proof_session atomicamente junto com a proof_request, com `session_token_hash`, `challenge_nonce_hash` (null até holder abrir), `challenge_created_at`, `expires_at` (30 minutos) e status inicial `waiting_user`.

FR13: A tela coringa (`/v/[sessionToken]`) deve exibir 6 estados visuais: `waiting_user` (deep link + tempo restante), `opened` (spinner aguardando), `approved` (sucesso + return_url opcional), `rejected`/`cancelled` (mensagem genérica), `expired` (mensagem clara), inválida (genérica sem enumeration).

FR14: A tela coringa deve realizar polling em `GET /api/proof-sessions/{token}` a cada 5–10s nas fases ativas; parar nas fases terminais; exibe botão de deep link `yaid://verify?session=<token>` (sem QR code no MVP).

FR15: O backend deve emitir Verifiable Credentials (VC) com claims booleanos (`personhood: true` | `ageOver18: true`) após OCR em memória, sem persistir PII, e registrar o DID do holder on-chain via `registerDID`.

FR16: O backend deve fornecer challenge/nonce para o app mobile via `GET /api/proof-sessions/{token}/challenge`, preenchendo `challenge_nonce_hash` e `challenge_created_at` na proof_session.

FR17: O backend deve verificar Verifiable Presentations (VP) do holder (`POST /api/presentations/verify`), validando: assinatura do holder, assinatura do issuer, claims booleanos, nonce/challenge, e status de revogação on-chain.

FR18: O backend deve permitir que o holder cancele uma proof_session via `POST /api/proof-sessions/{token}/cancel` (autenticado por assinatura DID).

FR19: O backend deve permitir que o holder revogue uma VC via `POST /api/credentials/revoke`, registrando `hash(vc_id)` on-chain.

FR20: O backend deve enviar webhook assimétrico Ed25519 para a empresa parceira ao transicionar proof_request para `approved`, `rejected` ou `expired`; tentativa única; falha logada.

FR21: O backend deve expor `GET /api/webhook-public-key` (público) para que empresas parceiras possam verificar assinaturas dos webhooks.

FR22: O sistema deve implementar fetch wrapper global (`fetchWithAuth`) que intercepta respostas 401 e redireciona para `/sign-in?next=<path>`.

FR23: O sistema deve exigir confirmação do usuário para todas as ações destrutivas (logout, desabilitar app).

FR24: A autenticação do app mobile deve usar headers `X-YaID-DID`, `X-YaID-Signature` e `X-YaID-Timestamp` com tolerância de ±5 minutos para replay protection; public key extraída diretamente do DID (`did:yaid:user:<holder-public-key>`).

FR25: O backend deve validar hash de API key usando SHA-256 de `"<app_id>.<secret>"`, nunca armazenando o secret em texto puro.

### NonFunctional Requirements

NFR1: Nenhum dado pessoal do holder pode ser armazenado em tabela relacional — apenas `hash(vc_id)` e DID na blockchain (princípio de privacidade não-negociável e estrutural).

NFR2: API key nunca em texto puro — apenas `SHA-256("<app_id>.<secret>")` armazenado. Consequência direta: webhook signing é assimétrico (Ed25519), não HMAC.

NFR3: Três chaves privadas distintas em env vars sem reuso entre papéis: `ISSUER_PRIVATE_KEY` (Ed25519), `WEBHOOK_SIGNING_PRIVATE_KEY` (Ed25519), `BLOCKCHAIN_WALLET_PRIVATE_KEY` (secp256k1). Todas validadas no boot do servidor.

NFR4: Replay protection em autenticação mobile: requisições com timestamp fora da janela de ±5min são rejeitadas; DID malformado é rejeitado; signature mismatch é rejeitado.

NFR5: Empresa parceira nunca recebe VC ou VP — apenas booleano `valid` e metadados de status.

NFR6: Erros de enumeração não devem vazar informação — proof_request de outra company retorna `NotFound` (não 403).

NFR7: OCR de documentos (RG) deve processar em memória — zero persistência de imagem ou dado pessoal no banco.

NFR8: Isolamento server-side por `company_id` em todas as queries (sem RLS no MVP).

NFR9: Shape de erro uniforme `{ error: string }` com HTTP status code adequado em toda a API. Nunca expor stack trace, secrets, queries SQL ou detalhes internos.

NFR10: PT-BR fixo, sem i18n no MVP. Desktop-first; mobile funcional não otimizado.

NFR11: Deploy em AWS Amplify; CI/CD via GitHub Actions (lint + typecheck).

NFR12: Demonstrabilidade acadêmica (TCC) — fluxo ponta a ponta funcional e defensável sob exame de banca.

NFR13: Toda submissão de formulário dispara toast de sucesso/erro (via Sonner); botões ficam `disabled` durante envio.

NFR14: Toda listagem cobre 3 estados: loading, erro, vazio (CTA), populado.

### Additional Requirements

- O projeto já está inicializado; usar Next.js 16.2.4 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4, Supabase SSR, Zod 4 — sem starter externo.
- Primeiro passo obrigatório antes de qualquer implementação: atualizar `tsconfig.json` com path aliases para `src/modules` e `src/shared`.
- Migrar módulos existentes (`company`, `company-app`, `proof-request`) de `modules/` (raiz) para `src/modules/` seguindo a convenção da skill `nextjs-backend` (`application/usecases/` → `app/{action}_{feature}_usecase.ts`, etc.).
- Remover pasta duplicada `app/(dashboard)/apps/novo/` e pasta `app/onboarding/` da codebase.
- Migration de schema: remover colunas `verification_page_url` e `deep_link_url` da tabela `proof_sessions`; adicionar `challenge_nonce_hash` e `challenge_created_at`.
- Adicionar dependência `react-hook-form` + integração via `zodResolver` em todos os formulários.
- Implementar `middleware.ts` global com roteamento por prefixo de rota para 4 mecanismos de auth distintos (sessão Supabase, API key bearer, DID signature, session token).
- `process.env` somente em `src/shared/environments.ts` — lido e validado no boot; nenhuma outra camada lê env vars diretamente.
- Integração com blockchain (Hardhat local no dev, Sepolia no MVP) — biblioteca client **TBD**: agente implementador deve questionar qual library usar, estratégia de retry e tratamento de latência on-chain antes de implementar.
- Integração com OCR em memória — provider **TBD** (Google Vision, AWS Textract, IDWall etc.): agente implementador deve questionar antes de implementar.
- Algoritmos e bibliotecas de criptografia — **TBD** para cada papel: agente implementador deve questionar biblioteca a usar para assinatura Ed25519 do issuer, webhook e auth mobile.
- Testes unitários co-locados ao módulo (ao lado dos arquivos de source); fakes em memória para repositórios; dois testes de integração contra Postgres real cobrindo queries críticas (isolamento por company, criação atômica de proof_request + proof_session).
- Campos camelCase em todas as respostas da API — ViewModel é responsável por transformar snake_case do banco.
- `session_token_hash` — o token bruto é devolvido apenas na resposta de criação da proof_request; nunca rearmazenado.
- Deploy do smart contract em Sepolia testnet; YaID paga gas com wallet de serviço; holder nunca paga gas.

### UX Design Requirements

Nenhum documento UX Design encontrado — sem requisitos UX adicionais a extrair.

### FR Coverage Map

FR1: Epic 1 — Signup atômico (auth.users + public.companies em transação única)
FR2: Epic 1 — Login Supabase com redirect pós-auth
FR10: Epic 1 — Settings da company (migrar de mocks para API real)
FR22: Epic 1 — fetchWithAuth global com redirect 401
FR23: Epic 1 — Confirmações para ações destrutivas (logout, desabilitar app)
FR4: Epic 2 — Listagem de apps via GET /api/company-apps (sem filtros no MVP)
FR5: Epic 2 — Criação de app com modal bloqueante de API key one-shot
FR6: Epic 2 — Detalhe e edição de app, toggle de status
FR25: Epic 2 — Hash SHA-256 de "<app_id>.<secret>"
FR3: Epic 3 — Overview página inicial (sem métricas no MVP)
FR7: Epic 3 — Listagem de proof_requests (sem filtros no MVP)
FR8: Epic 3 — Detalhe de proof_request (sem timeline no MVP)
FR9: Epic 3 — Helper /proof-requests/new autenticado por sessão
FR11: Epic 3 — POST /api/proof-requests via API key B2B
FR12: Epic 3 — Criação atômica de proof_session com challenge fields
FR13: Epic 4 — 6 estados visuais da tela coringa
FR14: Epic 4 — Polling + botão de deep link (sem QR code no MVP)
FR15: Epic 5 — Emissão de VC + OCR em memória + registro DID on-chain
FR16: Epic 5 — Challenge/nonce para app mobile
FR17: Epic 5 — Verificação de VP (assinatura holder + issuer + claims + nonce + revogação)
FR18: Epic 5 — Cancel de proof_session pelo holder via DID auth
FR19: Epic 5 — Revogação de VC on-chain pelo holder
FR24: Epic 5 — Auth mobile via DID signature + replay protection ±5min
FR20: Epic 6 — Webhook Ed25519 assimétrico (tentativa única, falha logada)
FR21: Epic 6 — GET /api/webhook-public-key público

## Epic List

### Epic 1: Fundação Técnica e Acesso Empresarial

Empresa parceira pode se registrar em um único formulário atômico, acessar o dashboard de forma segura e gerenciar configurações da conta. A base de código está limpa, com módulos em `src/`, schema correto e `environments.ts` validando chaves no boot.

**FRs cobertos:** FR1, FR2, FR10, FR22, FR23

### Epic 2: Gestão de Aplicações e API Keys

Empresa pode criar e gerenciar suas aplicações integradas, obtendo API keys de forma segura (revelação única, one-shot) e controlando o status de cada app.

**FRs cobertos:** FR4, FR5, FR6, FR25

### Epic 3: Proof Requests e Dashboard de Validações

Empresa pode criar proof requests via API B2B, ver a listagem completa de validações e o detalhe de cada request. O overview exibe a página inicial do dashboard.

**FRs cobertos:** FR3, FR7, FR8, FR9, FR11, FR12

### Epic 4: Tela Coringa e Sessão de Verificação

Holder pode acompanhar em tempo real o fluxo de verificação de identidade no browser, com polling automático, 6 estados visuais distintos e botão de deep link para o app YaID Wallet.

**FRs cobertos:** FR13, FR14

### Epic 5: Emissão, Verificação e Gestão de Credenciais

Holder com app mobile pode emitir sua Verifiable Credential via OCR em memória (sem persistir PII), verificar sua identidade apresentando uma VP validada on-chain, cancelar sessão e revogar VC.

**FRs cobertos:** FR15, FR16, FR17, FR18, FR19, FR24

### Epic 6: Webhooks e Conclusão do Fluxo B2B

Empresa parceira recebe notificações automáticas e criptograficamente verificáveis (Ed25519) sobre o resultado das validações, podendo checar autenticidade dos webhooks com a chave pública publicada.

**FRs cobertos:** FR20, FR21

---

## Epic 1: Fundação Técnica e Acesso Empresarial

Empresa parceira pode se registrar em um único formulário atômico, acessar o dashboard de forma segura e gerenciar configurações da conta. A base de código está limpa, com módulos em `src/`, schema correto e `environments.ts` validando chaves no boot.

### Story 1.1: Reestruturação Técnica do Projeto

Como desenvolvedor,
Quero migrar a codebase para a estrutura `src/` com path aliases, schema correto e environments validados,
Para que todo desenvolvimento subsequente siga o padrão arquitetural estabelecido sem ambiguidade.

**Acceptance Criteria:**

**Given** o projeto Next.js existente com módulos em `modules/` (raiz)
**When** a reestruturação é aplicada
**Then** o `tsconfig.json` contém path aliases `@/modules/*` → `src/modules/*` e `@/shared/*` → `src/shared/*`
**And** os módulos `company`, `company-app` e `proof-request` estão em `src/modules/` seguindo a convenção `{action}_{feature}_{usecase|controller|presenter|viewmodel}.ts`
**And** `src/shared/environments.ts` é o único arquivo que lê `process.env`, exporta config tipada e lança erro no boot se `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY` ou `BLOCKCHAIN_WALLET_PRIVATE_KEY` estiverem ausentes
**And** `middleware.ts` roteia por prefixo: `/api/company-apps`, `/api/companies`, `/api/proof-requests`, `/api/auth/sign-out` → `withSessionAuth`; `/api/proof-requests` (POST) → `withApiKeyAuth`; rotas `/(dashboard)` → redirect para `/sign-in` se sem sessão
**And** as pastas `app/(dashboard)/apps/novo/` e `app/onboarding/` são removidas
**And** `react-hook-form` está listado em `package.json` como dependência instalada
**And** a migration SQL remove as colunas `verification_page_url` e `deep_link_url` da tabela `proof_sessions` e adiciona `challenge_nonce_hash TEXT` e `challenge_created_at TIMESTAMPTZ` (ambas nullable)
**And** todos os fluxos existentes (login, listagem de apps, listagem de proof_requests, tela coringa básica) continuam funcionando sem regressão

---

### Story 1.2: fetchWithAuth e Infraestrutura de Auth Client

Como usuário do dashboard,
Quero que sessões expiradas sejam tratadas automaticamente,
Para que eu seja redirecionado ao login sem perder contexto da página que tentava acessar.

**Acceptance Criteria:**

**Given** um componente client-side que usa `fetchWithAuth` para chamar qualquer endpoint autenticado
**When** o servidor retorna HTTP 401
**Then** o browser redireciona automaticamente para `/sign-in?next=<path-atual>`
**And** após login bem-sucedido, o usuário é redirecionado de volta para a página original via `?next=<path>`

**Given** uma chamada com `fetchWithAuth` para um endpoint que retorna 200
**When** a resposta chega
**Then** `fetchWithAuth` retorna a resposta normalmente, sem interferência

**Given** o arquivo `utils/fetch-with-auth.ts`
**When** revisado
**Then** ele exporta uma função `fetchWithAuth` com a mesma assinatura de `fetch` nativa (url + options)
**And** nenhum componente client-side chama `fetch` diretamente para endpoints autenticados — todos usam `fetchWithAuth`

---

### Story 1.3: Signup Atômico de Empresa

Como nova empresa parceira,
Quero me cadastrar com um único formulário contendo email, senha e nome da empresa,
Para que minha conta e company sejam criadas atomicamente — sem estados intermediários nem telas de onboarding adicionais.

**Acceptance Criteria:**

**Given** a página `/sign-up` com os campos: email, senha, confirmação de senha, nome da empresa (obrigatório) e CNPJ (opcional, com máscara)
**When** o formulário é submetido com dados válidos
**Then** o endpoint `POST /api/auth/sign-up` cria `auth.users` e `public.companies` na mesma operação atômica
**And** se a criação de `auth.users` falhar, nenhuma `company` é criada
**And** se a criação de `public.companies` falhar, o `auth.users` recém-criado é desfeito
**And** após sucesso, o usuário é redirecionado para `/` já autenticado
**And** a sessão recém-criada sempre tem uma `company` associada — estado "usuário sem company" não existe

**Given** o formulário de signup com dados inválidos (email já existente, senha fraca, confirmação diferente, nome vazio)
**When** o usuário tenta submeter
**Then** erros de validação são exibidos inline via React Hook Form + Zod antes de qualquer chamada à API
**And** o botão de submit fica `disabled` durante o envio
**And** em caso de erro retornado pela API, um toast de erro é exibido via Sonner

**Given** um usuário já autenticado
**When** tenta acessar `/sign-up`
**Then** é redirecionado para `/`

---

### Story 1.4: Login e Proteção de Rotas

Como empresa parceira cadastrada,
Quero fazer login e ser redirecionada ao dashboard,
Para que eu acesse meus dados de forma segura sem que usuários não autenticados vejam as rotas protegidas.

**Acceptance Criteria:**

**Given** a página `/sign-in` com campos email e senha
**When** o usuário submete credenciais válidas
**Then** é autenticado via Supabase Auth e redirecionado para `/` (ou para `?next=<path>` se o parâmetro existir na URL)

**Given** a página `/sign-in` com credenciais inválidas
**When** o usuário submete
**Then** um toast de erro é exibido com mensagem genérica (sem detalhar se email ou senha está errado)
**And** o botão fica `disabled` durante o envio e reabilita após a resposta

**Given** um usuário não autenticado
**When** tenta acessar qualquer rota de `/(dashboard)` (ex: `/`, `/apps`, `/proof-requests`, `/settings`)
**Then** o middleware redireciona para `/sign-in?next=<path-tentado>`

**Given** um usuário autenticado
**When** tenta acessar `/sign-in`
**Then** é redirecionado para `/`

---

### Story 1.5: Configurações da Empresa

Como empresa parceira autenticada,
Quero visualizar e editar os dados da minha empresa e fazer logout com confirmação,
Para que eu mantenha minha conta atualizada e não saia acidentalmente do sistema.

**Acceptance Criteria:**

**Given** a página `/settings` para um usuário autenticado
**When** a página carrega
**Then** os dados da company (nome, CNPJ) são exibidos nos campos, alimentados por `GET /api/companies/me`
**And** o endpoint retorna `{ id, name, cnpj, status, createdAt }` em camelCase
**And** um card visual de Stripe é exibido como placeholder (não funcional, sem chamada a API externa)

**Given** o formulário de settings com dados alterados
**When** o usuário clica em salvar
**Then** `PATCH /api/companies/me` é chamado com os campos alterados
**And** o botão fica `disabled` durante o envio
**And** em caso de sucesso, um toast de sucesso é exibido e os campos refletem os novos valores
**And** em caso de erro, um toast de erro é exibido sem perder os valores digitados

**Given** o botão de logout na página de settings
**When** o usuário clica em logout
**Then** um dialog de confirmação é exibido com as opções "Cancelar" e "Sair"
**And** ao confirmar, `POST /api/auth/sign-out` é chamado e o usuário é redirecionado para `/sign-in`
**And** ao cancelar, o dialog fecha e o usuário permanece na página

---

## Epic 2: Gestão de Aplicações e API Keys

Empresa pode criar e gerenciar suas aplicações integradas, obtendo API keys de forma segura (revelação única, one-shot) e controlando o status de cada app.

### Story 2.1: Listagem de Aplicações

Como empresa parceira autenticada,
Quero visualizar todas as minhas aplicações cadastradas,
Para que eu tenha uma visão geral dos meus apps e seus status sem precisar consultar a API manualmente.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/apps` para um usuário autenticado
**When** a página carrega
**Then** uma chamada `GET /api/company-apps` é feita e os apps da company são exibidos em tabela com colunas: nome, app_id, status e data de criação
**And** apenas apps da company autenticada são retornados (isolamento por `company_id` server-side)

**Given** a página de apps enquanto os dados carregam
**When** o request ainda não completou
**Then** um estado de loading é exibido (skeleton ou spinner)

**Given** a página de apps quando não há apps cadastrados
**When** a listagem é renderizada
**Then** um estado vazio é exibido com CTA "Criar primeiro app" que leva para `/apps/new`

**Given** a página de apps quando a API retorna erro
**When** o request falha
**Then** uma mensagem de erro é exibida com opção de tentar novamente

**Given** a listagem populada com apps
**When** o usuário clica em um app
**Then** é navegado para `/(dashboard)/apps/[appId]`

---

### Story 2.2: Criação de App com API Key One-Shot

Como empresa parceira,
Quero criar uma nova aplicação e receber a API key em uma exibição única e segura,
Para que eu possa integrar meu sistema com a YaID sem risco de exposição inadvertida do secret.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/apps/new` com formulário de criação
**When** a página carrega
**Then** exibe dois cards: "Identificação" (campo nome, obrigatório) e "Webhook" (campo webhook_url, opcional), mais sidebar institucional com informações sobre API keys

**Given** o formulário preenchido com nome válido
**When** o usuário clica em "Criar app"
**Then** o botão fica `disabled` durante o envio
**And** `POST /api/company-apps` é chamado com `{ name, webhookUrl }`
**And** o backend gera `app_id` e `secret` aleatórios, persiste apenas `SHA-256("<app_id>.<secret>")` como `api_key_hash`, nunca o secret
**And** a resposta inclui `{ appId, apiKey: "<app_id>.<secret>", ... }` — única vez que `apiKey` é retornado

**Given** a resposta de sucesso da criação
**When** o frontend recebe `apiKey`
**Then** um modal bloqueante é exibido com:
  - A API key completa em fonte monospace, selecionável e com botão de copiar
  - Aviso em destaque amarelo: "Esta é a única vez que a API key será exibida"
  - Checkbox obrigatório: "Confirmo que copiei minha API key"
  - Botão "Concluir" desabilitado até o checkbox ser marcado
**And** ESC não fecha o modal
**And** clique fora do modal não fecha o modal

**Given** o checkbox marcado e botão "Concluir" clicado
**When** o modal é fechado
**Then** o usuário é redirecionado para `/(dashboard)/apps`

**Given** o formulário com nome vazio ou inválido
**When** o usuário tenta submeter
**Then** erros de validação inline são exibidos pelo React Hook Form + Zod sem chamada à API

---

### Story 2.3: Detalhe e Edição de App

Como empresa parceira,
Quero visualizar os detalhes de um app, editar suas informações e controlar seu status,
Para que eu mantenha minha integração atualizada e possa desabilitar um app comprometido com segurança.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/apps/[appId]` para um app existente da company
**When** a página carrega
**Then** `GET /api/company-apps/{appId}` é chamado e exibe: nome, status (badge), card "Identificação" editável, card "Webhook" editável, e card "Chave da API" com apenas o `app_id` visível (nunca o secret)

**Given** o card "Identificação" ou "Webhook" com dados alterados
**When** o usuário clica em salvar
**Then** `PATCH /api/company-apps/{appId}` é chamado com os campos alterados
**And** o botão fica `disabled` durante o envio
**And** em caso de sucesso, toast de sucesso é exibido e os campos refletem os novos valores
**And** em caso de erro, toast de erro é exibido sem perder os valores editados

**Given** o toggle de status de um app ativo
**When** o usuário clica para desabilitar
**Then** um dialog de confirmação é exibido com aviso sobre o impacto (novas proof_requests com esse app serão rejeitadas)
**And** ao confirmar, `PATCH /api/company-apps/{appId}` é chamado com `{ status: "disabled" }` e o badge atualiza para "Desabilitado"
**And** ao cancelar, o toggle retorna ao estado anterior sem chamada à API

**Given** o toggle de status de um app desabilitado
**When** o usuário clica para reabilitar
**Then** `PATCH /api/company-apps/{appId}` é chamado com `{ status: "active" }` sem dialog de confirmação
**And** toast de sucesso é exibido e o badge atualiza para "Ativo"

**Given** um `appId` que não pertence à company autenticada
**When** a página tenta carregar
**Then** o endpoint retorna 404 (sem revelar se o app existe ou pertence a outra company)

---

## Epic 3: Proof Requests e Dashboard de Validações

Empresa pode criar proof requests via API B2B, ver a listagem completa de validações e o detalhe de cada request. O overview exibe a página inicial do dashboard.

### Story 3.1: Endpoint B2B — Criação de Proof Request

Como sistema de uma empresa parceira,
Quero criar uma proof request via API key e receber a URL de verificação,
Para que eu possa redirecionar meu usuário ao fluxo de validação da YaID sem expor credenciais internas.

**Acceptance Criteria:**

**Given** uma chamada `POST /api/proof-requests` com header `Authorization: Bearer <api_key>` válida e body `{ proofType, externalReference? }`
**When** a API key é autenticada e o app está ativo
**Then** uma `proof_request` e uma `proof_session` são criadas atomicamente no banco
**And** a `proof_session` é criada com: `session_token_hash = SHA-256(rawToken)`, `expires_at = now() + 30 min`, `status = waiting_user`, `challenge_nonce_hash = null`, `challenge_created_at = null`
**And** o raw token nunca é persistido — apenas o hash
**And** a resposta retorna `{ id, proofType, status, verificationUrl, deepLinkUrl, externalReference, createdAt }` onde `verificationUrl` e `deepLinkUrl` são derivadas do raw token e não estão em nenhuma coluna do banco

**Given** uma chamada com API key inválida ou ausente
**When** o middleware `withApiKeyAuth` processa o request
**Then** a API retorna `{ error: "Unauthorized" }` com HTTP 401

**Given** uma chamada com API key válida mas app com status `disabled`
**When** o use case valida o app
**Then** a API retorna `{ error: "App is disabled" }` com HTTP 422

**Given** uma chamada com `proofType` fora do enum `personhood | age_over_18`
**When** o controller valida o body com Zod
**Then** a API retorna `{ error: "Invalid proof type" }` com HTTP 400

**Given** falha em qualquer etapa da criação atômica (proof_request ou proof_session)
**When** o use case executa
**Then** nenhum registro parcial persiste no banco (rollback completo)

---

### Story 3.2: Listagem de Proof Requests no Dashboard

Como empresa parceira autenticada,
Quero visualizar todas as minhas proof requests em uma tabela,
Para que eu acompanhe o status de cada validação solicitada sem precisar consultar a API manualmente.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/proof-requests` para um usuário autenticado
**When** a página carrega
**Then** `GET /api/proof-requests` é chamado e as proof_requests da company são exibidas em tabela com colunas: ID (truncado), proof_type, status (badge), external_reference (se presente) e data de criação
**And** apenas proof_requests da company autenticada são retornadas (isolamento por `company_id` server-side)

**Given** a listagem enquanto os dados carregam
**When** o request ainda não completou
**Then** um estado de loading é exibido

**Given** a listagem quando não há proof_requests cadastradas
**When** a listagem é renderizada
**Then** um estado vazio é exibido com CTA orientando a criar a primeira proof_request via API

**Given** a listagem quando a API retorna erro
**When** o request falha
**Then** uma mensagem de erro é exibida com opção de tentar novamente

**Given** a listagem populada
**When** o usuário clica em uma proof_request
**Then** é navegado para `/(dashboard)/proof-requests/[requestId]`

---

### Story 3.3: Detalhe de Proof Request

Como empresa parceira autenticada,
Quero ver os detalhes de uma proof request específica,
Para que eu entenda o resultado da validação sem receber dados pessoais do holder.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/proof-requests/[requestId]` para uma proof_request da company
**When** a página carrega
**Then** `GET /api/proof-requests/{id}` é chamado e exibe:
  - Header com Request ID e badge de status
  - Card de resumo: proof_type, external_reference (se presente), created_at, updated_at
  - Card de atributos confirmados: claims booleanos verificados (apenas se status `approved`)
  - Card com JSON da resposta da sessão (dados não-sensíveis)
  - Privacy card: aviso de que a YaID não armazena dados pessoais do holder

**Given** uma proof_request com status `approved`
**When** o card de atributos é renderizado
**Then** exibe os claims verificados (ex: `personhood: true`) sem qualquer PII do holder

**Given** uma proof_request com status `pending_user`, `processing`, `rejected` ou `expired`
**When** o card de atributos é renderizado
**Then** exibe mensagem adequada ao status (ex: "Aguardando verificação", "Rejeitada", "Expirada")

**Given** um `requestId` que não pertence à company autenticada
**When** a página tenta carregar
**Then** o endpoint retorna 404 — nunca 403 (evita enumeration)

---

### Story 3.4: Helper de Criação de Proof Request (Dashboard)

Como empresa parceira autenticada,
Quero criar proof requests diretamente pelo dashboard para testes,
Para que eu valide minha integração sem precisar configurar um sistema externo para chamar a API B2B.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/proof-requests/new`
**When** a página carrega
**Then** exibe formulário com: select de app (populado via `GET /api/company-apps`, apenas apps ativos), select de proof_type (`personhood` | `age_over_18`) e campo opcional de external_reference

**Given** o formulário preenchido com app ativo e proof_type válido
**When** o usuário submete
**Then** um endpoint interno autenticado por sessão (não por API key) cria a proof_request + proof_session atomicamente
**And** o botão fica `disabled` durante o envio
**And** em caso de sucesso, exibe a `verificationUrl` gerada para que o usuário possa copiar e testar
**And** toast de sucesso é exibido

**Given** o formulário sem app selecionado ou proof_type inválido
**When** o usuário tenta submeter
**Then** erros de validação inline são exibidos sem chamada à API

**Given** a page quando não há apps ativos na company
**When** o select de apps renderiza
**Then** exibe mensagem orientando a criar um app primeiro, com link para `/apps/new`

---

### Story 3.5: Overview do Dashboard

Como empresa parceira autenticada,
Quero ver uma página inicial informativa ao acessar o dashboard,
Para que eu saiba o próximo passo recomendado na minha jornada de integração com a YaID.

**Acceptance Criteria:**

**Given** a página `/(dashboard)` (overview) para um usuário autenticado
**When** a página carrega
**Then** exibe um aviso institucional de privacidade da YaID (conteúdo estático)
**And** exibe um card "Próximo passo recomendado" com conteúdo adaptativo baseado no estado da company

**Given** uma company sem nenhum app cadastrado
**When** o card de próximo passo renderiza
**Then** exibe orientação para criar o primeiro app com CTA para `/apps/new`

**Given** uma company com apps mas sem proof_requests
**When** o card de próximo passo renderiza
**Then** exibe orientação para criar a primeira proof_request com exemplo de chamada à API

**Given** uma company com apps e proof_requests
**When** o card de próximo passo renderiza
**Then** exibe orientação sobre como verificar o status das validações ou configurar webhook
**And** nenhum dado mockado é exibido — todas as informações vêm de `GET /api/companies/me` e `GET /api/company-apps`

---

## Epic 4: Tela Coringa e Sessão de Verificação

Holder pode acompanhar em tempo real o fluxo de verificação de identidade no browser, com polling automático, 6 estados visuais distintos e botão de deep link para o app YaID Wallet.

### Story 4.1: Endpoint Público de Status da Sessão

Como tela coringa (cliente público),
Quero consultar o status atual de uma proof_session pelo token,
Para que eu exiba ao holder o estado correto da verificação sem expor informações sensíveis.

**Acceptance Criteria:**

**Given** uma chamada `GET /api/proof-sessions/{sessionToken}` com token válido
**When** o endpoint processa o request
**Then** o token bruto é hasheado e a sessão é localizada por `session_token_hash`
**And** a resposta retorna `{ status, proofType, companyName, expiresAt, returnUrl? }` em camelCase
**And** a resposta nunca contém: `externalReference`, `sessionToken` bruto, `requestId` interno, `challengeNonceHash` ou qualquer dado do holder

**Given** uma chamada com token inexistente ou malformado
**When** o endpoint processa
**Then** retorna HTTP 404 com `{ error: "Session not found" }` — sem distinguir se o token é inválido ou pertence a outra entidade (evita enumeration)

**Given** uma sessão com status terminal (`approved_by_user`, `expired`, `cancelled`)
**When** o endpoint é consultado
**Then** retorna o status terminal normalmente — o polling do client é responsável por parar

**Given** uma sessão com `expires_at` no passado e status ainda `waiting_user` ou `opened`
**When** o endpoint é consultado
**Then** o status retornado reflete `expired` e o sistema atualiza o status da sessão no banco se necessário

---

### Story 4.2: Tela Coringa com Polling e 6 Estados Visuais

Como holder,
Quero abrir o link de verificação no browser e ser guiado ao app YaID Wallet,
Para que eu complete o fluxo de verificação de identidade sem entregar documentos ou dados pessoais ao site da empresa.

**Acceptance Criteria:**

**Given** a URL `/v/[sessionToken]` com token válido e sessão em `waiting_user`
**When** a página carrega
**Then** exibe layout independente (sem sidebar ou topbar), container centralizado com marca YaID
**And** exibe o nome da company solicitante e o proof_type traduzido para linguagem natural (ex: "Verificação de identidade pessoal")
**And** exibe botão de deep link `yaid://verify?session=<token>` em destaque
**And** exibe contador regressivo de tempo até expiração
**And** inicia polling a `GET /api/proof-sessions/{sessionToken}` a cada 5–10 segundos

**Given** a tela em polling e a sessão transiciona para `opened`
**When** o poll retorna `status: "opened"`
**Then** exibe spinner com mensagem "Aguardando confirmação no app"
**And** o botão de deep link é ocultado
**And** o polling continua

**Given** a tela em polling e a sessão transiciona para `approved_by_user`
**When** o poll retorna `status: "approved_by_user"`
**Then** exibe mensagem de sucesso
**And** se `returnUrl` está presente na resposta, exibe botão "Voltar para [nome da company]" que redireciona para `returnUrl`
**And** o polling para imediatamente

**Given** a tela em polling e a sessão transiciona para `cancelled` ou `rejected`
**When** o poll retorna esse status
**Then** exibe mensagem genérica de não-conclusão sem detalhar o motivo
**And** o polling para imediatamente

**Given** a tela em polling e a sessão transiciona para `expired`
**When** o poll retorna `status: "expired"` ou o contador chega a zero
**Then** exibe mensagem clara de expiração com orientação para a empresa gerar um novo link
**And** o polling para imediatamente

**Given** a URL `/v/[sessionToken]` com token inválido ou inexistente
**When** a página tenta carregar
**Then** exibe mensagem genérica de link inválido sem revelar se o token existiu ou não

**Given** qualquer estado da tela
**When** revisado
**Then** nunca exibe: `externalReference`, token bruto, `requestId` interno ou qualquer dado pessoal do holder

---

## Epic 5: Emissão, Verificação e Gestão de Credenciais

Holder com app mobile pode emitir sua Verifiable Credential via OCR em memória (sem persistir PII), verificar sua identidade apresentando uma VP validada on-chain, cancelar sessão e revogar VC.

### Story 5.1: Middleware de Auth por DID (withDIDAuth)

Como sistema backend,
Quero validar requisições do app mobile via assinatura da chave privada do holder,
Para que apenas o holder legítimo possa emitir, verificar ou revogar suas credenciais.

**Acceptance Criteria:**

**Given** uma requisição com headers `X-YaID-DID`, `X-YaID-Signature` e `X-YaID-Timestamp` válidos
**When** `withDIDAuth` processa o request
**Then** a public key é extraída diretamente do DID no formato `did:yaid:user:<holder-public-key>` sem header adicional
**And** a assinatura é verificada contra o payload + timestamp usando a public key extraída
**And** se válida, o DID autenticado é anexado ao contexto do request para uso pelos controllers

**Given** um DID malformado (não segue `did:yaid:user:<pubkey>` ou public key não decodificável)
**When** o middleware valida
**Then** retorna HTTP 401 com `{ error: "Invalid DID" }`

**Given** um header `X-YaID-Timestamp` com timestamp fora da janela de ±5 minutos
**When** o middleware valida
**Then** retorna HTTP 401 com `{ error: "Request expired" }` — protege contra replay attacks

**Given** uma assinatura inválida (payload adulterado ou chave errada)
**When** o middleware valida
**Then** retorna HTTP 401 com `{ error: "Invalid signature" }`

**Given** qualquer header ausente entre `X-YaID-DID`, `X-YaID-Signature`, `X-YaID-Timestamp`
**When** o middleware valida
**Then** retorna HTTP 401 com `{ error: "Missing auth headers" }`

---

### Story 5.2: Wrapper BlockchainClient

Como sistema backend,
Quero um client tipado para interagir com o contrato YaIDRegistry já implantado,
Para que os módulos de emissão, verificação e revogação possam registrar e consultar dados on-chain sem acoplar ao SDK de blockchain diretamente.

**Acceptance Criteria:**

**Given** a interface `BlockchainClient` em `src/shared/domain/interfaces/BlockchainClient.ts`
**When** revisada
**Then** define os métodos: `registerDID(did: string): Promise<void>`, `revokeVC(vcId: string): Promise<void>`, `isDIDRegistered(did: string): Promise<boolean>` e `isVCRevoked(vcId: string): Promise<boolean>`

**Given** a implementação concreta em `src/shared/clients/blockchain/`
**When** instanciada pelo presenter via `environments.ts`
**Then** lê `BLOCKCHAIN_CONTRACT_ADDRESS` e `BLOCKCHAIN_WALLET_PRIVATE_KEY` de `environments.ts` (nunca de `process.env` diretamente)
**And** conecta ao contrato YaIDRegistry já implantado no endereço configurado
**And** usa a wallet de serviço para assinar e pagar gas em escritas (`registerDID`, `revokeVC`)
**And** leituras (`isDIDRegistered`, `isVCRevoked`) não requerem gas

**Given** o ambiente de desenvolvimento (Hardhat local)
**When** `BLOCKCHAIN_CONTRACT_ADDRESS` aponta para o contrato local
**Then** o client conecta e opera normalmente contra a chain local

**Given** falha de conexão ou transação rejeitada pela chain
**When** qualquer método é chamado
**Then** o erro é propagado como exceção tipada para o use case responsável por tratá-la

> ⚠️ **TBD para o agente implementador:** questionar qual library usar (ethers.js v6, viem etc.), estratégia de retry em falha de transação e tratamento de latência on-chain antes de implementar.

---

### Story 5.3: Challenge e Abertura de Sessão

Como app mobile do holder,
Quero solicitar um challenge/nonce para a sessão de verificação,
Para que minha Verifiable Presentation seja vinculada a essa sessão específica e não possa ser reutilizada.

**Acceptance Criteria:**

**Given** uma chamada `GET /api/proof-sessions/{sessionToken}/challenge` autenticada por DID e com posse do `sessionToken`
**When** o endpoint processa
**Then** um nonce aleatório é gerado
**And** `challenge_nonce_hash = SHA-256(nonce)` e `challenge_created_at = now()` são salvos na `proof_session`
**And** o status da `proof_session` transiciona de `waiting_user` para `opened`
**And** a resposta retorna apenas o nonce bruto ao app mobile — única vez que é exposto
**And** a `proof_request` associada transiciona para `processing`

**Given** uma sessão já em status `opened`, `approved_by_user`, `expired` ou `cancelled`
**When** o endpoint é chamado
**Then** retorna HTTP 422 com `{ error: "Session not in waiting_user state" }`

**Given** um `sessionToken` inválido ou de outra entidade
**When** o endpoint é chamado
**Then** retorna HTTP 404

---

### Story 5.4: Emissão de Verifiable Credential

Como holder com app mobile,
Quero emitir minha Verifiable Credential apresentando meu documento,
Para que eu possa usar essa credencial para verificações futuras sem entregar meu documento a terceiros.

**Acceptance Criteria:**

**Given** uma chamada `POST /api/credentials/issue` autenticada por DID com body `{ documentImage, proofType, bodySignature }`
**When** o endpoint processa
**Then** a assinatura do body pelo holder é validada com a public key extraída do DID antes de qualquer outra operação
**And** o processamento OCR ocorre em memória — a imagem do documento e os dados extraídos (nome, CPF, data de nascimento) nunca são persistidos em banco ou log
**And** uma VC é construída com: `id` (UUID), `type`, `issuer` (DID do backend YaID), `holder` (DID do holder), `issuedAt`, `claims: { personhood: true }` ou `{ ageOver18: true }` (apenas booleanos, sem PII)
**And** a VC é assinada com `ISSUER_PRIVATE_KEY` (Ed25519) via `WebhookSigner` ou utilitário equivalente
**And** `BlockchainClient.registerDID(holderDid)` é chamado para registrar o DID on-chain
**And** a VC completa (incluindo prova de assinatura) é retornada ao app mobile
**And** após o retorno, nenhum dado do holder permanece em memória ou banco da YaID

**Given** falha no OCR (documento ilegível ou tipo não suportado)
**When** o processamento é executado
**Then** retorna HTTP 422 com `{ error: "Document processing failed" }` sem persistir nada

**Given** falha no registro on-chain
**When** `registerDID` lança exceção
**Then** retorna HTTP 502 com `{ error: "Blockchain registration failed" }` sem emitir VC parcial

> ⚠️ **TBD para o agente implementador:** questionar provider de OCR (Google Vision, AWS Textract, IDWall etc.) e biblioteca de assinatura Ed25519 antes de implementar.

---

### Story 5.5: Verificação de Verifiable Presentation

Como sistema backend,
Quero validar a Verifiable Presentation do holder contra todas as regras de segurança e privacidade,
Para que apenas holders legítimos com credenciais válidas e não-revogadas sejam aprovados.

**Acceptance Criteria:**

**Given** uma chamada `POST /api/presentations/verify` com VP válida, autenticada por DID e com posse do `sessionToken`
**When** o use case executa as validações em sequência
**Then** todas as seguintes regras são verificadas (falha em qualquer uma → `rejected`):
  1. Estrutura da VP é válida (campos obrigatórios presentes)
  2. Assinatura da VP pelo holder é válida (verificada com public key do DID)
  3. A VP contém exatamente uma VC
  4. Assinatura da VC pelo issuer é válida (verificada com `ISSUER_PUBLIC_KEY`)
  5. Claims da VC são booleanos — sem PII
  6. DID do holder na VC corresponde ao DID autenticado no request
  7. Nonce incluído na VP corresponde ao `challenge_nonce_hash` da sessão
  8. `challenge_created_at` está dentro da janela de validade (não expirado)
  9. DID do holder está registrado on-chain (`isDIDRegistered = true`)
  10. VC não está revogada on-chain (`isVCRevoked = false`)
  11. `proof_session` está em status `opened`

**Given** todas as validações passam
**When** o use case conclui
**Then** `proof_session.status` transiciona para `approved_by_user`
**And** `proof_request.status` transiciona para `approved`
**And** `proof_request.updated_at` é atualizado
**And** a entrega de webhook é disparada de forma assíncrona (não bloqueia a resposta)
**And** a resposta retorna `{ valid: true }` ao app mobile

**Given** qualquer validação falha
**When** o use case conclui
**Then** `proof_request.status` transiciona para `rejected`
**And** webhook é disparado com resultado `rejected`
**And** a resposta retorna `{ valid: false }` — sem detalhar qual regra falhou para o app mobile

---

### Story 5.6: Cancel de Sessão e Revogação de Credencial

Como holder com app mobile,
Quero poder cancelar uma sessão de verificação em andamento e revogar minha credencial quando necessário,
Para que eu tenha controle total sobre minha identidade digital.

**Acceptance Criteria:**

**Given** uma chamada `POST /api/proof-sessions/{sessionToken}/cancel` autenticada por DID
**When** a sessão está em status `waiting_user` ou `opened`
**Then** `proof_session.status` transiciona para `cancelled`
**And** `proof_request.status` transiciona para `rejected`
**And** webhook é disparado com resultado `rejected`
**And** a resposta retorna HTTP 200

**Given** uma chamada de cancel para sessão já em status terminal (`approved_by_user`, `expired`, `cancelled`)
**When** o use case valida
**Then** retorna HTTP 422 com `{ error: "Session already in terminal state" }`

**Given** uma chamada `POST /api/credentials/revoke` autenticada por DID com body `{ vcId, bodySignature }`
**When** o endpoint processa
**Then** a assinatura do body pelo holder é validada antes de qualquer operação
**And** `BlockchainClient.revokeVC(SHA-256(vcId))` é chamado para registrar a revogação on-chain
**And** a resposta retorna HTTP 200 com `{ revoked: true }`
**And** nenhuma tabela relacional é alterada — a revogação existe apenas na blockchain

**Given** falha no registro de revogação on-chain
**When** `revokeVC` lança exceção
**Then** retorna HTTP 502 com `{ error: "Blockchain revocation failed" }` sem retornar sucesso parcial

---

## Epic 6: Webhooks e Conclusão do Fluxo B2B

Empresa parceira recebe notificações automáticas e criptograficamente verificáveis (Ed25519) sobre o resultado das validações, podendo checar autenticidade dos webhooks com a chave pública publicada.

### Story 6.1: WebhookSigner e Entrega de Webhook

Como empresa parceira,
Quero receber uma notificação HTTP assinada quando o resultado de uma verificação estiver disponível,
Para que meu sistema seja atualizado automaticamente sem precisar fazer polling constante na API.

**Acceptance Criteria:**

**Given** a interface `WebhookSigner` em `src/shared/domain/interfaces/WebhookSigner.ts`
**When** revisada
**Then** define o método `sign(payload: string): { signature: string; timestamp: number }` onde `payload` é o body JSON bruto

**Given** a implementação concreta do `WebhookSigner`
**When** instanciada pelo presenter via `environments.ts`
**Then** lê `WEBHOOK_SIGNING_PRIVATE_KEY` (Ed25519) de `environments.ts`
**And** assina o body JSON bruto sem re-serializar (preserva bytes exatos do payload)
**And** retorna a assinatura base64 e o timestamp Unix atual

**Given** uma transição de `proof_request` para `approved`, `rejected` ou `expired`
**When** o use case correspondente conclui com sucesso
**Then** `DeliverWebhookUseCase` é disparado de forma assíncrona (não bloqueia a resposta ao caller)
**And** o use case verifica se o app da proof_request possui `webhook_url` configurado — se não tiver, não faz nada
**And** se `webhook_url` existe, envia `POST {webhook_url}` com:
  - Body JSON: `{ proofRequestId, status, proofType, externalReference?, updatedAt }`
  - Header `X-YaID-Signature: <assinatura-base64>`
  - Header `X-YaID-Timestamp: <unix-timestamp>`
  - O body nunca contém: VC, VP, DID do holder, nonce ou qualquer PII

**Given** falha na entrega do webhook (timeout, connection refused, 4xx/5xx da empresa)
**When** o use case trata o erro
**Then** a falha é logada com `proofRequestId`, `webhookUrl` e código/mensagem de erro
**And** a `proof_request` permanece no status final — a falha de webhook nunca reabre ou altera o status
**And** nenhuma retentativa automática é feita no MVP
**And** a empresa pode consultar `GET /api/proof-requests/{id}` como fallback para verificar o resultado

---

### Story 6.2: Endpoint Público da Chave de Webhook

Como empresa parceira,
Quero obter a chave pública Ed25519 da YaID,
Para que meu sistema possa verificar a autenticidade das notificações de webhook recebidas.

**Acceptance Criteria:**

**Given** uma chamada `GET /api/webhook-public-key` sem autenticação
**When** o endpoint processa
**Then** retorna HTTP 200 com `{ publicKey: "<base64-encoded-public-key>", algorithm: "Ed25519" }`
**And** a public key retornada é derivada de `WEBHOOK_SIGNING_PRIVATE_KEY` — a mesma chave usada para assinar os webhooks
**And** a resposta é determinística: chamadas repetidas retornam sempre a mesma chave enquanto a env var não muda

**Given** uma empresa que recebeu um webhook com `X-YaID-Signature` e `X-YaID-Timestamp`
**When** usa a `publicKey` retornada por este endpoint para verificar a assinatura
**Then** `verify(signature, rawBody, publicKey)` retorna `true` para webhooks legítimos
**And** retorna `false` para qualquer payload adulterado ou assinatura forjada

**Given** `WEBHOOK_SIGNING_PRIVATE_KEY` ausente no boot
**When** `environments.ts` valida as env vars
**Then** o servidor falha ao iniciar com erro explícito — nunca sobe com chave ausente
