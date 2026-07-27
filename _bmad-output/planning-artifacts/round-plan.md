# Plano de Rodadas — yaid_dashboard

> **Atenção:** Este artefato é exclusivamente para organização da equipe.
> Ele **não deve ser referenciado durante a implementação de stories**.
> Preenchimento e designação de responsáveis ocorrem externamente ao Claude.

**Gerado em:** 2026-07-27
**Baseado no sprint-status de:** 2026-07-22

---

> ⚠️ **Aviso de sincronização — leia antes de usar este plano.**
> O `sprint-status.yaml` (last_updated **2026-07-22**) é **anterior** ao Sprint Change **2026-07-27**
> e ainda **não contém** as stories dos Épicos 7, 8 e 9. Todas as stories rastreadas nele
> (Épicos 1–6) estão `done`. Este plano foi construído a partir das stories definidas no
> `epics.md` (Épicos 7–9), tratando **todos os Épicos 1–6 como dependências satisfeitas**.
> **Ação recomendada:** rodar `bmad-sprint-planning` para materializar as stories 7.x/8.x/9.x
> no `sprint-status.yaml` antes de iniciar a execução — assim o pipeline de desenvolvimento
> passa a rastreá-las corretamente.

---

## Resumo

| Rodada | Stories | Máx. Agentes |
|--------|---------|-------------|
| 1 | 5 | 5 |
| 2 | 4 | 4 |
| 3 | 1 | 1 |
| **Total** | **10 stories** | **3 rodadas** |

## Caminho Crítico

**7.1 → 7.4 → 7.5** (3 rodadas) — determina o número mínimo de rodadas.

A fundação de migrations (7.1) libera o ajuste de ambiente por app (7.4), que — junto com a gravação
de `updated_at` (7.2) — é pré-requisito do review manual (7.5). Independente de quantos agentes
estejam disponíveis, o mínimo é **3 rodadas**.

Cadeia secundária (não crítica, cabe dentro das 3 rodadas): **9.1 → 9.2** (2 rodadas).

---

## Detalhe por Rodada

### Rodada 1 — 5 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 7.1 | Fundação de Migrations (Supabase) | (fundação do Épico 7) | Fundação de schema. Baseline `db pull` deve refletir fielmente o banco deployado **antes** de qualquer `db push`. |
| 7.6 | Remoção da Seção "Resposta da API" no Detalhe | (Épicos 1–6 concluídos) | Frontend puro, sem dependência de schema. Limpar imports órfãos (`CodeBlock`, `payload`). |
| 8.1 | Ícone Oficial YaID nas 4 Superfícies de Marca | (Épicos 1–6 concluídos) | Troca de asset (`public/yaid_icon.svg`), sem dependência de backend. |
| 8.2 | Topbar Dinâmica Integrada à Company Logada | (`GET /api/companies/me` — Épico 1) | Endpoint `companies/me` já existe (Story 1.7 done). |
| 9.1 | Emissão da VC como VC-JWT (EdDSA) | (Story 5.4 concluída) | ⚠️ TBD: biblioteca de JWS/EdDSA a definir + **coordenação externa** com a codebase do YaID Wallet (contrato do formato JWT) antes de implementar. |

### Rodada 2 — 4 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 7.2 | Coluna `updated_at` e Gravação em Toda Transição | 7.1 | Forward migration `add_updated_at_to_proof_requests` + backfill; `updateStatus()` grava `updated_at = now()`. |
| 7.3 | Allowlist de Criação de Apps (`can_create_apps`) | 7.1 | Forward migration `add_can_create_apps_to_company` com backfill `true` para empresas existentes. |
| 7.4 | Seletor de Ambiente na Criação de App + EnvBadge | 7.1 | Coluna `environment` já existe; migration só ajusta default/enum. Caminho crítico. |
| 9.2 | Verificação da VC-JWT em `presentations/verify` | 9.1 | Substitui validação JSON-LD `Ed25519Signature2020` pela decodificação/validação da VC-JWT. |

### Rodada 3 — 1 story

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 7.5 | Review Manual (Aprovar/Reprovar) em Apps de Homologação | 7.2, 7.4 | Usa `updateStatus()` com `updated_at` (7.2), o `environment` homol/prod (7.4) e `DeliverWebhookUseCase` (6.1, done). Fim do caminho crítico. |

---

## Grid de Designação

> Preencha esta seção externamente para designar stories a agentes ou desenvolvedores.

| Rodada | Story | Título | Responsável | Data Início | Observações |
|--------|-------|--------|-------------|-------------|-------------|
| 1 | 7.1 | Fundação de Migrations (Supabase) | | | |
| 1 | 7.6 | Remoção da Seção "Resposta da API" no Detalhe | | | |
| 1 | 8.1 | Ícone Oficial YaID nas 4 Superfícies de Marca | | | |
| 1 | 8.2 | Topbar Dinâmica Integrada à Company Logada | | | |
| 1 | 9.1 | Emissão da VC como VC-JWT (EdDSA) | | | ⚠️ TBD lib JWS/EdDSA + coordenação YaID Wallet |
| 2 | 7.2 | Coluna `updated_at` e Gravação em Toda Transição | | | |
| 2 | 7.3 | Allowlist de Criação de Apps (`can_create_apps`) | | | |
| 2 | 7.4 | Seletor de Ambiente na Criação de App + EnvBadge | | | |
| 2 | 9.2 | Verificação da VC-JWT em `presentations/verify` | | | |
| 3 | 7.5 | Review Manual (Aprovar/Reprovar) em Apps de Homologação | | | |
