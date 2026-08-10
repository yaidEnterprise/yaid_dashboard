# Plano de Rodadas — yaid_dashboard

> **Atenção:** Este artefato é exclusivamente para organização da equipe.
> Ele **não deve ser referenciado durante a implementação de stories**.
> Preenchimento e designação de responsáveis ocorrem externamente ao Claude.

**Gerado em:** 2026-07-28 (revisão)
**Baseado no sprint-status de:** 2026-07-28
**Revisão anterior:** 2026-07-27 (baseada no sprint-status de 2026-07-22)

---

> ✅ **Sincronização resolvida.** O aviso da revisão anterior não se aplica mais: o
> `sprint-status.yaml` agora está em 2026-07-28 e rastreia todas as stories dos Épicos 7–10.
> Não é necessário rodar `bmad-sprint-planning`.

> 🔒 **Rodada 1 preservada.** Já foi entregue aos devs e **não foi alterada** nesta revisão —
> mesma composição, mesma ordem. A story 7.1 consta como concluída; as demais seguem em execução.
> Todas as mudanças desta revisão estão nas Rodadas 3 e 4.

---

## Resumo

| Rodada | Stories | Máx. Agentes | Situação |
|--------|---------|-------------|----------|
| 1 | 5 | 5 | 🔒 Em execução — 7.1 concluída, 4 em andamento |
| 2 | 4 | 4 | Inalterada |
| 3 | 2 | 2 | ✏️ Revisada — recebe 10.1 |
| 4 | 3 | 3 | ➕ Nova — 5.7, 5.8, 10.2 |
| **Total** | **13 stories** | **4 rodadas** |

**O que mudou nesta revisão:** +4 stories (5.7, 5.8, 10.1, 10.2) e +1 rodada. A Rodada 3, que antes
tinha só a 7.5, ganha a 10.1. A Rodada 4 é inteiramente nova.

## Caminho Crítico

**9.1 → 9.2 → 10.1 → 10.2** (4 rodadas) — determina o número mínimo de rodadas.

O caminho crítico **mudou**. Na revisão anterior era `7.1 → 7.4 → 7.5` (3 rodadas); com a 7.1 já
concluída, essa cadeia encurtou e deixou de ser a mais longa. O novo gargalo é a cadeia do Epic 9
seguida da higiene de configuração: a 10.1 limpa remendos que vivem exatamente nos arquivos que
9.1 e 9.2 reescrevem, e a 10.2 depende da 10.1.

Cadeia secundária (cabe dentro das 4 rodadas): **9.1 → 9.2 → {5.7 + 5.8}**.

---

## Onde as novas stories entram — e por quê

As quatro stories novas **não puderam ser distribuídas livremente**: três delas competem pelos
mesmos dois arquivos que o Epic 9 está reescrevendo agora, na Rodada 1.

| Arquivo | Quem reescreve | Quem também mexe |
|---|---|---|
| `issue_credential_usecase.ts` | **9.1** (Rodada 1) | 5.7, 10.1 |
| `verify_presentation_usecase.ts` | **9.2** (Rodada 2) | 5.8, 10.1 |

Isso não é mera proximidade de arquivo — é dependência técnica dura. A 5.7 constrói as claims
consolidadas, e **a forma de construí-las depende de a VC ser JSON-LD ou JWT**. Implementá-la em
paralelo com a 9.1 produziria trabalho sobre um formato que deixa de existir. O mesmo vale para a
5.8 em relação à 9.2, e para a 10.1, cujos remendos de chave ficam dentro do bloco de assinatura
que a 9.1 reescreve.

Decisões decorrentes:

- **5.7 e 5.8 → Rodada 4.** A 5.7 estaria liberada já na Rodada 2 (depende só da 9.1), mas a 5.8
  depende da 9.2, que só sai na Rodada 2. Como as duas **não podem ser liberadas separadamente**
  (ver aviso abaixo), ambas descem para depois da 10.1.
- **10.1 → Rodada 3.** Primeira rodada em que 9.1 e 9.2 já estão fechadas. Colocada **antes** de
  5.7/5.8 de propósito: é um refactor mecânico e pequeno, e adiantá-la evita que dois agentes
  editem `issue_credential_usecase.ts` e `verify_presentation_usecase.ts` na mesma rodada.
- **10.2 → Rodada 4.** Depende da 10.1. Mexe apenas no `envSchema`, sem tocar em nenhum arquivo das
  5.7/5.8 — por isso pode rodar em paralelo com elas.

> ⚠️ **5.7 e 5.8 são uma entrega indivisível.** Liberar a 5.7 sem a 5.8 **introduz** uma falha de
> correção que hoje não existe: com as claims consolidadas, toda credencial passa a carregar
> `ageOver18` (inclusive `false`), e a validação atual só verifica que o valor é booleano — a
> credencial de um menor de idade aprovaria um pedido de `age_over_18`. Devem ser designadas ao
> mesmo responsável ou fechadas no mesmo merge.

---

## Detalhe por Rodada

### Rodada 1 — 5 stories em paralelo 🔒 *(entregue aos devs — não alterada)*

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 7.1 | Fundação de Migrations (Supabase) | (fundação do Épico 7) | ✅ **Concluída.** Baseline capturado. |
| 7.6 | Remoção da Seção "Resposta da API" no Detalhe | (Épicos 1–6 concluídos) | Frontend puro, sem dependência de schema. Limpar imports órfãos (`CodeBlock`, `payload`). |
| 8.1 | Ícone Oficial YaID nas 4 Superfícies de Marca | (Épicos 1–6 concluídos) | Troca de asset (`public/yaid_icon.svg`), sem dependência de backend. |
| 8.2 | Topbar Dinâmica Integrada à Company Logada | (`GET /api/companies/me` — Épico 1) | Endpoint `companies/me` já existe (Story 1.7 done). |
| 9.1 | Emissão da VC como VC-JWT (EdDSA) | (Story 5.4 concluída) | ⚠️ TBD: biblioteca de JWS/EdDSA a definir + **coordenação externa** com a codebase do YaID Wallet (contrato do formato JWT) antes de implementar. **Bloqueia 5.7 e 10.1.** |

### Rodada 2 — 4 stories em paralelo *(inalterada)*

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 7.2 | Coluna `updated_at` e Gravação em Toda Transição | 7.1 | Forward migration `add_updated_at_to_proof_requests` + backfill; `updateStatus()` grava `updated_at = now()`. |
| 7.3 | Allowlist de Criação de Apps (`can_create_apps`) | 7.1 | Forward migration `add_can_create_apps_to_company` com backfill `true` para empresas existentes. |
| 7.4 | Seletor de Ambiente na Criação de App + EnvBadge | 7.1 | Coluna `environment` já existe; migration só ajusta default/enum. |
| 9.2 | Verificação da VC-JWT em `presentations/verify` | 9.1 | Substitui validação JSON-LD `Ed25519Signature2020` pela decodificação/validação da VC-JWT. **Bloqueia 5.8 e 10.1.** |

### Rodada 3 — 2 stories em paralelo ✏️ *(revisada)*

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 7.5 | Review Manual (Aprovar/Reprovar) em Apps de Homologação | 7.2, 7.4 | Usa `updateStatus()` com `updated_at` (7.2), o `environment` homol/prod (7.4) e `DeliverWebhookUseCase` (6.1, done). |
| 10.1 | Centralização de Chaves de Teste no `environments.ts` | 9.1, 9.2 | ➕ **Nova.** Refactor mecânico e preservador de comportamento — as chaves derivadas não mudam. Remove 4 substituições locais de placeholder. ⚠️ **Inclui reescrever 2 asserções estruturais** que hoje exigem a presença do remendo (`story-6-1/webhook-delivery.test.mjs:85` e `story-6-2/webhook-public-key.test.mjs:119`) — a suíte quebra sem isso. **Bloqueia 10.2.** |

### Rodada 4 — 3 stories em paralelo ➕ *(nova)*

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 5.7 | Consolidação de Claims na Emissão | 9.1 (formato JWT), 10.1 (mesmo arquivo) | ➕ **Nova.** 🔗 **Entrega acoplada à 5.8 — não liberar isoladamente.** Remove o `proofType` do body; menor de 18 passa a emitir com `ageOver18: false` em vez de 422. |
| 5.8 | Correspondência entre Claim e Proof Type | 9.2 (formato JWT), 10.1 (mesmo arquivo) | ➕ **Nova.** 🔗 **Entrega acoplada à 5.7.** Regra 5 passa a exigir que a claim pedida exista e valha `true`. Também corrige o `proofType` hardcoded no disparo de webhook. |
| 10.2 | Validação de Formato de Chaves no Boot | 10.1 | ➕ **Nova.** Mexe apenas no `envSchema` — sem colisão com 5.7/5.8, pode correr em paralelo. Fecha a exposição em que uma chave privada publicamente conhecida passa na validação de boot em produção. |

---

## Alternativa se o Epic 9 atrasar

A 9.1 carrega dois TBDs (biblioteca de JWS/EdDSA e coordenação externa com a codebase do YaID
Wallet). Se ela travar, o caminho crítico inteiro trava junto — 5.7, 5.8, 10.1 e 10.2 ficam todas
esperando.

Saída possível: implementar **5.7 + 5.8 sobre o formato JSON-LD atual**, antecipando-as para a
Rodada 2. Isso entrega a correção de claims sem esperar o Epic 9, ao custo de retrabalho — as
9.1/9.2 teriam de reaplicar a semântica de claims ao migrar para JWT (os ACs delas já preveem essa
preservação). É uma troca de "correção mais cedo" por "trabalho feito duas vezes"; vale se o
bloqueio do Epic 9 passar de uma rodada.

A 10.1 **não** admite essa antecipação com o mesmo custo: ela limparia remendos que a 9.1 recriaria.

---

## Grid de Designação

> Preencha esta seção externamente para designar stories a agentes ou desenvolvedores.

| Rodada | Story | Título | Responsável | Data Início | Observações |
|--------|-------|--------|-------------|-------------|-------------|
| 1 | 7.1 | Fundação de Migrations (Supabase) | | | ✅ Concluída |
| 1 | 7.6 | Remoção da Seção "Resposta da API" no Detalhe | | | |
| 1 | 8.1 | Ícone Oficial YaID nas 4 Superfícies de Marca | | | |
| 1 | 8.2 | Topbar Dinâmica Integrada à Company Logada | | | |
| 1 | 9.1 | Emissão da VC como VC-JWT (EdDSA) | | | ⚠️ TBD lib JWS/EdDSA + coordenação YaID Wallet |
| 2 | 7.2 | Coluna `updated_at` e Gravação em Toda Transição | | | |
| 2 | 7.3 | Allowlist de Criação de Apps (`can_create_apps`) | | | |
| 2 | 7.4 | Seletor de Ambiente na Criação de App + EnvBadge | | | |
| 2 | 9.2 | Verificação da VC-JWT em `presentations/verify` | | | |
| 3 | 7.5 | Review Manual (Aprovar/Reprovar) em Apps de Homologação | | | |
| 3 | 10.1 | Centralização de Chaves de Teste no `environments.ts` | | | ⚠️ Reescrever 2 asserções estruturais de teste |
| 4 | 5.7 | Consolidação de Claims na Emissão | | | 🔗 Mesmo responsável da 5.8 |
| 4 | 5.8 | Correspondência entre Claim e Proof Type | | | 🔗 Mesmo responsável da 5.7 |
| 4 | 10.2 | Validação de Formato de Chaves no Boot | | | |
