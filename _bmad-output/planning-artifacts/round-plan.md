# Plano de Rodadas — yaid_dashboard

> **Atenção:** Este artefato é exclusivamente para organização da equipe.
> Ele **não deve ser referenciado durante a implementação de stories**.
> Preenchimento e designação de responsáveis ocorrem externamente ao Claude.

**Gerado em:** 2026-08-22
**Baseado no sprint-status de:** 2026-08-22

---

## Resumo

| Rodada | Stories | Máx. Agentes |
|--------|---------|-------------|
| 1 | 2 | 2 |
| 2 | 2 | 2 |
| **Total** | **4 stories** | **2 rodadas** |

## Caminho Crítico

Não há um único caminho crítico dominante — dois caminhos independentes de comprimento 2 determinam
o mínimo de rodadas:

- `12.1 → 12.2` (Epic 12 — Documentação Pública)
- `13.1 → 13.2` (Epic 13 — Landing Page Institucional)

Os dois épicos são explicitamente independentes entre si (conforme nota do Sprint Change
2026-08-22 em `epics.md`); a única relação entre eles é um link de navegação da landing (13.2)
para a página de docs (12.2), o que **não** é dependência técnica dura (mesma categoria de "fluxo
de navegação UX" excluída no Passo 3).

---

## Detalhe por Rodada

### Rodada 1 — 2 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-------------------|-------|
| 12.1 | Estrutura da Página e Seção "Conta e Apps" (`/docs`) | Fundação do Epic 1 (done) — rota pública, sem dependência de outra story em backlog | |
| 13.1 | Mover Dashboard para `/dashboard` e Ajustar Middleware/Redirects | Fundação do Epic 1 (done) — altera middleware e rotas existentes | Conflito de rota: `app/(dashboard)/page.tsx` hoje ocupa `/`; precisa ser movido antes que 13.2 possa criar `app/page.tsx` |

### Rodada 2 — 2 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-------------------|-------|
| 12.2 | Conteúdo — Proof Requests e Webhooks (`/docs`) | 12.1 | Adiciona seções à mesma página/rota criada em 12.1 — dependência técnica dura (mesmo arquivo) |
| 13.2 | Página Pública "/" — Landing Institucional | 13.1 | Só pode criar `app/page.tsx` para `/` depois que 13.1 libera a rota movendo o dashboard para `/dashboard`; o link para `/docs` não bloqueia (navegação, não dependência técnica) |

---

## Grid de Designação

> Preencha esta seção externamente para designar stories a agentes ou desenvolvedores.

| Rodada | Story | Título | Responsável | Data Início | Observações |
|--------|-------|--------|-------------|-------------|-------------|
| 1 | 12.1 | Estrutura da Página e Seção "Conta e Apps" | | | |
| 1 | 13.1 | Mover Dashboard para `/dashboard` e Ajustar Middleware/Redirects | | | |
| 2 | 12.2 | Conteúdo — Proof Requests e Webhooks | | | |
| 2 | 13.2 | Página Pública "/" — Landing Institucional | | | |
