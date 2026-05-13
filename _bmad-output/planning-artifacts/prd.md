# PRD — Dashboard Empresarial + Backend YaID

> Documento de produto/requisitos da codebase única em Next.js que entrega o
> **Dashboard Web Empresarial** (frontend B2B), a **tela coringa de verificação**
> (frontend para o holder), e o **backend compartilhado do YaID** (APIs REST
> consumidas pelo dashboard, pelos sistemas das empresas parceiras e pelo app
> mobile, além da integração com a blockchain).
>
> Para a linguagem do domínio (DID, VC, VP, Holder, Issuer, Verifier, Company,
> Proof Request, Proof Session), ver [CONTEXT.md](../CONTEXT.md).
>
> **Última atualização:** 2026-05-11

---

## Problem Statement

Empresas que precisam validar se um usuário é uma pessoa real (e/ou maior de 18 anos) hoje enfrentam um conjunto ruim de alternativas: pedem documentos brutos (atrito, risco regulatório, custo de armazenamento), contratam KYC tradicional (caro, compartilha PII desnecessária), ignoram o problema (fraude, contas falsas, bots) ou tentam implementar identidade descentralizada in-house (precisam dominar DID, VC, VP, revogação e blockchain — fora do core do negócio delas).

Do outro lado, o holder (usuário final dessas empresas) é forçado a entregar dado pessoal repetidamente, sem controle sobre o que foi armazenado, por quem, por quanto tempo.

E o desenvolvedor de TCC (autor) precisa demonstrar uma plataforma SSI funcional ponta a ponta — emissão, apresentação, verificação, revogação, registry on-chain — com codebases coerentes, modelo de dados defensável e um discurso de privacidade que sustente exame de banca.

## Solution

**YaID** — plataforma SSI composta por três codebases:

1. **Esta codebase** (foco deste PRD): aplicação full-stack Next.js que reúne (a) o dashboard que a empresa parceira usa para se cadastrar, gerar API keys, configurar webhooks e acompanhar validações; (b) a tela coringa servida ao holder no browser quando uma validação é solicitada; (c) o backend REST consumido pelo próprio dashboard, pelo sistema da empresa via API key e pelo app mobile via assinatura por DID; (d) a integração com a blockchain (Sepolia + Hardhat local).
2. **App Mobile YaID Wallet** (codebase separada): wallet do holder, custodia DID/chave privada e VC.
3. **Smart Contract YaID** (codebase separada): registry público on-chain de DIDs com personhood validada + lista de hashes de VCs revogadas.

A experiência da empresa parceira é simples: cria uma proof_request via API, redireciona seu usuário para uma `verification_url`, recebe um webhook assinado com `valid: true | false`. Nunca vê documento, VC ou VP.

A experiência do holder é simples: abre o link no celular, app mobile assina uma VP com challenge emitido pela YaID, validação acontece sem compartilhar PII.

A experiência do desenvolvedor é defensável: nenhum dado pessoal do holder mora em tabela centralizada da YaID; a chain é a única fonte centralizada e contém apenas DID + hash de revogação; o claim na VC é booleano, não há SD-JWT/ZKP, mas também não há vazamento.

## Implementation Decisions

### Escopo e organização

- O sistema fica em **uma codebase Next.js** (App Router + Route Handlers) que entrega frontend B2B, tela coringa e backend REST. App mobile e smart contract ficam em codebases separadas, fora deste PRD.
- Tenant model: **1 Supabase auth user = 1 Company** (identidade conceitual, não relação 1:1 separável). `companies.id === auth.users.id` (mesmo UUID, sem coluna `auth_user_id` adicional). **Não existe estado "usuário sem company"**: o cadastro cria as duas rows em uma operação atômica única — se uma falhar, a outra é desfeita. Não há tela ou guard para "completar onboarding"; a sessão é sempre acompanhada de uma company existente. `company_members` para multi-usuário é decisão pós-MVP.
- Arquitetura em camadas conforme já existente: route handler → controller → use case → repository/service interface → infra. Cada domínio funcional em seu próprio módulo (`modules/company`, `modules/company-app`, `modules/proof-request`, etc.). **Isso vai ter uma skill própria para implementação**

### Domínio e modelo de dados

- **Quatro tabelas centralizadas**, todas referentes ao lado empresarial: `company`, `company_apps`, `proof_requests`, `proof_sessions`. Nenhuma sobre o holder.
- Tabela `identity_submissions` (sugerida no PRD antigo) é **proibida** pelo princípio de privacidade. Emissão de VC é síncrona e sem persistência relacional.
- `proof_sessions` mantém `id` próprio. Adiciona campos `challenge_nonce_hash` e `challenge_created_at`. Remove colunas `verification_page_url` e `deep_link_url` (derivadas do token).
- `proof_type` é enum de string única por request: `personhood` | `age_over_18`. Pedidos compostos viram dois proof_requests separados.
- VC carrega claims booleanos derivados (`personhood: true`, `ageOver18: true`). Data de nascimento, nome e CPF nunca entram na VC.

### Identidade descentralizada e criptografia

- **Issuer:** o próprio backend YaID, com chave Ed25519 em env var. Public key distribuída off-chain (na documentação/SDK). Chain não armazena DID/chave do issuer.
- **Holder:** identificado por `did:yaid:user:<holder-public-key>` derivado de keypair local gerada no primeiro uso do app. Sem cadastro centralizado.
- **Posse de DID em emissão:** body de `POST /api/credentials/issue` é assinado pela private key do holder; backend valida `verify(signature, payload, public_key)`, retirando a public key do did.
- **Auth do app mobile em todas as rotas:** headers `X-YaID-DID`, `X-YaID-Signature`, `X-YaID-Timestamp` (tolerância ±5min para replay protection). **A public key é extraída diretamente do DID** (formato `did:yaid:user:<holder-public-key>`), eliminando a necessidade de header separado e o check "`derive(public_key) === did`" — a relação é tautológica por construção.
- **Disclosure da VP:** sem SD-JWT/BBS+/ZKP. A VP carrega a VC inteira, e como a VC só tem booleanos, não há vazamento.
- **Revogação:** somente o holder revoga (via app mobile, assinando `vc_id`). Backend registra `hash(vc_id)` on-chain. YaID não mantém nem consulta lista local de VCs.

### Blockchain

- Dev em Hardhat local; deploy do MVP em Sepolia testnet.
- Smart contract YaIDRegistry com dois mappings: `didRegistered: keccak256(did) → bool` e `vcRevoked: keccak256(vc_id) → bool`. Escrita restrita à wallet de serviço da YaID (`onlyIssuer`).
- Backend chama o contrato em dois momentos: emissão de VC (`registerDID`) e revogação (`revokeVC`). Leituras acontecem em cada `presentations/verify`.
- YaID paga gas com uma **wallet de serviço própria** (chave em env var, abastecida via faucet Sepolia). Holder nunca paga gas.

### Webhook

- Trigger: transição de `proof_request` para `approved`, `rejected` ou `expired`.
- Assinatura **assimétrica Ed25519** (não HMAC) porque o backend não tem o secret da API key, só hash. Headers `X-YaID-Signature` + `X-YaID-Timestamp`. Empresa baixa public key de `GET /api/webhook-public-key`.
- MVP: tentativa única; falha logada. Tabela `webhook_deliveries` com retry exponencial vai para roadmap.
- Falha de webhook nunca reabre proof_request. Empresa consulta status via `GET /api/proof-requests/{id}` como fallback.

### Gestão de chaves

- Três chaves privadas distintas, todas em env vars no MVP, sem reuso entre papéis:
  - `ISSUER_PRIVATE_KEY` (Ed25519) — assina VCs.
  - `WEBHOOK_SIGNING_PRIVATE_KEY` (Ed25519) — assina webhooks.
  - `BLOCKCHAIN_WALLET_PRIVATE_KEY` (secp256k1) — assina transações on-chain.
- Migração para KMS/Vault fica como roadmap.

### Dashboard (frontend)

- Layout autenticado: sidebar fixa (260px, `bg-blue-900` — Direção B definida no UX Spec) + topbar + main centralizado `max-w-7xl`. **No MVP o dashboard é Desktop Only (≥1024px) — sem sidebar drawer, sem hambúrguer, sem breakpoints `sm`/`md`.** Toaster global (sonner) em `bottom-right` no dashboard e `bottom-center` na tela coringa. Para o sistema de design completo (paleta, tipografia, componentes shadcn/ui, responsividade e acessibilidade), consulte [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md).
- `PageHeader` padronizado com `title`, `description`, `actions`. Detalhes têm breadcrumb + back link.
- Toda listagem cobre 5 estados: loading, erro, vazio-sem-filtros (CTA), vazio-com-filtros, populado.
- Toda submissão dispara toast de sucesso/erro; botões ficam `disabled` durante envio.
- Ações destrutivas (logout, desabilitar app) exigem confirmação.
- 401 redireciona para `/sign-in?next=<path>` via fetch wrapper global.
- PT-BR fixo, sem i18n no MVP. Desktop-first; mobile funcional não otimizado.
- Componentes compartilhados já disponíveis: `MetricCard`, `StatusBadge`, `FilterPopover`, `CodeBlock`/`InlineCode`, `PageHeader`. (`EnvBadge` existe na codebase mas **não é usado no MVP** dado que não há distinção de ambientes.)

### Telas do dashboard

- `/sign-in`: login Supabase. Pós-login redireciona sempre para `/` (ou `?next=<path>` se preenchido). **Não há fluxo de "usuário sem company"** — se a sessão existe, a company existe (invariante garantido pelo signup atômico).
- `/sign-up`: form único com email, senha, confirmação de senha, **nome da empresa (required)** e CNPJ (opcional com máscara). Submit chama um endpoint atômico (ex: `POST /api/auth/sign-up`) que cria `auth.users` e `public.companies` na mesma operação — qualquer falha aborta ambos. Pós-cadastro redireciona direto para `/`.
- ~~`/onboarding/company`~~: **rota descontinuada**. Os campos da company foram absorvidos pelo form de signup. A pasta `app/onboarding/` existente hoje deve ser removida ou redirecionar 301 para `/sign-up`.
- `/(dashboard)` overview: 4 metric cards (total/aprovadas/pendentes/rejeitadas dos últimos 30 dias), card "próximo passo recomendado" adaptativo, card "apps ativos", tabela "solicitações recentes" (top 5), aviso institucional de privacidade. **Hoje usa dados mockados — migrar para API.**
- `/(dashboard)/apps`: tabela com busca por nome/id e filtro multi-select por status, footer com contador. **Hoje usa localStorage — migrar para `GET /api/company-apps`.**
- `/(dashboard)/apps/new`: form em 2 cards (Identificação, Webhook) + sidebar institucional. Submit abre **modal bloqueante** com API key (font-mono, copiável), aviso amarelo "única vez", **checkbox bloqueante de confirmação**, botão de conclusão disabled até marcar. Esc não fecha.
- `/(dashboard)/apps/[appId]`: detalhe com nome, badges, cards editáveis (Identificação, Webhook), card de chave (só app_id, nunca secret), toggle de status com confirmação ao desabilitar.
- `/(dashboard)/proof-requests`: 4 mini-cards de resumo, busca + filtros (status, app, período), tabela com paginação refletida na URL.
- `/(dashboard)/proof-requests/[requestId]`: header com Request ID + status, grid 2 colunas (resumo + atributos confirmados + JSON da resposta || timeline + privacy card).
- `/(dashboard)/proof-requests/new` (helper de teste): form com app + proof_type + external_reference; precisa de endpoint internal autenticado por sessão (não API key, já que dashboard não tem o secret).
- `/(dashboard)/settings`: perfil da company com inputs editáveis (`PATCH /api/companies/me` a criar), Stripe card como placeholder fora-de-escopo, botão de logout com confirmação. **Hoje usa dados mockados — migrar.**
- Cleanup: pasta duplicada `/apps/novo` deve ser removida ou redirecionar para `/apps/new`.

### Tela coringa

- Layout independente (sem sidebar/topbar), container centrado ~520px, marca YaID.
- 6 estados visuais: `waiting_user` (deep link + QR + tempo restante), `opened` (spinner aguardando), `approved` (sucesso + `return_url` opcional), `rejected`/`cancelled` (mensagem genérica), `expired` (mensagem clara), inválida (link inválido genérico, sem enumeration).
- Polling em `GET /api/proof-sessions/{token}` a cada 5–10s nas fases ativas; para nas fases terminais. SSE como roadmap.
- Mobile esconde QR e dá destaque ao botão de deep link; desktop mostra QR.
- A tela exibe apenas: nome da company, proof_type traduzido para linguagem natural, status, tempo até expirar. Nunca: `external_reference`, `session_token` bruto, `request_id` interno.

### APIs

- **Dashboard (sessão Supabase, cookie-based):** `POST /api/companies`, `GET/PATCH /api/companies/me`, `POST/GET /api/company-apps`, `GET/PATCH /api/company-apps/{appId}`, `GET /api/proof-requests`, `GET /api/proof-requests/{id}`, `POST /api/auth/sign-out`.
- **B2B (API key bearer):** `POST /api/proof-requests`.
- **Tela coringa (público + posse do token):** `GET /api/proof-sessions/{sessionToken}`.
- **App mobile (assinatura por DID + posse do session_token):** `POST /api/credentials/issue`, `POST /api/credentials/revoke`, `GET /api/proof-sessions/{sessionToken}/challenge`, `POST /api/presentations/verify`, `POST /api/proof-sessions/{sessionToken}/cancel`.
- **Públicas:** `GET /api/webhook-public-key`.

### Ordem de implementação sugerida

Track Frontend (paralelo, pode começar imediatamente): migrar apps de localStorage para API; migrar settings; migrar overview; implementar signup + guards; fetch wrapper global com 401-redirect; confirmações destrutivas; detalhe da proof_request com timeline; listagem completa com filtros/paginação na URL; tela coringa completa com polling + QR + estados; remover `/apps/novo` duplicado.

Track Backend: adicionar campos de challenge em proof_sessions; `GET /api/proof-sessions/{token}/challenge`; módulo `identity` + `POST /api/credentials/issue` (OCR mock + emissão de VC + chamada on-chain); módulo `blockchain` + smart contract Hardhat + ethers.js; `POST /api/presentations/verify`; módulo `webhook` + assinatura Ed25519; `GET /api/webhook-public-key`; cancel e revoke; deploy do contrato em Sepolia; resolver TBDs.

## Testing Decisions

### O que faz um bom teste neste projeto

Testar **comportamento externo**, não detalhes de implementação. Para módulos do core (use cases, entidades de domínio), o "comportamento externo" é o contrato público da camada `application` e do `domain`. Para route handlers, o comportamento externo é o que o cliente HTTP vê. Mocks devem ser raros: prefira fakes em memória das interfaces (`InMemoryCompanyRepository`, etc.) e dois testes de integração contra Postgres real cobrindo as queries críticas (isolamento por company, criação de proof_request + proof_session em transação).

Não testar: getters de entity, factory composition, framework code (Next.js routing).

### Módulos prioritários para teste

- **`modules/company-app` — Sha256ApiKeyHasher e CreateCompanyApp use case:** verificar formato `<app_id>.<secret>`, que o secret é exibido só na resposta e nunca persistido em texto puro, que hash bate em verify.
- **`modules/proof-request` — CreateProofRequestUseCase:** API key inválida ou de app desabilitado é rejeitada; criação atômica de request + session com TTL e token gerado; URLs derivadas no momento da resposta sem persistência.
- **`modules/proof-request` — GetProofRequestUseCase + isolamento por company:** request de outra company retorna NotFound (não 403, para evitar enumeration).
- **Endpoint de validação de VP (a implementar):** todas as 11 regras de validação em §6.5 do esboço anterior viram casos de teste, cada um produzindo o motivo correto.
- **Auth do app mobile (a implementar):** payload com timestamp fora da janela é rejeitado; signature mismatch é rejeitado; DID malformado (não no formato `did:yaid:user:<pubkey>` ou pubkey não-decodificável) é rejeitado.
- **Webhook signer (a implementar):** assinatura Ed25519 verificável com a public key publicada; corpo bruto preservado (não re-serializado).
- **Frontend — fluxo de revelação da API key:** componente do modal não permite avançar sem o checkbox confirmado.
- **Frontend — fetch wrapper 401:** uma resposta 401 dispara redirect com `?next=<path>` preservado.

### Prior art na codebase

Hoje a codebase não tem testes automatizados estabelecidos. A introdução deve seguir o padrão modular do projeto: testes ao lado do módulo, isolados de Supabase real quando possível, com fakes em memória das interfaces de repositório/service definidas em `domain/`. Para o smart contract, usar a infra do Hardhat (testes em `.ts` rodando contra a chain local).

## Out of Scope

- Implementação interna do app mobile (Expo/React Native) — codebase separada.
- Implementação interna do smart contract — codebase separada. Este PRD documenta apenas o esboço da interface.
- Selective disclosure criptográfico (SD-JWT, BBS+) e ZKP.
- Múltiplos proof_types em uma única request (composição de claims).
- Distinção sandbox / production / homologação. **No MVP cada app é apenas um app** — não há campo `environment`, não há ambientes separados, não há comportamento diferenciado por ambiente. Quando uma proof_request é criada, ela é "real" — não existe modo simulado. Filtros, badges e telas que exibiriam ambiente ficam removidos do MVP.
- Tabela `identity_submissions` ou qualquer tabela com referência a holder/VC (proibido pelo princípio de privacidade).
- Cadastro/login centralizado de holders (Supabase Auth para holder).
- Rotação de API key e múltiplas API keys por app.
- `company_members` para multi-usuário por company.
- Tabela `webhook_deliveries` com retry exponencial e reenvio manual.
- Painel analítico avançado.
- Stripe billing real (placeholder visual no MVP).
- Reset de senha por email (TBD se entra no MVP).
- Confirmação de email obrigatória antes de liberar acesso ao dashboard (TBD).
- "Testar webhook" no detalhe do app (TBD).
- KMS/Vault para chaves (env vars no MVP).
- Cache de leituras on-chain.
- RLS no Postgres (isolamento server-side no MVP).
- Console admin da YaID para revogações forçadas.
- Onboarding documental fora do RG.
- i18n (PT-BR fixo no MVP).
- Otimização mobile do dashboard.

## Further Notes

### Princípios não-negociáveis (vetar qualquer decisão futura que viole)

1. Nenhum dado do holder em tabela centralizada da YaID — apenas blockchain.
2. Empresa parceira nunca recebe VC ou VP — só `valid` booleano e metadados.
3. VC carrega só claims booleanos — nunca PII.
4. API key nunca em texto puro — apenas hash. Consequência: webhook signing é assimétrico, não HMAC.
5. App mobile autentica por assinatura da chave privada do holder — sem cadastro centralizado.

### Decisões em aberto (TBD)

- Provider de OCR concreto (Google Vision, AWS Textract, IDWall, Unico, etc.) — decidir após prototipar com 1–2 amostras de RG.
- Reintrodução de ambientes (sandbox vs production) como feature pós-MVP: estratégia a definir (chains separadas, simulador, flag por app etc).
- Métricas específicas exibidas no overview e definição precisa dos trends (vs período anterior).
- Política de retry de webhook e formato da tabela `webhook_deliveries`.
- Razões de rejeição estruturadas: enum (`user_cancelled` | `vc_invalid` | `vc_revoked` | `session_expired` | `nonce_mismatch` | `holder_mismatch`) ou ausência no MVP.
- Endpoint internal para o helper `/proof-requests/new` do dashboard criar requests via sessão (já que o secret da API key não está acessível ao dashboard).
- Fluxo de signup: SDK Supabase no client vs endpoint próprio.
- Confirmação de email obrigatória antes de liberar dashboard.
- Reset de senha e edição de email/senha em settings — entram no MVP?
- "Testar webhook" no detalhe do app — entra no MVP?
- Algoritmo de hashing da API key — manter SHA-256 ou subir para Argon2/bcrypt.
- `return_url` opcional na criação da proof_request para a tela coringa oferecer botão de volta após sucesso.

### Estado de implementação na codebase em 2026-05-11

**Implementado e estável:** auth Supabase, criação de `auth.users` e `public.companies` (hoje em duas etapas: signup + tela `/onboarding/company` — **precisa ser fundido em um signup atômico único**, ver seção de ajustes), CRUD de company_apps com revelação one-shot, `POST /api/proof-requests` por API key, `GET /api/proof-requests` + filtros básicos no dashboard, `GET /api/proof-requests/{id}`, tela coringa básica, `GET /api/proof-sessions/{sessionToken}`, estrutura modular em camadas.

**Implementado mas precisa ajuste:** `proof_sessions` ainda persiste `verification_page_url` e `deep_link_url` (remover, derivar do token); falta `challenge_nonce_hash` e `challenge_created_at`; hash da API key é SHA-256 simples (avaliar Argon2/bcrypt); Overview/Settings/Apps usam dados mockados ou localStorage (migrar para API real); falta fetch wrapper 401-redirect; faltam confirmações destrutivas; tela coringa sem polling/QR/estados completos; pasta duplicada `/apps/novo`.

**A implementar:** todos os fluxos do app mobile (issue, challenge, presentations/verify, cancel, revoke), módulo blockchain + smart contract + integração ethers, módulo webhook com assinatura Ed25519, `GET /api/webhook-public-key`, signup atômico unificado (com remoção da rota `/onboarding/company`), deploy Sepolia.

### Definição de pronto do MVP

Demo ponta a ponta: empresa cria conta em um formulário único (email + senha + nome + CNPJ → `auth.users` + `public.companies` criados atomicamente), cai direto no overview, cria um app, copia API key, chama `POST /api/proof-requests`, recebe verification_url, holder abre no app mobile (já com VC emitida em fluxo separado contra documento, com DID registrado em Sepolia), assina VP, backend valida tudo (incluindo lookup on-chain de DID e revogação), envia webhook Ed25519, empresa vê request approved no dashboard com timeline. Holder revoga VC; tentativa subsequente da empresa é rejected. Nenhum dado pessoal aparece em qualquer tabela do Supabase. Os três envs de chave estão configurados e validados no boot. **Em nenhum momento existe uma sessão sem company associada.**
