---
stepsCompleted: [1, 2, 3, 4, 5]
status: complete
completedAt: '2026-05-11'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-27.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
sprintChangeRun:
  date: '2026-07-27'
  stepsCompleted: [1, 2, 3]
  approach: 'Incremento sobre epics.md concluído — Epics 1–6 (todas stories done) permanecem intocados; Sprint Change 2026-07-27 entra como novo(s) épico(s) inserido(s).'
  newRequirements: 'FR26–FR34, UX-DR1–UX-DR6, requisitos adicionais de migrations/VC-JWT.'
sprintChangeRuns:
  - date: '2026-07-28'
    approach: 'Correção de semântica de claims — Ajuste Direto dentro do Epic 5 (in-progress). Stories 5.7 e 5.8 acrescidas; 5.4 e 5.5 recebem notas de superseção parcial; ACs de 9.1/9.2 ajustados para preservar a correção. Nenhuma migration.'
    decisions: 'Claims consolidadas (ambas na mesma VC); menor de 18 emite com ageOver18:false em vez de 422; verificação passa a exigir correspondência claim ↔ proof_type; proofType removido do body de emissão (opção C1).'
  - date: '2026-07-28'
    approach: 'Adendo §7 — higiene de configuração e chaves. Epic 10 criado (transversal a shared/, Epic 5 e Epic 6): stories 10.1 (centralização das chaves de teste no environments.ts, removendo 4 substituições locais) e 10.2 (validação de formato de chaves no boot). Independente das stories 5.7/5.8.'
    decisions: 'environments.ts entrega valores prontos — proibido remendar configuração no ponto de uso; formato de chave validado no boot, não em runtime; placeholders do TEST_ENV recusados fora do stage TEST; ordem obrigatória 10.1 antes de 10.2.'
---

# yaid_dashboard - Epic Breakdown

## Overview

Este documento fornece o detalhamento completo de épicos e stories para o yaid_dashboard, decompondo os requisitos do PRD e Architecture em stories implementáveis.

## Requirements Inventory

### Functional Requirements

FR1: O sistema deve permitir cadastro de nova empresa com email, senha, nome da empresa e CNPJ obrigatório em um único formulário atômico — criando `auth.users` e `public.company` na mesma operação; falha em qualquer passo desfaz ambos. Não existe estado "usuário sem company".

FR2: O sistema deve autenticar empresas via Supabase Auth; pós-login redireciona para "/" (ou `?next=<path>` se preenchido); tela `/sign-up` redireciona direto para "/" após cadastro bem-sucedido.

FR3: O dashboard deve exibir uma página de overview com aviso institucional de privacidade e card "próximo passo recomendado" adaptativo — alimentado por API real (sem metric cards ou tabela de métricas no MVP).

FR4: O sistema deve permitir listagem de company_apps (busca tudo, sem filtros nem paginação no MVP), alimentado por `GET /api/company-apps`.

FR5: O sistema deve permitir criação de novo company_app com formulário de 2 cards (Identificação, Webhook) + sidebar institucional; após submit deve exibir modal bloqueante com API key (font-mono, copiável), aviso "única vez", checkbox bloqueante de confirmação, e botão de conclusão desabilitado até confirmar. ESC não fecha o modal.

FR6: O sistema deve exibir detalhe de company_app com nome, badges, cards editáveis (Identificação, Webhook), card de chave (só app_id, nunca secret), e toggle de status com confirmação ao desabilitar.

FR7: O sistema deve exibir listagem de proof_requests com 4 mini-cards de resumo acima da tabela (total, aprovadas, pendentes, rejeitadas — calculados do conjunto completo retornado por `GET /api/proof-requests`) e tabela simples (busca tudo, sem filtros nem paginação no MVP).

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

<!-- ── Sprint Change 2026-07-27: requisitos novos (FR26–FR34). Não alteram FR1–FR25. ── -->

FR26 (#1 Marca): O sistema deve substituir o placeholder `ShieldHalf` + texto "YaID" hardcoded pelo ícone oficial `public/yaid_icon.svg` nas 4 superfícies de marca (sidebar do dashboard 28px, tela coringa 48px, `/sign-in`, `/sign-up`), preservando dimensões/posição e removendo imports órfãos. Troca puramente de asset — não altera layout, hierarquia nem paleta.

FR27 (#2 Topbar): A topbar deve ser dinâmica, consumindo `GET /api/companies/me` — exibindo o nome real da company logada + avatar com inicial dinâmica derivada desse nome. Exibe `Skeleton` durante o carregamento; em erro mantém avatar neutro sem bloquear navegação. Remove os valores hardcoded ("Acme Identidade Ltda.", "Maria R."/"MR") e o badge global "Homologação"/`EnvBadge` da topbar.

FR28 (#3 Ambiente por app): A criação de app deve incluir um seletor de `environment` (`Select` Homologação/Produção, Zod `z.enum(["homol","prod"])`, default seguro `homol`) enviado no `POST /api/company-apps`. O `EnvBadge` passa a ser exibido no nível do app (âmbar Homologação / azul Produção) em `/apps` e `/apps/[appId]`, ao lado do `StatusBadge`. Ambiente é propriedade estável do app — imutável após criação no MVP.

FR29 (#4 Review manual): O sistema deve expor `POST /api/proof-requests/{requestId}/review` (auth sessão) + usecase que, apenas para apps em `homol` e proof_request em status não-terminal, transiciona a request para `approved`/`rejected`, seta `updated_at = now()` e dispara o webhook normal (`DeliverWebhookUseCase`). Botões Aprovar/Reprovar condicionais na UI de detalhe (com `AlertDialog`); guard server-side rejeita review em apps `prod` e em status terminal (defesa em profundidade).

FR30 (#5 updated_at): O sistema deve adicionar a coluna `proof_requests.updated_at TIMESTAMPTZ DEFAULT now()`, propagá-la em entity/mapper/repositório; `updateStatus()` grava `updated_at = now()` em toda transição de status; o viewmodel mapeia da coluna real (corrige o "Atualizada em" sempre `null`, antes aliasado de `validated_at`).

FR31 (#6 Resposta da API): O sistema deve remover a seção "Resposta da API" (saída bruta da rota GET em `CodeBlock`/`payload`) da tela unitária da proof_request, mantendo resumo, atributos confirmados, timeline e `PrivacyCard`. Limpar imports órfãos.

FR32 (#7 Allowlist): O sistema deve adicionar a coluna `company.can_create_apps BOOLEAN NOT NULL DEFAULT false` (backfill `true` para empresas existentes na migration); guard no `CreateCompanyAppUseCase` que rejeita com `AppError("Company not allowed to create apps", 403)` quando `false`; frontend desabilita o CTA "Criar app" com banner explicativo (comportamento tipo assinatura, sem Stripe).

FR33 (#8 VC-JWT): O backend deve emitir a Verifiable Credential como VC-JWT compacto assinado (JWS EdDSA) — header `{alg:"EdDSA", typ:"JWT", kid:"<issuerDid>#key-1"}`, payload `{iss, sub:<holderDid>, jti, iat, nbf, vc:{...claims booleanos}}`, assinado com `ISSUER_PRIVATE_KEY` — em vez de JSON-LD com `proof.Ed25519Signature2020` embutido. `POST /api/credentials/issue` retorna a string JWT; `POST /api/presentations/verify` decodifica e valida a VC no formato JWT. Invariante preservado: a VC continua carregando apenas claims booleanos — muda o formato de serialização/assinatura, não o conteúdo.

FR34 (#9 Migrations): O sistema deve versionar o schema via Supabase Migrations — diretório `supabase/` versionado (`config.toml`, `migrations/`, `seed.sql`), CLI linkada ao project-ref `lygkwhcwsrxfozswhxyo`. Baseline (`supabase db pull`) captura o schema hoje deployado (encerra o drift); forward migrations timestampadas para `add_updated_at_to_proof_requests`, `add_can_create_apps_to_company` (+ backfill) e ajuste de `environment`/default em `company_apps`. `.gitignore` cobre `supabase/.branches` e `supabase/.temp`; CI opcional roda `supabase db diff --check` no PR.
> Nota (Sprint Change 2026-08-08): além do `db diff --check` opcional no PR, o release em `prod` aplica migrations pendentes via `supabase db push` (precedido de `--dry-run`) como primeiro passo de infra da pipeline, antes do deploy do app (ver Epic 11 / NFR11).

### NonFunctional Requirements

NFR1: Nenhum dado pessoal do holder pode ser armazenado em tabela relacional — apenas `hash(vc_id)` e DID na blockchain (princípio de privacidade não-negociável e estrutural).

NFR2: API key nunca em texto puro — apenas `SHA-256("<app_id>.<secret>")` armazenado. Consequência direta: webhook signing é assimétrico (Ed25519), não HMAC.

NFR3: Três chaves privadas distintas em env vars sem reuso entre papéis: `ISSUER_PRIVATE_KEY` (Ed25519), `WEBHOOK_SIGNING_PRIVATE_KEY` (Ed25519), `BLOCKCHAIN_WALLET_PRIVATE_KEY` (secp256k1). Em `PROD`/`HOMOLOG`, elas e `BLOCKCHAIN_CONTRACT_ADDRESS` são validadas no boot. Em `DOTENV`/`DEV`, fluxos que não usam issuer/blockchain podem rodar sem essas envs; getters específicos falham quando a funcionalidade dependente for usada.

NFR4: Replay protection em autenticação mobile: requisições com timestamp fora da janela de ±5min são rejeitadas; DID malformado é rejeitado; signature mismatch é rejeitado.

NFR5: Empresa parceira nunca recebe VC ou VP — apenas booleano `valid` e metadados de status.

NFR6: Erros de enumeração não devem vazar informação — proof_request de outra company retorna `NotFound` (não 403).

NFR7: OCR de documentos (RG) deve processar em memória — zero persistência de imagem ou dado pessoal no banco.

NFR8: Isolamento server-side por `company_id` em todas as queries (sem RLS no MVP).

NFR9: Shape de erro uniforme `{ error: string }` com HTTP status code adequado em toda a API. Nunca expor stack trace, secrets, queries SQL ou detalhes internos.

NFR10: PT-BR fixo, sem i18n no MVP. Desktop-first; mobile funcional não otimizado.

NFR11: Deploy em AWS Amplify (app SSR/Web Compute). O release de produção é orquestrado pelo GitHub Actions na branch `prod` com gates sequenciais `tests → deploy-supabase → deploy-amplify → smoke-test`; auto-build do Amplify desabilitado na branch `prod` (evita deploy duplicado). Lint/typecheck permanecem como validação (o build Next.js no Amplify executa o typecheck).

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
- Implementar `proxy.ts` global (Next.js 16) com roteamento por prefixo de rota para 4 mecanismos de auth distintos (sessão Supabase, API key bearer, DID signature, session token), delegando a lógica para `src/shared/middleware.ts`.
- `process.env` somente em `src/shared/environments.ts` — lido e validado no boot; nenhuma outra camada lê env vars diretamente.
- Integração com blockchain (Hardhat local no dev, Sepolia no MVP) — biblioteca client **TBD**: agente implementador deve questionar qual library usar, estratégia de retry e tratamento de latência on-chain antes de implementar.
- Integração com OCR em memória — provider **definido (Sprint Change 2026-08-19): Mistral Document AI** (`POST https://api.mistral.ai/v1/ocr`, `mistral-ocr-latest`) com `document_annotation_format` (JSON Schema) retornando `{ name, cpf, birthDate }`. O backend **valida** a saída (formato de CPF e de data), **nunca extrai campos de texto corrido por regex**. Autenticação por `MISTRAL_API_KEY` (obrigatória em todo ambiente real); modelo e endpoint são constantes no client. SDK `@mistralai/mistralai` restrito à implementação concreta.
- Algoritmos e bibliotecas de criptografia — **TBD** para cada papel: agente implementador deve questionar biblioteca a usar para assinatura Ed25519 do issuer, webhook e auth mobile.
- Testes unitários co-locados ao módulo (ao lado dos arquivos de source); fakes em memória para repositórios; dois testes de integração contra Postgres real cobrindo queries críticas (isolamento por company, criação atômica de proof_request + proof_session).
- Campos camelCase em todas as respostas da API — ViewModel é responsável por transformar snake_case do banco.
- `session_token_hash` — o token bruto é devolvido apenas na resposta de criação da proof_request; nunca rearmazenado.
- Deploy do smart contract em Sepolia testnet; YaID paga gas com wallet de serviço; holder nunca paga gas.

<!-- ── Sprint Change 2026-07-27: requisitos adicionais ── -->

- **Baseline de migration fiel ao deployado:** o baseline (`supabase db pull`) deve refletir fielmente o schema hoje em produção — que carrega o drift real (`validated_at`/`external_ref`/`result`, sem `updated_at`) — **antes** de qualquer `db push`. As forward migrations reconciliam o banco com o schema-alvo (`updated_at`, `can_create_apps`, `environment`).
- **VC-JWT exige coordenação externa** com a codebase do app mobile YaID Wallet — o formato do JWT (header/payload/assinatura) é um contrato cripto entre backend e mobile e deve ser acordado antes do rollout.
- **Biblioteca de JWS/EdDSA** para emissão/verificação do VC-JWT — ⚠️ **TBD**: agente implementador deve questionar qual biblioteca usar antes de implementar (#8).
- **Ordem de implementação recomendada (Seção 3 do Sprint Change):** #9 (migrations) → #5/#7 (schema) → #3 (ambiente) → #4 (review) → #2/#1/#6 (frontend) → #8 (VC-JWT). Reduz retrabalho: migrations primeiro estabelecem o canal para as mudanças de schema seguintes.

### UX Design Requirements

Documento UX encontrado: [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md), com seção dedicada "Atualizações de Design — Sprint Change 2026-07-27". UX-DRs extraídos abaixo (referentes ao Sprint Change; o restante do UX Spec já está refletido nas stories concluídas dos Epics 1–6).

UX-DR1 (#1 Marca): Trocar o asset de marca pelo `public/yaid_icon.svg` nas 4 superfícies, preservando layout, hierarquia e paleta — troca puramente de asset.

UX-DR2 (#2 Topbar): Topbar dinâmica com `Skeleton` no carregamento (nunca nome placeholder), avatar com inicial + `aria-label` contendo o nome real da company (texto da inicial não basta para leitor de tela), sem badge global de ambiente.

UX-DR3 (#3 Ambiente): `Select` de ambiente no card *Identificação* de `/apps/new` com texto auxiliar explicativo ("Apps de homologação permitem aprovar/reprovar verificações manualmente para teste. Produção não."); `EnvBadge` (âmbar Homologação / azul Produção, sempre acompanhado de texto) ao lado do `StatusBadge` em `/apps` e `/apps/[appId]`.

UX-DR4 (#4 Review): Botões Aprovar (primary/green) e Reprovar (destructive) na área de ações do header do detalhe, visíveis apenas em `homol` + status não-terminal; cada um com `AlertDialog` de confirmação ("Esta ação envia o webhook real para o app e não pode ser desfeita.") e `toast.success` ao concluir; atualiza status na tela e o campo "Atualizada em".

UX-DR5 (#6 Resposta da API): Remover a seção "Resposta da API" da tela de detalhe preservando a grade 2 colunas (resumo + atributos confirmados || timeline + privacy card).

UX-DR6 (#7 Allowlist): CTA "Criar app" em estado bloqueado com banner explicativo quando `can_create_apps` é falso (comportamento tipo assinatura, sem Stripe).

### FR Coverage Map

FR1: Epic 1 — Signup atômico (auth.users + public.company em transação única)
FR2: Epic 1 — Login Supabase com redirect pós-auth
FR10: Epic 1 — Settings da company (migrar de mocks para API real)
FR22: Epic 1 — fetchWithAuth global com redirect 401
FR23: Epic 1 — Confirmações para ações destrutivas (logout, desabilitar app)
FR4: Epic 2 — Listagem de apps via GET /api/company-apps (sem filtros no MVP)
FR5: Epic 2 — Criação de app com modal bloqueante de API key one-shot
FR6: Epic 2 — Detalhe e edição de app, toggle de status
FR25: Epic 2 — Hash SHA-256 de "<app_id>.<secret>"
FR3: Epic 3 — Overview página inicial (sem métricas no MVP)
FR7: Epic 3 — Listagem de proof_requests com 4 mini-cards de resumo (sem filtros/paginação no MVP)
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
FR34: Epic 7 — Versionamento de schema (baseline + forward migrations) [fundação]
FR30: Epic 7 — proof_requests.updated_at em toda transição de status
FR32: Epic 7 — Allowlist can_create_apps (guard 403 + UI bloqueada + backfill)
FR28: Epic 7 — Seletor de ambiente na criação de app + EnvBadge no nível do app
FR29: Epic 7 — Review manual (aprovar/reprovar) em apps homol + webhook real
FR31: Epic 7 — Remoção da seção "Resposta da API" no detalhe da proof_request
FR26: Epic 8 — Ícone oficial yaid_icon.svg nas 4 superfícies de marca
FR27: Epic 8 — Topbar dinâmica (company logada, sem badge global de ambiente)
FR33: Epic 9 — Emissão/verificação da VC como VC-JWT (EdDSA)

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

> **Sprint Change 2026-07-28:** acrescidas as stories 5.7 (claims consolidadas na emissão — uma
> credencial responde às duas perguntas; menor de 18 recebe `ageOver18: false`, não 422) e 5.8
> (a verificação passa a exigir que a claim apresentada corresponda ao `proof_type` pedido).
> Stories 5.4 e 5.5 recebem notas de superseção parcial.

### Epic 6: Webhooks e Conclusão do Fluxo B2B

Empresa parceira recebe notificações automáticas e criptograficamente verificáveis (Ed25519) sobre o resultado das validações, podendo checar autenticidade dos webhooks com a chave pública publicada.

**FRs cobertos:** FR20, FR21

<!-- ── Sprint Change 2026-07-27: novos épicos (7, 8, 9). Epics 1–6 permanecem intocados. ── -->

### Epic 7: Ambientes por App, Governança de Criação e Review em Homologação

A empresa cria apps escolhendo o ambiente (homologação/produção) e sujeita à allowlist de criação; apps de homologação permitem aprovar/reprovar verificações manualmente disparando o webhook real; o campo "Atualizada em" reflete cada transição. Estabelece a fundação de versionamento de schema (Supabase Migrations) que serve a todas as mudanças de banco.

**FRs cobertos:** FR34, FR30, FR32, FR28, FR29, FR31

### Epic 8: Marca Oficial e Topbar Integrada

O dashboard reflete a identidade visual oficial da YaID (ícone real em todas as superfícies) e o usuário logado (nome real da company + avatar dinâmico), removendo placeholders de demonstração e o badge global de ambiente.

**FRs cobertos:** FR26, FR27

### Epic 9: Verifiable Credential como VC-JWT

O app mobile passa a receber a VC como JWT assinado (EdDSA) — formato compacto verificável na apresentação — em vez de JSON-LD com prova embutida. Isolado nos módulos `identity` + `presentation`; exige coordenação externa com a codebase do YaID Wallet.

**FRs cobertos:** FR33

<!-- ── Sprint Change 2026-07-28: Epic 10 (higiene de configuração). Epics 1–9 inalterados exceto 5 e 9. ── -->

### Epic 10: Higiene de Configuração e Chaves

`environments.ts` volta a ser a fonte única de configuração: as chaves de teste deixam de ser remendadas dentro dos use cases e o formato das chaves passa a ser validado no boot, não na primeira requisição. Elimina o risco de uma chave privada publicamente conhecida ser aceita em produção.

**FRs cobertos:** nenhum (dívida técnica / hardening) — decorre da decisão de arquitetura *"`process.env` somente em `src/shared/environments.ts`"* e da exigência de validação de chaves no boot em `PROD`/`HOMOLOG`.

### Epic 11: Pipeline de CI/CD de Produção

Todo merge/push em `prod` dispara um release determinístico e auditável orquestrado pelo GitHub Actions: roda os testes unitários como gate, aplica migrations pendentes no Supabase Cloud (dry-run antes do push), publica o app no Amplify via `start-job RELEASE` (com auto-build desabilitado), aguarda o deployment em estado terminal e valida a aplicação por health check (`GET /api/health`, com a URL de produção vinda da Variable `vars.NEXT_PUBLIC_APP_URL`). Inclui autenticação AWS por `sts:AssumeRole` (least-privilege), sincronização **autoritativa** de env vars derivada do `.env.local.example` (replace via `update-branch`; nomes vêm do `.env.local.example`, valores resolvidos pela colocação Secrets→Variables; secrets nunca em `NEXT_PUBLIC_*` nem em logs) e documentação operacional (IAM, custom domain, bootstrap vs release, rollback). Estrutura distribuída: cada job em `.github/jobs/<nome>/action.yml` (composite action), orquestrado por `.github/workflows/production.yml`.

> **Nota (Sprint Change 2026-08-09):** a Story 11.8 revisa o sync de env vars para o modelo
> **autoritativo derivado do `.env.local.example`** (substituindo o `merge` originalmente entregue na
> Story 11.5): toda variável do `.env.local.example` passa a existir no Amplify e qualquer variável
> fora dessa lista desaparece do branch. Classificação Secret/Variable por
> `KEY|PASSWORD|PRIVATE|SECRET|TOKEN`, com exceções `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`→Variable e
> `BLOCKCHAIN_RPC_URL`→Secret. `YAID_VERIFICATION_BASE_URL` deixa de ser env var. O secret
> `AMPLIFY_ENVIRONMENT_VARIABLES` é removido.

> **Nota complementar (Sprint Change 2026-08-09 — simplificação de env vars):** duas correções sobre o
> resultado da Story 11.8, sem nova story (escopo *minor*: refactoring interno + ajuste de CI).
>
> 1. **Smoke-test sem `PRODUCTION_URL`.** O secret `PRODUCTION_URL` era redundante com a Variable
>    `NEXT_PUBLIC_APP_URL` (já sincronizada ao Amplify e consumida pelo app), obrigando o operador a
>    manter o mesmo valor em dois lugares. O job de smoke-test passa a receber a URL de produção de
>    **`vars.NEXT_PUBLIC_APP_URL`** e o secret `PRODUCTION_URL` é **eliminado** do GitHub.
> 2. **`YAID_VERIFICATION_BASE_URL` não é mais um getter.** O getter derivado introduzido pela Story
>    11.8 em `environments.ts` (e o membro correspondente em `RuntimeEnv`) é **removido**: expor um
>    valor computado viola a regra de que `environments.ts` só expõe env vars reais. A URL de
>    verificação passa a ser derivada **inline no único consumidor**
>    (`create_proof_request_usecase.ts`) como `` `${env.NEXT_PUBLIC_APP_URL}/v/${token}` ``. Sem
>    normalização de barra final: a convenção documentada no `.env.local.example` é
>    `NEXT_PUBLIC_APP_URL` **sem** barra final.

**FRs cobertos:** nenhum (infraestrutura de entrega / operação) — decorre de NFR11.

---

## Epic 1: Fundação Técnica e Acesso Empresarial

Empresa parceira pode se registrar em um único formulário atômico, acessar o dashboard de forma segura e gerenciar configurações da conta. A base de código está limpa, com módulos em `src/`, schema correto e `environments.ts` validando chaves no boot.

### Story 1.1: Reestruturação de Código e Ambiente

Como desenvolvedor,
Quero migrar a codebase para a estrutura `src/` com path aliases e environments validados no boot,
Para que todo desenvolvimento subsequente siga o padrão arquitetural estabelecido sem ambiguidade.

**Acceptance Criteria:**

**Given** o projeto Next.js existente com módulos em `modules/` (raiz)
**When** a reestruturação é aplicada
**Then** o `tsconfig.json` contém path aliases `@/modules/*` → `src/modules/*` e `@/shared/*` → `src/shared/*`
**And** os módulos `company`, `company-app` e `proof-request` estão em `src/modules/` seguindo a convenção `{action}_{feature}_{usecase|controller|presenter|viewmodel}.ts`
**And** `src/shared/environments.ts` é o único arquivo que lê `process.env`, exporta config tipada e lança erro no boot em `PROD`/`HOMOLOG` se `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY` ou `BLOCKCHAIN_CONTRACT_ADDRESS` estiverem ausentes; em `DOTENV`/`DEV`, getters dependentes falham apenas quando usados
**And** as pastas `app/(dashboard)/apps/novo/` e `app/onboarding/` são removidas da codebase
**And** todos os fluxos existentes (login, listagem de apps, listagem de proof_requests, tela coringa básica) continuam funcionando sem regressão após a migração

---

### Story 1.2: Middleware de Autenticação

Como desenvolvedor,
Quero um `proxy.ts` centralizado que roteie cada prefixo de rota para o mecanismo de autenticação correto,
Para que cada camada da API seja protegida de forma consistente sem lógica duplicada nos route handlers.

**Acceptance Criteria:**

**Given** o arquivo `proxy.ts` na raiz do projeto, delegando para `src/shared/middleware.ts`
**When** uma requisição entra no servidor
**Then** o middleware roteia por prefixo de rota:
  - `/api/company-apps`, `/api/companies`, `/api/proof-requests` (GET), `/api/auth/sign-out` → `withSessionAuth` (cookie Supabase)
  - `POST /api/proof-requests` → `withApiKeyAuth` (bearer token)
  - `/api/proof-sessions/{token}/challenge`, `/api/presentations/verify`, `/api/credentials/*`, `/api/proof-sessions/{token}/cancel` → `withDIDAuth` (DID signature — implementado no Epic 5)
  - `GET /api/proof-sessions/{token}`, `GET /api/webhook-public-key` → público (sem middleware de auth)
  - Rotas `/(dashboard)` → redirect para `/sign-in?next=<path>` se sem sessão Supabase válida

**Given** um usuário autenticado acessando qualquer rota de `/(dashboard)`
**When** o middleware valida a sessão
**Then** a requisição prossegue normalmente; nenhum dado de sessão é exposto para rotas públicas

**Given** a codebase após a implementação do middleware
**When** qualquer route handler autenticado por sessão é revisado
**Then** não há lógica de validação de sessão duplicada dentro do handler — essa responsabilidade pertence exclusivamente ao middleware

---

### Story 1.3: Migration SQL e Dependências de Formulário

Como desenvolvedor,
Quero aplicar as migrações de schema e instalar as dependências de formulário necessárias,
Para que o banco esteja correto e os formulários do dashboard possam usar validação tipada via React Hook Form + Zod.

**Acceptance Criteria:**

**Given** o banco de dados Supabase do projeto
**When** a migration SQL é aplicada
**Then** as colunas `verification_page_url` e `deep_link_url` são removidas da tabela `proof_sessions`
**And** as colunas `challenge_nonce_hash TEXT` (nullable) e `challenge_created_at TIMESTAMPTZ` (nullable) são adicionadas à tabela `proof_sessions`
**And** os dados existentes são preservados (migration não-destrutiva para dados existentes nas demais colunas)

**Given** o `package.json` do projeto
**When** as dependências são instaladas
**Then** `react-hook-form` e `@hookform/resolvers` estão listados como dependências
**And** `npm run build` completa sem erros após a instalação

**Given** qualquer formulário existente na codebase (login, signup, criação de app)
**When** revisado após esta story
**Then** mantém seu comportamento atual — nenhum formulário existente precisa ser migrado nesta story (a adoção de React Hook Form é incremental, feita story a story)

---

### Story 1.4: fetchWithAuth e Infraestrutura de Auth Client

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seção "Navigation Patterns" (redirect pós-401) e "Feedback Patterns" (tratamento de erros transparente ao usuário).

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

### Story 1.5: Signup Atômico de Empresa

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Signup Atômico sem Onboarding", "Form Patterns" (validação inline, Label acima de Input, Zod onBlur+submit), "Feedback Patterns" (toast de erro, botão disabled durante envio) e "Design Direction Decision" (paleta azul, CSS variables).

Como nova empresa parceira,
Quero me cadastrar com um único formulário contendo email, senha e nome da empresa,
Para que minha conta e company sejam criadas atomicamente — sem estados intermediários nem telas de onboarding adicionais.

**Acceptance Criteria:**

**Given** a página `/sign-up` com os campos: email, senha, confirmação de senha, nome da empresa (obrigatório) e CNPJ obrigatório com máscara
**When** o formulário é submetido com dados válidos
**Then** o endpoint `POST /api/auth/sign-up` cria `auth.users` e `public.company` na mesma operação atômica
**And** se a criação de `auth.users` falhar, nenhuma `company` é criada
**And** se a criação de `public.company` falhar, o `auth.users` recém-criado é desfeito
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

### Story 1.6: Login e Proteção de Rotas

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Form Patterns" (validação inline, Label acima de Input), "Feedback Patterns" (toast de erro genérico sem detalhar email/senha, botão disabled durante envio) e "Navigation Patterns" (redirect pós-login para `/` ou `?next=<path>`).

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

### Story 1.7: Configurações da Empresa

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Form Patterns" (cards de configuração segmentados, botões Salvar/Cancelar), "Modal Patterns" (AlertDialog para logout — ação destrutiva com confirmação), "Feedback Patterns" (toast de sucesso/erro, permanecer na página após salvar) e "Navigation Patterns" (redirects pós-ação).

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Table Patterns" (colunas, badges de status, hover, IDs truncados), "Empty States" (componente `EmptyState` com CTA "Criar primeiro app") e "Feedback Patterns" (Skeleton de loading, Alert de erro com retry).

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Component Strategy" (componentes `ApiKeyModal` e `CopyButton` — especificações de focus trap, sem ESC/clique-fora, checkbox obrigatório), "Form Patterns" (cards segmentados Identificação + Webhook), "Modal Patterns" (categoria ApiKeyModal bloqueante) e "Feedback Patterns" (botão disabled durante envio, toast de sucesso após fechar modal).

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Form Patterns" (cards editáveis por contexto, botões Salvar/Cancelar), "Modal Patterns" (AlertDialog para desabilitar app — ação com impacto assimétrico, confirmação seletiva), "Component Strategy" (`CopyButton` para app_id) e "Feedback Patterns" (toast de sucesso/erro sem resetar os campos).

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Table Patterns" (colunas, badges semânticos, IDs truncados, hover), "Empty States" (componente `EmptyState` sem CTA — instruir via API), "Feedback Patterns" (Skeleton de loading, Alert de erro) e "Design System Foundation" (componente `MetricCard` para os 4 mini-cards de resumo acima da tabela).

Como empresa parceira autenticada,
Quero visualizar todas as minhas proof requests em uma tabela,
Para que eu acompanhe o status de cada validação solicitada sem precisar consultar a API manualmente.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/proof-requests` para um usuário autenticado
**When** a página carrega
**Then** `GET /api/proof-requests` é chamado e os dados são usados para renderizar:
  - 4 mini-cards de resumo acima da tabela, usando o componente `MetricCard` existente:
    - "Total" — contagem total de proof_requests da company
    - "Aprovadas" — contagem com status `approved`
    - "Pendentes" — contagem com status `waiting_user`, `opened` ou `processing`
    - "Rejeitadas" — contagem com status `rejected` ou `expired`
  - Tabela com colunas: ID (truncado), proof_type, status (badge), external_reference (se presente) e data de criação
**And** apenas proof_requests da company autenticada são retornadas (isolamento por `company_id` server-side)
**And** durante o carregamento, tanto os mini-cards quanto as linhas da tabela exibem estado Skeleton

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Privacy Pattern" (componente `PrivacyCard` — bg-blue-50, ícone ShieldCheck, texto de privacidade), "Component Strategy" (layout de grid 2 colunas), "Feedback Patterns" (Skeleton de loading) e "Desired Emotional Response" (linguagem de status clara, sem jargão técnico).

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Form Patterns" (Select para app e proof_type, validação inline Zod), "Feedback Patterns" (botão disabled, toast de sucesso, `CopyButton` para exibir verificationUrl gerada) e "Component Strategy" (componente `EmptyState` se não houver apps ativos).

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Design Opportunities" (card "próximo passo" como onboarding progressivo), "Empty States" (estado inicial guia a próxima ação), "Privacy Pattern" (aviso institucional de privacidade) e "Experience Mechanics" (jornada "Do cadastro à API key em mãos").

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

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — seções "Component Strategy" (componentes `VerificationLayout`, `VerificationStateCard` e `DeepLinkButton` — especificações completas de cada estado visual), "Tela Coringa — Clareza e Confiança, não Urgência", "Jornada 3: Tela Coringa — Todos os Estados do Holder" e "Responsive Design" (Mobile Only: classes sem prefixo de breakpoint, `size="lg"` para touch targets 48px, `lang="pt-BR"` no layout, `aria-live` para mudanças de estado).

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

> ⚠️ **Parcialmente superada pela Story 5.7 (Sprint Change 2026-07-28).** O AC de claims
> (`{ personhood: true }` **ou** `{ ageOver18: true }`) e o retorno 422 para menor de 18 anos
> **não valem mais** — a VC passa a carregar ambas as claims em uma única emissão, e menor de
> idade recebe `ageOver18: false` com sucesso. O parâmetro `proofType` deixa de existir no body.
> As demais regras (assinatura do body, OCR em memória, descarte de PII, `registerDID`) seguem
> válidas. Story mantida como registro do que foi entregue.

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

> ℹ️ **Decisões fechadas:** provider de OCR = **Mistral Document AI** com extração estruturada via `document_annotation_format` (Sprint Change 2026-08-19; ver Story 5.9). Assinatura Ed25519 = `@noble/ed25519` (resolvido na implementação da 5.4).

---

### Story 5.5: Verificação de Verifiable Presentation

> ⚠️ **Regra 5 superada pela Story 5.8 (Sprint Change 2026-07-28).** Validar apenas que as claims
> são booleanas é insuficiente: a verificação passa a exigir que a claim correspondente ao
> `proof_type` da `proof_request` exista e seja **exatamente `true`**. As regras 1–4 e 6–11 seguem
> válidas e inalteradas. Story mantida como registro do que foi entregue.

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
**And** a resposta retorna `{ valid: true }` ao app mobile
**And** o disparo de webhook para este status será integrado pela Story 6.1

**Given** qualquer validação falha
**When** o use case conclui
**Then** `proof_request.status` transiciona para `rejected`
**And** a resposta retorna `{ valid: false }` — sem detalhar qual regra falhou para o app mobile
**And** o disparo de webhook para este status será integrado pela Story 6.1

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
**And** a resposta retorna HTTP 200
**And** o disparo de webhook para este status será integrado pela Story 6.1

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

### Story 5.7: Consolidação de Claims na Emissão de Credencial

> Origem: Sprint Change Proposal 2026-07-28. Supersede parte da Story 5.4.
> **Entrega acoplada à Story 5.8 — não liberar isoladamente** (ver nota ao final da 5.8).

Como holder com app mobile,
Quero que minha credencial responda às duas perguntas em uma única emissão,
Para que eu não precise enviar meu documento mais de uma vez.

**Acceptance Criteria:**

**Given** uma chamada `POST /api/credentials/issue` autenticada por DID
**When** a emissão é processada com sucesso
**Then** a VC é construída com **ambas** as claims: `{ personhood: true, ageOver18: <boolean> }`
**And** `personhood` é sempre `true` — a leitura bem-sucedida do documento é a própria evidência
**And** `ageOver18` é `true` ou `false`, derivado da data de nascimento lida no documento
**And** ambas permanecem estritamente booleanas — nenhuma PII entra na VC

**Given** um holder cuja data de nascimento indica **menos de 18 anos**
**When** a emissão é processada
**Then** a emissão **conclui com sucesso** (HTTP 201)
**And** a VC carrega `{ personhood: true, ageOver18: false }`
**And** **não** é retornado HTTP 422 — não houve falha de processamento

**Given** o contrato de entrada da rota
**When** o body é validado
**Then** aceita `{ documentImage, bodySignature }` — o campo `proofType` **não é mais aceito**
**And** o payload assinado pelo holder passa a ser apenas `documentImage`
**And** a validação da assinatura ocorre antes de qualquer outra operação, como na Story 5.4

**Given** um documento cujo OCR falha (ilegível, ou sem nome/CPF/data de nascimento)
**When** o processamento é executado
**Then** retorna HTTP 422 com `{ error: "Document processing failed" }`
**And** este é o **único** caminho que produz 422 relacionado ao documento

**Given** uma data de nascimento presente mas não parseável para data válida
**When** o cálculo de idade é executado
**Then** retorna HTTP 422 — não é honesto afirmar `ageOver18: false` quando a idade é desconhecida

**Given** o fluxo existente de emissão (Story 5.4)
**When** esta story é aplicada
**Then** a validação da assinatura do body, o OCR em memória, o descarte de PII e o
`registerDID` on-chain permanecem inalterados

> **Vocabulário canônico (fixado nesta story):** `proof_type` na API e no banco usa
> `personhood` | `age_over_18`; a chave de claim dentro da VC usa `personhood` | `ageOver18`.
> O mapeamento entre as duas formas vive em **um único lugar** — criar o enum `ProofType` em
> `src/shared/domain/enums/ProofType.ts` (referenciado no `architecture.md`, mas inexistente hoje),
> consumido tanto pela emissão quanto pela verificação.

---

### Story 5.8: Correspondência entre Claim Apresentada e Proof Type Solicitado

> Origem: Sprint Change Proposal 2026-07-28. Supersede a Regra 5 da Story 5.5.

Como empresa parceira,
Quero que uma aprovação signifique que a pergunta que eu fiz foi respondida afirmativamente,
Para que eu não libere acesso com base numa credencial que responde outra coisa.

**Acceptance Criteria:**

**Given** uma `POST /api/presentations/verify` cuja sessão pertence a uma `proof_request`
**When** o `verify_presentation_usecase` executa
**Then** a `proof_request` associada é carregada e seu `proof_type` é lido
**And** o `proof_type` é mapeado para a chave de claim correspondente
**And** a Regra 5 passa a exigir: a claim mapeada **existe na VC** e seu valor é **exatamente `true`**

**Given** uma `proof_request` de `age_over_18` e uma VC com `ageOver18: false`
**When** a verificação executa
**Then** retorna `{ valid: false }` e a `proof_request` transiciona para `rejected`

**Given** uma `proof_request` de `age_over_18` e uma VC sem a chave `ageOver18`
**When** a verificação executa
**Then** retorna `{ valid: false }` — ausência da claim nunca é tratada como aprovação

**Given** uma `proof_request` de `personhood` e uma VC com `personhood: true, ageOver18: false`
**When** a verificação executa
**Then** retorna `{ valid: true }` — a claim não solicitada é irrelevante para o resultado

**Given** a validação original de que todas as claims são booleanas
**When** esta story é aplicada
**Then** ela é **preservada** — a correspondência é uma exigência adicional, não substituta

**Given** as demais regras da Story 5.5 (1–4 e 6–11)
**When** esta story é aplicada
**Then** todas permanecem em vigor e na mesma ordem

**Given** o disparo de webhook após a transição de status
**When** o webhook é montado
**Then** o campo `proofType` carrega o `proof_type` real da `proof_request`, substituindo o valor
hardcoded `"verification"`

> ⚠️ **Restrição de entrega — 5.7 e 5.8 são indivisíveis.** Entregar a 5.7 sem a 5.8 **introduz**
> uma falha de correção inexistente hoje: com as claims consolidadas, toda VC passa a carregar
> `ageOver18`, inclusive `false`. Como a Regra 5 original só verifica que o valor é booleano,
> a credencial de um menor de idade **aprovaria** uma `proof_request` de `age_over_18`.
> Hoje isso não ocorre apenas porque a claim não existe na credencial.

---

### Story 5.9: OCR Estruturado via Mistral Document AI

> Origem: Sprint Change Proposal 2026-08-19. Substitui a implementação do provider de OCR
> introduzida pela Story 5.4 — os critérios de negócio da 5.4, 5.7 e 5.8 permanecem inalterados.

Como holder com app mobile,
Quero que os dados do meu documento sejam lidos de forma estruturada e confiável,
Para que minha credencial não seja negada por uma variação de layout nem emitida com uma idade errada.

**Contexto:** a extração de nome, CPF e data de nascimento é feita hoje por **regex sobre o texto
livre** devolvido pela API de OCR (`ApiOcrProvider.parseDocumentText`). Além de frágil a cada layout
novo de RG/CNH, o fallback de data aceita **qualquer** `DD/MM/YYYY` encontrado no documento quando
não localiza o rótulo — data de emissão, expedição ou validade podem ser lidas como data de
nascimento. Como esse valor alimenta diretamente o cálculo de `ageOver18` (Story 5.7), um erro de
parsing se transforma em **claim falsa dentro de uma credencial assinada**. Esta story elimina a
classe do problema: os campos passam a ser extraídos de forma estruturada na origem, e o backend
apenas **valida** o que recebe.

**Acceptance Criteria:**

**Given** `MISTRAL_API_KEY` configurada e uma imagem legível de documento brasileiro
**When** `POST /api/credentials/issue` é processada
**Then** nome, CPF e data de nascimento são lidos de `document_annotation` retornado pela Mistral
**And** a VC é emitida com HTTP 201, como nas Stories 5.4/5.7
**And** **nenhum regex de extração de campo** participa do caminho — o parsing de texto livre deixa
de existir

**Given** um documento cujo conteúdo não permite ler nome, CPF ou data de nascimento
**When** o processamento é executado
**Then** retorna HTTP 422 com `{ error: "Document processing failed" }` sem persistir nada

**Given** uma saída do provider com CPF fora de 11 dígitos, `birthDate` fora de `YYYY-MM-DD`, data
inexistente ou futura, ou qualquer campo `null`
**When** a validação estrutural do resultado é executada
**Then** o resultado é rejeitado e retorna HTTP 422
**And** a saída do modelo **nunca é aceita sem validação** — validar não é reconstruir campo a partir
de texto corrido

**Given** qualquer caminho de execução, inclusive os de falha
**When** a emissão ocorre
**Then** a imagem do documento e os campos extraídos não são gravados em banco nem em log (NFR7)
**And** o modo debug do SDK permanece desligado — o request carrega a imagem do documento

**Given** `MISTRAL_API_KEY` ausente e `STAGE` igual a `PROD` ou `HOMOLOG`
**When** a aplicação inicializa
**Then** o boot falha na validação do schema de environments
**And** **não existe fallback para mock** — ausência de configuração deixa de selecionar provider

**Given** `STAGE` igual a `DOTENV`, `DEV`, `HOMOLOG` ou `PROD`
**When** `getOcrProvider()` resolve o provider
**Then** devolve **sempre** `MistralOcrProvider`, e lança quando a chave está ausente
**And Given** `STAGE` igual a `TEST`
**Then** devolve `MockOcrProvider` sem sequer ler `MISTRAL_API_KEY`
**And** essa matriz é coberta por **guard automatizado** — a garantia depende de uma condição de
`STAGE` e por isso precisa de teste próprio

**Given** o código do projeto
**When** as importações são inspecionadas
**Then** `@mistralai/mistralai` é importado **apenas** por
`src/shared/clients/ocr/MistralOcrProvider.ts`
**And** use case, controller e presenter continuam dependendo somente da interface `OcrProvider`

**Given** a conclusão desta story
**When** o diretório `src/shared/clients/ocr/` é inspecionado
**Then** `ApiOcrProvider.ts` não existe mais e nenhum símbolo dele é importado
**And** `MockOcrProvider.ts` permanece, referenciado exclusivamente pelo ramo `STAGE=TEST`

**Given** o manifesto autoritativo de env vars (Story 11.8)
**When** a renomeação `OCR_API_URL`/`OCR_API_KEY` → `MISTRAL_API_KEY` é aplicada
**Then** `.env.local.example`, `amplify.yml`, `docs/deployment/production-cicd.md`,
`docs/e2e-happy-path-postman.md` e os testes de `story-11-8` refletem os **12 nomes canônicos**

**Given** o sync autoritativo de env vars, que remove do Amplify o que sai do manifesto
**When** o primeiro deploy pós-merge é executado
**Then** o Secret `MISTRAL_API_KEY` já está cadastrado no GitHub — sem ele o boot falha

**Given** a suíte de testes do projeto
**When** `npm run test` é executado
**Then** passa integralmente

> ℹ️ **Notas de escopo.** Origem: Sprint Change Proposal 2026-08-19
> (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-19.md`).
> O **contrato público de `POST /api/credentials/issue` não muda** — mesmos campos de entrada e
> mesmos códigos de resposta (201/401/422/502); o app mobile **não precisa de alteração alguma**.
> O refino de erro **422 vs 502** para o caso de indisponibilidade do provider (hoje qualquer falha
> do OCR vira 422, inclusive timeout ou chave inválida, informando ao holder que o documento dele é
> ruim quando o problema é nosso) foi **deliberadamente deferido** para story própria: alterar isso
> mexe num AC da Story 5.4 e acrescenta um código de erro ao contrato público, exigindo alinhamento
> com o app mobile.

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

**Given** a implementação de `DeliverWebhookUseCase` concluída nesta story
**When** `DeliverWebhookUseCase` é integrado aos use cases das Stories 5.5 e 5.6 que já transitam os status de `proof_request` para `approved` e `rejected`
**Then** `DeliverWebhookUseCase` é chamado de forma assíncrona ao final de cada transição (não bloqueia a resposta ao caller)
**And** o use case verifica se o app da proof_request possui `webhook_url` configurado — se não tiver, não faz nada
**And** se `webhook_url` existe, envia `POST {webhook_url}` com:
  - Body JSON: `{ proofRequestId, status, proofType, externalReference?, updatedAt }`
  - Header `X-YaID-Signature: <assinatura-base64>`
  - Header `X-YaID-Timestamp: <unix-timestamp>`
  - O body nunca contém: VC, VP, DID do holder, nonce ou qualquer PII

**Given** a transição de `proof_request` para `expired` (sessão expirada — verificada no endpoint da Story 4.1)
**When** o status é atualizado para `expired`
**Then** `DeliverWebhookUseCase` também é integrado a este ponto de transição nesta story

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

**Given** `WEBHOOK_SIGNING_PRIVATE_KEY` ausente
**When** `STAGE` é `PROD` ou `HOMOLOG`
**Then** o servidor falha ao iniciar com erro explícito — nunca sobe com chave ausente
**And** em `DOTENV`/`DEV`, o getter de webhook falha explicitamente quando o endpoint dependente for usado sem a env configurada

---

<!-- ════════════════════════════════════════════════════════════════════════ -->
<!-- Sprint Change 2026-07-27 — Epics 7, 8, 9 (novos). Epics 1–6 intocados.    -->
<!-- ════════════════════════════════════════════════════════════════════════ -->

## Epic 7: Ambientes por App, Governança de Criação e Review em Homologação

A empresa cria apps escolhendo o ambiente (homologação/produção) e sujeita à allowlist de criação; apps de homologação permitem aprovar/reprovar verificações manualmente disparando o webhook real; o campo "Atualizada em" reflete cada transição. Estabelece a fundação de versionamento de schema (Supabase Migrations) que serve a todas as mudanças de banco.

### Story 7.1: Fundação de Versionamento de Schema (Supabase Migrations + Baseline)

Como desenvolvedor,
Quero versionar o schema via Supabase Migrations com um baseline fiel ao banco hoje deployado,
Para que toda mudança estrutural futura tenha um ponto único de verdade e o drift entre código e banco seja encerrado.

**Acceptance Criteria:**

**Given** o projeto sem o diretório `supabase/` versionado
**When** a infraestrutura de migrations é inicializada (`supabase init` + `supabase link --project-ref lygkwhcwsrxfozswhxyo`)
**Then** `supabase/config.toml` (com `project_id` definido), `supabase/migrations/` e `supabase/seed.sql` estão versionados no repositório
**And** o `.gitignore` cobre `supabase/.branches` e `supabase/.temp`

**Given** o banco hoje deployado no project-ref remoto
**When** o baseline é gerado (`supabase db pull`)
**Then** a migration inicial captura **fielmente** o schema atual — incluindo o drift real (`proof_requests` com `validated_at`/`external_ref`/`result` e **sem** `updated_at`; `company_apps` com `environment`; `company` **sem** `can_create_apps`)
**And** nenhuma coluna nova é adicionada nesta story — as forward migrations de colunas entram nas stories que as consomem (7.2, 7.3, 7.4)

**Given** o baseline aplicado em ambiente local
**When** `supabase db reset` é executado
**Then** o schema local é recriado idêntico ao remoto, sem erros

**Given** um Pull Request com mudança de schema (CI opcional configurada)
**When** `supabase db diff --check` roda no PR
**Then** divergências entre as migrations versionadas e o schema são detectadas antes do merge

> ⚠️ **Cuidado operacional:** o baseline precisa refletir fielmente o banco de produção **antes** de qualquer `db push`. Validar o diff manualmente antes do primeiro push remoto.

---

### Story 7.2: Coluna `updated_at` e Gravação em Toda Transição

> 📋 **Referência:** corrige a causa-raiz do item #5 do Sprint Change — "Atualizada em" sempre `null` porque `updated_at` não existia e o viewmodel aliasava de `validated_at`.

Como empresa parceira,
Quero que o campo "Atualizada em" reflita a última transição de status da proof_request,
Para que eu saiba quando a validação mudou de estado.

**Acceptance Criteria:**

**Given** a fundação de migrations (Story 7.1) aplicada
**When** a forward migration `add_updated_at_to_proof_requests` é criada e aplicada
**Then** a coluna `proof_requests.updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` é adicionada
**And** o backfill preenche `updated_at = created_at` para as linhas existentes

**Given** a entidade `ProofRequest` e o `ProofRequestMapper`
**When** revisados após esta story
**Then** ambos incluem `updatedAt` (entity) / `updated_at` (persistência), mapeados corretamente

**Given** o `SupabaseProofRequestRepository.updateStatus()`
**When** qualquer transição de status ocorre
**Then** o método grava `status` **e** `updated_at = now()` na mesma operação — nunca só o status

**Given** o `get_proof_request_viewmodel`
**When** monta a resposta de detalhe
**Then** mapeia `updatedAt` da coluna real `updated_at` (não mais alias de `validated_at`)
**And** a tela de detalhe exibe o valor real em "Atualizada em" após cada transição

---

### Story 7.3: Allowlist de Criação de Apps (`can_create_apps`)

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR6 (CTA "Criar app" bloqueado com banner explicativo, comportamento tipo assinatura sem Stripe).

Como operador da YaID,
Quero controlar quais empresas podem criar apps,
Para que a criação seja liberada como uma assinatura, sem cobrança automática, sem que empresas não autorizadas criem apps livremente.

**Acceptance Criteria:**

**Given** a fundação de migrations (Story 7.1) aplicada
**When** a forward migration `add_can_create_apps_to_company` é criada e aplicada
**Then** a coluna `company.can_create_apps BOOLEAN NOT NULL DEFAULT false` é adicionada
**And** o backfill concede `can_create_apps = true` a **todas** as empresas existentes (evita bloqueio retroativo)

**Given** a entidade `Company` e o `CompanyMapper`
**When** revisados
**Then** incluem `canCreateApps`, propagado do banco à resposta de `GET /api/companies/me`

**Given** uma empresa com `can_create_apps = false`
**When** chama `POST /api/company-apps`
**Then** o `CreateCompanyAppUseCase` rejeita com `AppError("Company not allowed to create apps", 403)` — o guard é a fonte da verdade
**And** uma empresa com `can_create_apps = true` cria o app normalmente

**Given** a página `/(dashboard)/apps` para uma empresa com `canCreateApps = false`
**When** a página carrega
**Then** o CTA "Criar app" fica desabilitado e um banner explicativo é exibido (tipo assinatura, sem Stripe)
**And** `/apps/new` é bloqueada (redirect ou estado desabilitado) para essa empresa

---

### Story 7.4: Seletor de Ambiente na Criação de App + EnvBadge

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR3 e seção "#3 — Ambiente por App" (Select no card Identificação com texto auxiliar; `EnvBadge` âmbar Homologação / azul Produção sempre com texto).

Como empresa parceira,
Quero escolher o ambiente (homologação/produção) ao criar um app,
Para que apps de teste fiquem claramente separados dos de produção e o comportamento de review seja inequívoco.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/apps/new`
**When** o formulário é renderizado
**Then** o card *Identificação* contém um `Select` de ambiente com opções "Homologação" e "Produção", validado por Zod `z.enum(["homol","prod"])`, default seguro **`homol`**
**And** há texto auxiliar abaixo do label: "Apps de homologação permitem aprovar/reprovar verificações manualmente para teste. Produção não."

**Given** o formulário submetido
**When** `POST /api/company-apps` é chamado
**Then** o campo `environment` é enviado e persistido (a coluna `company_apps.environment` já existe; o default do schema de criação passa de `dev` para escolha explícita com fallback `homol`)

**Given** as telas `/(dashboard)/apps` (tabela) e `/(dashboard)/apps/[appId]` (detalhe)
**When** um app é exibido
**Then** um `EnvBadge` (âmbar para Homologação, azul para Produção, sempre acompanhado de texto) aparece ao lado do `StatusBadge`
**And** o ambiente não é editável após a criação no MVP

---

### Story 7.5: Review Manual (Aprovar/Reprovar) em Apps de Homologação

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR4 e seção "#4 — Review manual" (botões Aprovar primary/green e Reprovar destructive na área de ações do header, visíveis só em `homol` + status não-terminal, `AlertDialog` de confirmação, `toast.success`).

Como empresa parceira com um app de homologação,
Quero aprovar ou reprovar manualmente uma proof_request pelo dashboard,
Para que eu exercite o ciclo completo até o webhook real sem depender do app mobile durante os testes.

**Acceptance Criteria:**

**Given** um `POST /api/proof-requests/{requestId}/review` autenticado por sessão, com body `{ decision: "approve" | "reject" }`, para uma proof_request de um app `homol` em status não-terminal
**When** o `ReviewProofRequestUseCase` executa
**Then** `approve` transiciona a proof_request para `approved` e `reject` para `rejected`
**And** `updated_at = now()` é gravado (via `updateStatus()` da Story 7.2)
**And** `DeliverWebhookUseCase` (Story 6.1) é disparado — o mesmo caminho de um fluxo real

**Given** uma proof_request cujo app tem `environment = "prod"`
**When** o endpoint de review é chamado
**Then** o guard server-side rejeita com `AppError` (403/422) — defesa em profundidade, independente da UI

**Given** uma proof_request em status terminal (`approved`, `rejected`, `expired`)
**When** o review é chamado
**Then** o guard rejeita com `AppError(422)` — não há re-transição de estado terminal

**Given** um `requestId` que não pertence à company autenticada
**When** o endpoint é chamado
**Then** retorna 404 (isolamento por company, sem enumeration)

**Given** a página `/(dashboard)/proof-requests/[requestId]` para um app `homol` e status não-terminal (`pending_user`/`opened`)
**When** o header do detalhe é renderizado
**Then** os botões **Aprovar** (primary/green) e **Reprovar** (destructive) aparecem na área de ações
**And** cada um exige `AlertDialog` de confirmação ("Esta ação envia o webhook real para o app e não pode ser desfeita.")
**And** ao concluir, exibe `toast.success` ("Verificação aprovada"/"Verificação reprovada"), atualiza o status na tela e o campo "Atualizada em"

**Given** um app `prod` ou uma proof_request em status terminal
**When** a página de detalhe é renderizada
**Then** os botões de review não aparecem na UI

---

### Story 7.6: Remoção da Seção "Resposta da API" no Detalhe

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR5 e seção "#6" (remover saída bruta da rota GET; manter resumo, atributos confirmados, timeline e `PrivacyCard`; preservar a grade 2 colunas).

Como empresa parceira,
Quero uma tela de detalhe sem payload técnico cru,
Para que eu foque no resultado e no significado da validação, sem ruído de SSI.

**Acceptance Criteria:**

**Given** a página `/(dashboard)/proof-requests/[requestId]`
**When** revisada após esta story
**Then** a seção "Resposta da API" (o `CodeBlock` com o `payload` bruto da rota GET) é removida
**And** permanecem o card de resumo, o card de atributos confirmados, a timeline e o `PrivacyCard`
**And** a grade de 2 colunas do detalhe (resumo + atributos confirmados || timeline + privacy card) é preservada

**Given** os imports do arquivo de detalhe
**When** a seção é removida
**Then** imports órfãos (ex: `CodeBlock`, `payload`) que não são mais usados na página são removidos

**Given** qualquer status da proof_request
**When** a tela de detalhe é exibida
**Then** nenhuma saída bruta de JSON da rota é exibida ao usuário-empresa

---

## Epic 8: Marca Oficial e Topbar Integrada

O dashboard reflete a identidade visual oficial da YaID (ícone real em todas as superfícies) e o usuário logado (nome real da company + avatar dinâmico), removendo placeholders de demonstração e o badge global de ambiente.

### Story 8.1: Ícone Oficial YaID nas 4 Superfícies de Marca

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR1 e seção "#1 — Marca oficial YaID" (troca puramente de asset, preservando layout/hierarquia/paleta).

Como usuário (empresa ou holder),
Quero ver o ícone oficial da YaID em todas as superfícies de marca,
Para que eu reconheça a marca legítima em vez de um placeholder de validação.

**Acceptance Criteria:**

**Given** as 4 superfícies de marca (sidebar do dashboard, tela coringa, `/sign-in`, `/sign-up`)
**When** revisadas após esta story
**Then** o placeholder `ShieldHalf` (Lucide) + texto "YaID" hardcoded é substituído pelo ícone oficial `public/yaid_icon.svg`
**And** as dimensões e posições originais são preservadas (sidebar 28px, tela coringa 48px)
**And** o layout, a hierarquia e a paleta não mudam — a troca é puramente de asset

**Given** os componentes `app-sidebar.tsx`, `verification-layout.tsx`, `app/sign-in/page.tsx` e `app/sign-up/page.tsx`
**When** o novo asset é aplicado
**Then** imports órfãos do ícone antigo (`ShieldHalf`, e `yaid_icon.png` se existir) são removidos

---

### Story 8.2: Topbar Dinâmica Integrada à Company Logada

> 📋 **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR2 e seção "#2 — Topbar dinâmica" (nome real via `GET /api/companies/me`, avatar com inicial dinâmica + `aria-label`, `Skeleton` no load, sem badge global de ambiente).

Como empresa parceira logada,
Quero ver meu nome real e avatar na topbar,
Para que o dashboard reflita quem está logado em vez de um placeholder de demonstração.

**Acceptance Criteria:**

**Given** a topbar (`app-topbar.tsx`) de um usuário autenticado
**When** a topbar carrega
**Then** consome `GET /api/companies/me` e exibe o nome real da company + avatar com inicial dinâmica derivada desse nome

**Given** a chamada `GET /api/companies/me` ainda em andamento
**When** a topbar renderiza
**Then** exibe `Skeleton` no lugar do nome e do avatar — nunca um nome placeholder
**And** em erro de carregamento, mantém um avatar neutro e não bloqueia a navegação

**Given** o avatar dinâmico
**When** revisado para acessibilidade
**Then** possui `aria-label` com o nome real da company (o texto da inicial não basta para leitor de tela)

**Given** a topbar após esta story
**When** revisada
**Then** os valores hardcoded ("Acme Identidade Ltda.", "Maria R."/"MR") e o badge global "Homologação"/`EnvBadge` foram removidos — o ambiente é atributo do app, não da sessão

---

## Epic 9: Verifiable Credential como VC-JWT

O app mobile passa a receber a VC como JWT assinado (EdDSA) — formato compacto verificável na apresentação — em vez de JSON-LD com prova embutida. Isolado nos módulos `identity` + `presentation`; exige coordenação externa com a codebase do YaID Wallet.

### Story 9.1: Emissão da VC como VC-JWT (EdDSA)

Como app mobile do holder,
Quero receber a Verifiable Credential como um JWT assinado,
Para que eu a armazene em formato compacto e verificável, alinhado ao que o app espera.

**Acceptance Criteria:**

**Given** o `issue_credential_usecase` (módulo `identity`)
**When** uma VC é emitida
**Then** ela é construída como VC-JWT compacto com header `{alg:"EdDSA", typ:"JWT", kid:"<issuerDid>#key-1"}` e payload `{iss:<issuerDid>, sub:<holderDid>, jti, iat, nbf, vc:{...claims booleanos}}`
**And** é assinada (JWS compacto) com `ISSUER_PRIVATE_KEY` (EdDSA)
**And** os claims permanecem **apenas booleanos** — nenhuma PII entra no payload
**And** o bloco `vc` carrega **ambas** as claims consolidadas pela Story 5.7:
`{ personhood: true, ageOver18: <boolean> }` — nunca uma claim isolada

**Given** o `issue_credential_viewmodel` e a rota `POST /api/credentials/issue`
**When** a resposta é montada
**Then** retorna a **string JWT** — não mais JSON-LD com `proof.Ed25519Signature2020` embutido

**Given** o JWT emitido
**When** verificado com a public key do issuer
**Then** a assinatura é válida e o header/payload seguem o formato acima

**Given** o fluxo existente de emissão (Stories 5.4 e 5.7)
**When** esta story é aplicada
**Then** o OCR em memória, o descarte de PII e o registro on-chain (`registerDID`) permanecem inalterados — muda apenas o formato de serialização/assinatura da VC
**And** a semântica de claims da Story 5.7 é preservada: ambas as claims presentes, menor de 18
recebe `ageOver18: false` com sucesso, e o body não aceita `proofType`

> ⚠️ **TBD para o agente implementador:** questionar qual biblioteca de JWS/EdDSA usar antes de implementar. **Coordenação externa** com a codebase do YaID Wallet é obrigatória — o formato do JWT é um contrato entre backend e mobile.

---

### Story 9.2: Verificação da VC-JWT em `presentations/verify`

Como sistema backend,
Quero validar a VC no formato JWT durante a verificação da apresentação,
Para que apenas apresentações com credencial íntegra e não-revogada sejam aprovadas.

**Acceptance Criteria:**

**Given** uma `POST /api/presentations/verify` cuja VP carrega a VC-JWT inteira
**When** o `verify_presentation_usecase` executa
**Then** decodifica a VC-JWT e valida a assinatura do issuer (JWS EdDSA via public key off-chain), substituindo a validação anterior de JSON-LD `Ed25519Signature2020`
**And** valida header/payload no formato esperado e que os claims são booleanos (sem PII)

**Given** as 11 regras de validação da Story 5.5
**When** a verificação roda sobre a VC-JWT
**Then** todas permanecem em vigor, adaptadas ao formato JWT (DID do holder == autenticado, nonce/challenge, janela de validade, `isDIDRegistered`, `isVCRevoked`, sessão em `opened`, etc.)
**And** a Regra 5 na forma corrigida pela Story 5.8 é **preservada**: a claim correspondente ao
`proof_type` da `proof_request` precisa existir no bloco `vc` e valer **exatamente `true`** —
validar apenas que as claims são booleanas é insuficiente e aprovaria a credencial de um menor
de idade em um pedido de `age_over_18`

**Given** todas as validações passam
**When** o use case conclui
**Then** retorna `{ valid: true }` e as transições de status (`proof_session` → `approved_by_user`, `proof_request` → `approved`, `updated_at`) e o webhook seguem como na Story 5.5

**Given** qualquer validação falha (ex: assinatura do issuer inválida, VC-JWT malformada)
**When** o use case conclui
**Then** retorna `{ valid: false }` sem detalhar qual regra falhou, e a proof_request transiciona para `rejected`

---

## Epic 10: Higiene de Configuração e Chaves

`environments.ts` volta a ser a fonte única de configuração: as chaves de teste deixam de ser remendadas dentro dos use cases e o formato das chaves passa a ser validado no boot, não na primeira requisição.

> Origem: Sprint Change Proposal 2026-07-28, §7 (adendo). Sem relação de dependência com as
> Stories 5.7/5.8 — podem correr em paralelo. **Ordem interna obrigatória: 10.1 antes de 10.2.**

### Story 10.1: Centralização de Chaves de Teste no `environments.ts`

Como desenvolvedor deste backend,
Quero que as chaves do stage de teste saiam prontas do `environments.ts`,
Para que nenhum use case precise conhecer ou remendar valores de configuração.

**Contexto:** `TEST_ENV` atribui strings-placeholder não-hexadecimais (`"test-issuer-private-key"`) a variáveis que o código consome como chaves hex de 32 bytes. Como o valor não serve para `hexToBytes`, **quatro consumidores remendam o valor no ponto de uso**, cada um redeclarando o par placeholder/valor real.

**Acceptance Criteria:**

**Given** o `TEST_ENV` em `src/shared/environments.ts`
**When** revisado
**Then** `ISSUER_PRIVATE_KEY` e `WEBHOOK_SIGNING_PRIVATE_KEY` carregam diretamente os valores hex de 32 bytes hoje produzidos pela substituição (`…0001` e `…0002`, respectivamente)
**And** as chaves derivadas permanecem **idênticas** às atuais — nenhuma assinatura muda

**Given** os quatro pontos de substituição de placeholder
**When** esta story é aplicada
**Then** todos são removidos:
  1. `src/modules/credential/app/issue_credential_usecase.ts` (linhas 148-151)
  2. `src/modules/presentation/app/verify_presentation_usecase.ts` (linhas 183-186)
  3. `src/shared/infra/providers/Ed25519WebhookSigner.ts` (linhas 20-30)
  4. `src/modules/webhook/app/get_webhook_public_key_usecase.ts` (linhas 4-6, 34-40)
**And** cada consumidor passa a usar o valor recebido sem inspecioná-lo ou reescrevê-lo

**Given** os testes estruturais que hoje exigem a presença do remendo
**When** esta story é aplicada
**Then** `tests/unit/story-6-1/webhook-delivery.test.mjs:85` e `tests/unit/story-6-2/webhook-public-key.test.mjs:119` são reescritos para afirmar o comportamento novo — a chave vem pronta do `environments.ts` — em vez da presença da substituição
**And** as asserções sobre o valor derivado `…0002` (`story-6-2`, linhas 43, 91, 162) permanecem inalteradas e passando

**Given** a suíte de testes completa
**When** executada após a mudança
**Then** passa integralmente — a mudança é preservadora de comportamento por construção

**Given** um novo consumidor de chave criado no futuro
**When** ele lê a chave via `environments.ts`
**Then** recebe um valor pronto para uso em qualquer stage, sem precisar conhecer placeholders

---

### Story 10.2: Validação de Formato de Chaves no Boot

Como operador deste backend,
Quero que uma chave malformada derrube o boot em vez de falhar na primeira requisição,
Para que nunca seja possível subir produção assinando com uma chave inválida ou publicamente conhecida.

**Contexto:** `envSchema` declara as chaves como `z.string().min(1).optional()` e o `superRefine` verifica apenas **presença** em `PROD`/`HOMOLOG`. Uma chave com typo, tamanho errado ou igual ao placeholder de teste passa na validação de boot. No caso do placeholder, o backend passaria a assinar VCs com uma chave privada que está neste repositório — qualquer pessoa poderia forjar credenciais aceitas pelo `verify_presentation_usecase`.

**Dependência:** requer a Story 10.1 concluída. Validar formato enquanto `TEST_ENV` ainda carrega placeholders não-hex quebraria o stage `TEST` inteiro.

**Acceptance Criteria:**

**Given** `ISSUER_PRIVATE_KEY` e `WEBHOOK_SIGNING_PRIVATE_KEY` no `envSchema`
**When** o schema é avaliado no boot
**Then** ambas exigem exatamente 64 caracteres hexadecimais (32 bytes)
**And** um valor com typo, tamanho incorreto ou caracteres não-hex **falha no boot** com mensagem acionável nomeando a variável

**Given** `BLOCKCHAIN_WALLET_PRIVATE_KEY` e `BLOCKCHAIN_CONTRACT_ADDRESS`
**When** o schema é avaliado no boot
**Then** seus formatos também são validados, seguindo o precedente já existente em `EthersBlockchainClient`, que valida `ethers.isAddress` no construtor *"para gerar erro acionável no boot, não em tempo de requisição"*

**Given** o stage `PROD` ou `HOMOLOG`
**When** qualquer chave recebe um dos valores de placeholder do `TEST_ENV`
**Then** o boot falha explicitamente — a chave de teste é publicamente conhecida e nunca pode assinar fora de `TEST`
**And** o mesmo vale para `DOTENV` e `DEV`, encerrando a inconsistência em que apenas `get_webhook_public_key_usecase` fazia esse guard

**Given** o stage `TEST`
**When** o boot ocorre
**Then** as chaves de teste do `TEST_ENV` são aceitas normalmente

**Given** o stage `DOTENV` ou `DEV` sem as chaves definidas
**When** o boot ocorre
**Then** o comportamento atual é preservado: a ausência é tolerada e o erro só surge se o fluxo específico usar o getter correspondente — permite rodar signup/dashboard local sem blockchain nem issuer

**Given** a suíte de testes completa
**When** executada após a mudança
**Then** passa integralmente
