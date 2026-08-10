# Sprint Change Proposal — Ajustes pós-validação do sistema

> **Projeto:** yaid_dashboard
> **Autor:** Victordegasperi
> **Data:** 2026-07-27
> **Workflow:** Correct Course (BMad)
> **Classificação de escopo:** **Major** — além de código, reverte uma decisão documentada do MVP ("ambientes fora de escopo"), altera schema do banco em 3 pontos, muda o contrato da Verifiable Credential e introduz versionamento de schema.

---

## Seção 1 — Issue Summary

Após validar o sistema em execução, o autor identificou **9 ajustes** que reforçam alinhamento entre produto, backend e a realidade do banco de dados. Os problemas foram descobertos durante uso manual do dashboard e inspeção do fluxo de credenciais:

1. O ícone exibido é um placeholder (`ShieldHalf` do Lucide) criado só para validação da ideia, com o texto "YaID" hardcoded — não o ícone oficial (`public/yaid_icon.svg`).
2. O header do dashboard está totalmente hardcoded ("Acme Identidade Ltda.", badge "Homologação", "Maria R.") e não reflete o usuário logado.
3. Ao criar um app, não há opção de escolher o ambiente (homologação/produção), embora o backend já suporte `environment`.
4. Não há forma de o usuário-empresa testar respostas do sistema: falta um caminho para aprovar/reprovar manualmente uma proof request em apps de homologação.
5. Na tela unitária da proof request, o campo "Atualizada em" fica sempre `null`, mesmo após atualizações.
6. A mesma tela expõe a saída bruta da rota GET (seção "Resposta da API"), informação técnica desnecessária ao usuário-empresa.
7. Não existe controle de quais empresas podem criar apps — qualquer empresa cadastrada cria apps livremente.
8. A Verifiable Credential é retornada em JSON-LD com prova embutida, não no **JWT assinado** esperado pelo app mobile.
9. **Não há versionamento de schema** — o banco foi criado manualmente pelo dashboard do Supabase, gerando divergência entre código e base (fonte estrutural de bugs como o #5).

### Evidência da causa-raiz do drift (item #9)

O bloco de schema em `architecture.md` descreve `proof_requests` com `updated_at`, `external_reference`, `return_url`. O código real ([ProofRequestMapper.ts](../../src/shared/infra/dto/ProofRequestMapper.ts)) lê `validated_at`, `external_ref`, `result` e **não tem `updated_at`**. Além disso, `company_apps` já possui a coluna `environment` (não prevista no MVP). Sem migrations, essas divergências não têm um ponto único de verdade.

---

## Seção 2 — Impact Analysis

### Impacto em Épicos

| Épico | Impacto |
|-------|---------|
| Epic 2 (Apps + API Keys) | Story 2.2 ganha seleção de ambiente (#3) e gate de allowlist (#7). |
| Epic 3 (Proof Requests / Dashboard) | Story 3.3 ganha review manual em homolog (#4), correção do `updatedAt` (#5) e remoção do JSON de resposta (#6). |
| Epic 5 (Credenciais) | Stories 5.4/5.5 mudam o contrato da VC para VC-JWT (#8). |
| Transversal (todos) | Marca/logo oficial (#1), header integrado (#2), migrations de schema (#9). |

### Impacto em Stories (novas ou revisadas)

- **Revisadas:** 2.2, 3.3, 5.4, 5.5.
- **Novas capacidades:** endpoint interno de review em homolog (#4), guard de allowlist (#7), infraestrutura de migrations (#9).

### Conflitos de Artefatos (documentação a atualizar)

- **PRD** ([prd.md](prd.md)): a seção *Out of Scope* (linha ~163) marca "Distinção sandbox/produção/homologação" como fora de escopo — **contradiz** #2, #3, #4. Reverter parcialmente (ambientes por app passam a existir). Ajustar telas do dashboard (#2, #6), regras de negócio (#7) e cripto/VC (#8).
- **Épicos** ([epics.md](epics.md)): atualizar ACs de 2.2, 3.3, 5.4, 5.5.
- **Architecture** ([architecture.md](architecture.md)): schema `proof_requests` (`updated_at`), `company` (`can_create_apps`), `company_apps` (`environment`); trocar "SQL manual sem versionamento" por "migrations via Supabase CLI".
- **UX Spec** ([ux-design-specification.md](ux-design-specification.md)): marca/logo (#1), header (#2).

### Impacto Técnico

- **Banco:** 2 colunas novas (`proof_requests.updated_at`, `company.can_create_apps`) + baseline do schema atual + backfill de allowlist.
- **Backend:** novo endpoint de review; guard de allowlist; reescrita da assinatura da VC para VC-JWT; ajuste da verificação de VP.
- **Frontend:** logo oficial em 4 telas; header dinâmico; seletor de ambiente; botões de review condicionais; remoção do bloco de resposta da API; estado bloqueado de criação de app.
- **Infra:** diretório `supabase/`, CLI linkada ao project-ref `lygkwhcwsrxfozswhxyo`, CI opcional de diff.

---

## Seção 3 — Recommended Approach

**Caminho escolhido: Direct Adjustment (ajuste direto dentro do plano existente), com atualização de artefatos.**

Nenhuma mudança exige rollback de trabalho concluído. Todos os 9 itens são incrementos sobre módulos estáveis. A única reversão é **documental** (reintroduzir ambientes por app no PRD/épicos), já refletida no código.

**Ordem de implementação recomendada** (reduz retrabalho e risco):

1. **#9 (migrations)** primeiro — estabelece o baseline e o canal para as mudanças de schema seguintes.
2. **#5 e #7 (schema)** — colunas `updated_at` e `can_create_apps` via migration, já no novo fluxo.
3. **#3 (ambiente no app)** — expõe no form o que o backend já aceita.
4. **#4 (review homolog)** — depende de #3 (environment) e #5 (`updated_at` na transição).
5. **#2, #1, #6 (frontend)** — independentes, podem correr em paralelo.
6. **#8 (VC-JWT)** — isolado no módulo `credential` + `presentation`.

**Estimativa de esforço:** Média. **Risco:** Médio — concentrado em #8 (contrato cripto entre backend e mobile, exige coordenação com a codebase do app) e #9 (o baseline precisa refletir fielmente o banco de produção antes de qualquer `db push`).

---

## Seção 4 — Detailed Change Proposals

### #1 — Ícone oficial YaID
**Arquivos:** `components/layout/app-sidebar.tsx`, `components/verification/verification-layout.tsx`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`
- Remover `ShieldHalf` + texto "YaID" hardcoded nos 4 blocos de logo.
- Renderizar `public/yaid_icon.svg` como logo oficial (preservando dimensões/posição). Remover imports órfãos.

### #2 — Header integrado ao usuário logado + remover "Homologação"
**Arquivos:** `components/layout/app-topbar.tsx` (consumindo `GET /api/companies/me`)
- **OLD:** `"Acme Identidade Ltda."` · `<EnvBadge env="homol" />` · `"Maria R."`/`"MR"`.
- **NEW:** nome real da company + inicial dinâmica no avatar; **remover** `EnvBadge`/"Homologação".

### #3 — Seletor de ambiente na criação de app
**Arquivos:** `app/(dashboard)/apps/new/page.tsx`, `utils/apps-store`
- Adicionar campo `environment` (Zod `z.enum(["homol","prod"])`, seletor "Homologação/Produção") e enviar no `POST /api/company-apps`.
- Backend já aceita `environment`; ajustar default do schema de `"dev"` para escolha explícita (default seguro `"homol"`).

### #4 — Review manual (aprovar/reprovar) em apps de homologação
**Arquivos:** novo `app/api/proof-requests/[requestId]/review/route.ts` (auth sessão), novo usecase em `src/modules/proof-request/app/`, `app/(dashboard)/proof-requests/[requestId]/page.tsx`
- Botões só aparecem/aceitam quando `environment === "homol"` e status não-terminal. Em `prod`, ausentes.
- Ação transiciona `proof_request` → `approved`/`rejected`, atualiza `updated_at` e **dispara o webhook normal** (`DeliverWebhookUseCase`).
- Guard server-side rejeita review em app `prod` (defesa em profundidade).

### #5 — Corrigir `updatedAt` sempre null
**Arquivos:** migration SQL, `src/shared/domain/entities/ProofRequest.ts`, `src/shared/infra/dto/ProofRequestMapper.ts`, `src/shared/infra/repositories/SupabaseProofRequestRepository.ts`, `src/modules/proof-request/app/get_proof_request_viewmodel.ts`
- **Causa raiz:** sem coluna `updated_at`; `updateStatus()` só grava `status`; viewmodel faz alias `updatedAt = validatedAt`.
- Adicionar `updated_at TIMESTAMPTZ DEFAULT now()`; incluir em entity/mapper; `updateStatus()` seta `updated_at = now()` em toda transição; viewmodel mapeia da coluna real.

### #6 — Remover "Resposta da API" da tela unitária
**Arquivos:** `app/(dashboard)/proof-requests/[requestId]/page.tsx`
- Remover a seção "Resposta da API" + `CodeBlock`/`payload`. Manter resumo, atributos confirmados e privacy card. Limpar imports órfãos.

### #7 — Allowlist de criação de apps (flag `can_create_apps`)
**Arquivos:** migration SQL, `src/shared/domain/entities/Company.ts`, CompanyMapper, `src/modules/company-app/app/create_company_app_usecase.ts` (+ repo), UI de apps
- Coluna `can_create_apps BOOLEAN NOT NULL DEFAULT false` em `company`; propagar no entity/mapper.
- Guard no `CreateCompanyAppUseCase`: se `false` → `AppError("Company not allowed to create apps", 403)`.
- Frontend: desabilitar CTA "Criar app" + banner explicativo (comportamento tipo assinatura, sem Stripe).
- Backfill: conceder permissão às empresas existentes na migration (evita bloqueio retroativo).

### #8 — Verifiable Credential em JWT assinado (VC-JWT / EdDSA)
**Arquivos:** `src/modules/credential/app/issue_credential_usecase.ts`, `issue_credential_viewmodel.ts`, módulo `presentation` (verificação)
- **OLD:** VC JSON-LD com `proof.Ed25519Signature2020` embutido.
- **NEW:** VC-JWT compacto — header `{alg:"EdDSA", typ:"JWT", kid:"<issuerDid>#key-1"}`, payload `{iss, sub:holderDid, jti, iat, nbf, vc:{...claims booleanos}}`, assinado (JWS compacto) com `ISSUER_PRIVATE_KEY`. Retornar a string JWT.
- `POST /api/presentations/verify` passa a decodificar/validar a VC no formato JWT.

### #9 — Versionamento de schema com Supabase Migrations
**Arquivos/infra:** `supabase/` (config.toml, migrations/, seed.sql), `.gitignore`, CI opcional
- `supabase init` → `supabase link --project-ref lygkwhcwsrxfozswhxyo`; definir `project_id` no `config.toml`.
- **Baseline:** `supabase db pull` gera a migration inicial capturando o schema hoje deployado (fim do drift).
- Migrations forward: `add_updated_at_to_proof_requests` (#5), `add_can_create_apps_to_company` + backfill (#7), ajuste de `environment`/default em `company_apps` se necessário (#3).
- Fluxo: `supabase db reset` (local), `supabase db push` (remoto); toda mudança de schema = arquivo timestampado versionado.
- `.gitignore`: `supabase/.branches`, `supabase/.temp`.
- CI opcional: `supabase db diff --check` no PR.

---

## Seção 5 — Implementation Handoff

**Escopo:** **Major** — replan parcial (documentação) + implementação.

**Roteamento:**

- **PM/Architect** (atualização de artefatos, antes ou em paralelo à implementação):
  - PRD: reverter parcialmente *Out of Scope* (ambientes por app); ajustar telas (#2, #6), regra de allowlist (#7), formato da VC (#8).
  - Architecture: schema (`updated_at`, `can_create_apps`, `environment`) + seção de dados ("migrations via CLI").
  - Épicos: ACs de 2.2, 3.3, 5.4, 5.5.
  - UX Spec: marca/logo (#1) e header (#2).
- **Developer** (implementação, na ordem da Seção 3): #9 → #5/#7 → #3 → #4 → #2/#1/#6 → #8.
- **Coordenação externa:** #8 exige acordo de formato VC-JWT com a codebase do app mobile YaID Wallet.

**Critérios de sucesso:**

- Ícone oficial em todas as telas; header reflete a company logada; sem badge "Homologação".
- Criação de app com ambiente selecionável; apps prod sem botões de review; homolog com aprovar/reprovar disparando webhook real.
- "Atualizada em" reflete a última transição; tela unitária sem JSON de resposta.
- Empresas sem `can_create_apps` são bloqueadas com feedback claro; existentes preservadas.
- App mobile recebe VC como JWT assinado, verificável na apresentação.
- `supabase/migrations/` versionado, baseline aplicável via `db reset`, sem drift contra o remoto.

---

_Documento gerado pelo workflow Correct Course. Cada mudança inclui arquivos, antes/depois e justificativa para handoff direto ao Developer._
