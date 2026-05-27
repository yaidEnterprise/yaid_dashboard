# YaID — Contexto e Linguagem do Domínio

> Este documento é a fonte da verdade da linguagem ubíqua do projeto YaID.
> Sempre que um termo do domínio for usado no código, no PRD ou em ADRs,
> ele deve estar definido aqui. Decisões arquiteturais ficam em `docs/adr/`.

## Escopo desta codebase

Esta codebase é o **backend único compartilhado do YaID** (Next.js — Route Handlers + App Router). Ela hospeda:

- o **frontend do Dashboard Empresarial** (rotas em `app/(dashboard)`, `app/onboarding`, `app/sign-in`);
- a **tela coringa de verificação** consumida pelo browser do holder (`app/v/[sessionToken]`);
- as **APIs REST** consumidas por três tipos de cliente distintos:
  1. o próprio Dashboard (server components + client components);
  2. o **sistema do cliente empresarial** (server-to-server, autenticado por API key);
  3. o **app mobile YaID Wallet** (autenticado por DID/assinatura — a definir).

A blockchain é acessada **apenas por este backend**, nunca diretamente pelos clientes.

## Glossário

> Em construção. Os termos abaixo serão preenchidos durante a sessão de grilling.

### Atores

- **Issuer** — A própria YaID. No MVP, o backend Next.js atua como issuer único, assinando VCs com uma chave Ed25519 mantida em variável de ambiente. A public key do issuer é distribuída **off-chain** (constante na documentação/SDK) — a chain não armazena DID/chave do issuer.
- **Holder** — Pessoa física que possui o app mobile YaID Wallet. Identificada por `did:yaid:user:<holder-public-key>` — o próprio DID **embute a public key do holder** (decisão de simplificação arquitetural). A keypair é gerada localmente no primeiro uso do app. Não tem cadastro centralizado no backend YaID. Posse da chave privada correspondente à pubkey embutida no DID é o único meio de autenticação em fluxos do app mobile.
- **Verifier** — Empresa parceira (via seu `company_app`). Recebe o resultado de uma `proof_request` por webhook ou por polling em `GET /api/proof-requests/{id}`. **Nunca recebe a VP nem a VC** — vê apenas `valid: true | false` e metadados (request_id, proof_type, status, external_reference, validated_at).
- **Company / Empresa parceira** — Entidade que contrata o YaID para validar identidade dos seus usuários finais. **No MVP, usuário = empresa**: cada `auth.users` do Supabase corresponde a exatamente uma Company, e o vínculo é feito reusando o mesmo UUID (`company.id === auth.users.id`). Cadastro é **um único formulário atômico** — email, senha, nome da empresa e CNPJ obrigatório são submetidos juntos, e as linhas em `auth.users` e `public.company` são criadas na mesma operação. Se uma falha, a outra é desfeita. **Não existe estado "usuário autenticado sem company"** — toda sessão pressupõe company existente, e isso é um invariante do sistema (não há tela ou guard de "completar onboarding"). A introdução de `company_members` para múltiplos usuários por company é decisão pós-MVP.

### Conceitos centrais

- **DID (Decentralized Identifier)** — Identificador do holder no formato `did:yaid:user:<holder-public-key>`. A pubkey está embutida no próprio DID (decisão de simplificação): qualquer ator que conhece o DID conhece automaticamente a public key e pode verificar assinaturas do holder, sem precisar consultar registry de pubkey separado. Gerado no app mobile a partir de uma keypair local criada no primeiro uso do app. O **DID do holder é registrado on-chain no momento da emissão da VC pela YaID**, tornando o contrato um registry público de "DIDs (e portanto pubkeys) com personhood validada pela YaID". O **DID do issuer YaID e sua chave pública NÃO ficam na chain** — são distribuídos off-chain (configuração do backend e dos verifiers). Revogação acontece registrando o `hash(vc_id)` em uma lista de revogadas no contrato.
- **VC (Verifiable Credential)** — Credencial assinada pelo YaID (issuer) e armazenada no app mobile do holder. No MVP a VC carrega apenas claims booleanos derivados na emissão: `personhood: true` e `ageOver18: true`. **Nenhum dado pessoal bruto (nome, CPF, data de nascimento, foto) entra na VC.** Esses dados são processados em memória durante o OCR e descartados após a emissão. Formato aproximado: `{ sub: did:yaid:user:..., nbf, vc: { @context, type: ['VerifiableCredential'], id, credentialSubject: { personhood, ageOver18 } } }`.
- **VP (Verifiable Presentation)** — Apresentação derivada da VC e assinada pelo holder, gerada em resposta a um challenge/nonce emitido pelo backend YaID para uma `proof_session`. A VP **não usa selective disclosure criptográfico (SD-JWT, BBS+) nem ZKP no MVP** — ela carrega a VC inteira. Como a VC já contém apenas claims booleanos, isso não vaza PII.
- **Personhood** — Claim que afirma que o holder é uma pessoa real, validada pela YaID a partir de um documento de identidade (RG no MVP) processado por OCR no momento da emissão da VC. Ortogonal a "qual pessoa".
- **Proof Request** — Solicitação criada por um `company_app` pedindo que um holder prove um claim específico. No MVP, `proof_type` é enum com um único valor por request: `personhood` **ou** `age_over_18`. Carrega `external_reference` opcional para a empresa correlacionar com seu próprio usuário interno. Ciclo de vida: `pending_user` → `processing` → `approved` | `rejected` | `expired`.
- **Proof Session** — Estado da interação do holder com uma `proof_request` específica. Criada 1:1 junto da proof_request. Guarda `session_token_hash` (a tela coringa é acessada via URL com o token bruto, que **só existe no momento da criação** e é devolvido ao cliente empresarial), `challenge_nonce_hash` + `challenge_created_at` (validados contra a VP), `expires_at` (TTL hardcoded de 30 minutos). Ciclo de vida: `waiting_user` → `opened` → `approved_by_user` | `expired` | `cancelled`. A `proof_session` mantém `id` próprio (não usa `proof_request_id` como PK). URLs de verificação (`verification_page_url`, `deep_link_url`) **não são persistidas** — são derivadas do token no momento da resposta.
- **Verification URL / Tela Coringa** — Página em [app/v/[sessionToken]](app/v/[sessionToken]) exibida no browser do holder após a empresa redirecioná-lo. Resolve a sessão por hash do token, exibe contexto (qual empresa solicitou, qual claim) e oferece deep link `yaid://verify?session=<token>` ou QR code para abrir o app mobile.

## Princípio de privacidade do holder

> **Nenhum dado do holder pode persistir em tabela centralizada do YaID.**

Implicações:
- A tabela `identity_submissions` sugerida pelo PRD antigo **não deve existir**. A emissão de VC é síncrona: app envia documento → backend faz OCR em memória → emite VC → registra DID on-chain → retorna VC ao app → esquece tudo. Sem polling, sem persistência relacional.
- Imagens do documento, OCR bruto, nome, CPF, data de nascimento: somente em memória durante a request de emissão. Descartados imediatamente após.
- O **único lugar** onde algo relativo a uma VC do holder existe centralizado é a blockchain, e somente em dois momentos: (a) o DID do holder é registrado on-chain quando a YaID emite a VC; (b) o `hash(vc_id)` é registrado na revoke list quando a VC é revogada.
- As 4 tabelas centralizadas (`company`, `company_apps`, `proof_requests`, `proof_sessions`) são todas sobre o lado empresarial e o processo de pedido de validação — nunca sobre o holder.

## Decisões já registradas

Ver `docs/adr/` para o histórico de decisões arquiteturais.
