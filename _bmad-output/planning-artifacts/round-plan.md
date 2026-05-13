# Plano de Rodadas — yaid_dashboard

> **Atenção:** Este artefato é exclusivamente para organização da equipe.
> Ele **não deve ser referenciado durante a implementação de stories**.
> Preenchimento e designação de responsáveis ocorrem externamente ao Claude.

**Gerado em:** 2026-05-13
**Baseado no sprint-status de:** 2026-05-13

---

## Resumo

| Rodada | Stories | Máx. Agentes |
|--------|---------|-------------|
| 1 | 5 | 5 |
| 2 | 7 | 7 |
| 3 | 6 | 6 |
| 4 | 1 | 1 |
| 5 | 1 | 1 |
| **Total** | **20 stories** | **5 rodadas** |

## Caminho Crítico

`5.1 → 5.3 → 5.5 → 6.1 → 6.2`

Esse encadeamento determina o número mínimo de rodadas: independente de quantos agentes estejam disponíveis, o projeto nunca termina em menos de 5 rodadas.

---

## Detalhe por Rodada

### Rodada 1 — 5 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 1.6 | Login e Proteção de Rotas | Fundação do Épico 1 concluída (1.1–1.5) | |
| 1.7 | Configurações da Empresa | Fundação do Épico 1 concluída (1.1–1.5) | |
| 3.1 | Endpoint B2B — Criação de Proof Request | Schema da 1.3 concluído | Backend puro, sem dependências restantes |
| 5.1 | Middleware de Auth por DID (withDIDAuth) | Padrão de middleware da 1.2 concluído | Infraestrutura independente |
| 5.2 | Wrapper BlockchainClient | Independente | ⚠️ TBD: biblioteca (ethers.js v6, viem etc.), estratégia de retry e tratamento de latência on-chain |

### Rodada 2 — 7 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 2.1 | Listagem de Aplicações | 1.6 | |
| 2.2 | Criação de App com API Key One-Shot | 1.6 | |
| 3.2 | Listagem de Proof Requests no Dashboard | 3.1 | |
| 3.3 | Detalhe de Proof Request | 3.1 | Paralela com 3.2 — endpoint e página distintos |
| 4.1 | Endpoint Público de Status da Sessão | 3.1 | Backend puro |
| 5.3 | Challenge e Abertura de Sessão | 5.1 + 5.2 + 3.1 | |
| 5.4 | Emissão de Verifiable Credential | 5.1 + 5.2 | ⚠️ TBD: provider OCR (Google Vision, AWS Textract, IDWall) e biblioteca Ed25519 |

### Rodada 3 — 6 stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 2.3 | Detalhe e Edição de App | 2.1 + 2.2 | |
| 3.4 | Helper de Criação de Proof Request (Dashboard) | 3.1 + 2.1 | Precisa do select de apps ativos |
| 3.5 | Overview do Dashboard | 1.7 + 2.1 | Precisa de GET /api/companies/me e GET /api/company-apps |
| 4.2 | Tela Coringa com Polling e 6 Estados Visuais | 4.1 | |
| 5.5 | Verificação de Verifiable Presentation | 5.1 + 5.2 + 5.3 + 5.4 | |
| 5.6 | Cancel de Sessão e Revogação de Credencial | 5.1 + 5.2 + 5.3 | |

### Rodada 4 — 1 story

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 6.1 | WebhookSigner e Entrega de Webhook | 5.5 + 5.6 | Integra o DeliverWebhookUseCase nas transições de 5.5 e 5.6 |

### Rodada 5 — 1 story

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 6.2 | Endpoint Público da Chave de Webhook | 6.1 | Usa a mesma infra de chave criada em 6.1 |

---

## Grid de Designação

> Preencha esta seção externamente para designar stories a agentes ou desenvolvedores.

| Rodada | Story | Título | Responsável | Data Início | Observações |
|--------|-------|--------|-------------|-------------|-------------|
| 1 | 1.6 | Login e Proteção de Rotas | | | |
| 1 | 1.7 | Configurações da Empresa | | | |
| 1 | 3.1 | Endpoint B2B — Criação de Proof Request | | | |
| 1 | 5.1 | Middleware de Auth por DID (withDIDAuth) | | | |
| 1 | 5.2 | Wrapper BlockchainClient | | | TBD: biblioteca blockchain |
| 2 | 2.1 | Listagem de Aplicações | | | |
| 2 | 2.2 | Criação de App com API Key One-Shot | | | |
| 2 | 3.2 | Listagem de Proof Requests no Dashboard | | | |
| 2 | 3.3 | Detalhe de Proof Request | | | |
| 2 | 4.1 | Endpoint Público de Status da Sessão | | | |
| 2 | 5.3 | Challenge e Abertura de Sessão | | | |
| 2 | 5.4 | Emissão de Verifiable Credential | | | TBD: OCR provider + Ed25519 lib |
| 3 | 2.3 | Detalhe e Edição de App | | | |
| 3 | 3.4 | Helper de Criação de Proof Request (Dashboard) | | | |
| 3 | 3.5 | Overview do Dashboard | | | |
| 3 | 4.2 | Tela Coringa com Polling e 6 Estados Visuais | | | |
| 3 | 5.5 | Verificação de Verifiable Presentation | | | |
| 3 | 5.6 | Cancel de Sessão e Revogação de Credencial | | | |
| 4 | 6.1 | WebhookSigner e Entrega de Webhook | | | |
| 5 | 6.2 | Endpoint Público da Chave de Webhook | | | |
