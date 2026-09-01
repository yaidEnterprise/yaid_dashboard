# Sprint Change Proposal — 2026-08-31
## QR Code na Tela Coringa

---

## Seção 1 — Resumo do Issue

**Problema:**
O PRD original sempre descreveu QR code no estado `waiting_user` da tela coringa
(`waiting_user (deep link + QR + tempo restante)` e *"Mobile esconde QR e dá destaque ao botão
de deep link; desktop mostra QR"*), mas ao decompor o Epic 4, FR14 descartou explicitamente a
feature com "(sem QR code no MVP)" e a Story 4.2 nunca incluiu ACs correspondentes.

O usuário-wallet precisa conseguir escanear um QR code na tela coringa para abrir o app YaID
diretamente, sem depender apenas do botão de deep link — o que é especialmente importante em
contextos desktop onde o holder precisa abrir o link no celular.

**Quando descoberto:** Durante revisão do Epic 4 / Sprint em andamento.

**Evidências:**
- PRD, seção "Tela coringa": *"waiting_user (deep link + QR + tempo restante)"* + *"Mobile esconde QR e dá destaque ao botão de deep link; desktop mostra QR."*
- FR14 nos Epics: *"(sem QR code no MVP)"* — descoped sem nova story formal
- Story 4.2 ACs: ausência total de menção ao QR code

---

## Seção 2 — Análise de Impacto

### Epic Impact

| Epic | Afetado? | Mudança |
|------|----------|---------|
| Epic 4 — Tela Coringa e Sessão de Verificação | **Sim** | Story 4.2 recebe ACs de QR code |
| Todos os outros epics (1–3, 5–13) | **Não** | Sem alteração |

### Story Impact

| Story | Mudança |
|-------|---------|
| Story 4.2 — Tela Coringa com Polling e 6 Estados Visuais | Adicionar ACs de QR code ao estado `waiting_user` com comportamento responsivo |

### Impacto nos Artefatos

| Artefato | Mudança |
|----------|---------|
| PRD — FR14 | Remover "(sem QR code no MVP)"; adicionar comportamento responsivo QR |
| PRD — seção "Tela coringa" | Sem mudança necessária (já descreve QR corretamente) |
| Epics — FR14 | Mesma correção |
| Epics — Story 4.2 ACs | Adicionar AC de QR code |
| UX Spec | Sem mudança (já documenta mobile esconde QR / desktop mostra QR) |
| Arquitetura | **Sem mudança** — feature puramente frontend |
| Banco / Migrations | **Sem mudança** — nenhuma coluna nova |
| CI/CD / Infra | **Sem mudança** |

### Impacto Técnico

- **Backend/API:** zero. O `sessionToken` já está disponível na tela coringa (vem do parâmetro de rota `[sessionToken]`). O QR codifica a URL `yaid://verify?session=<token>` — exatamente o mesmo destino do botão de deep link.
- **Frontend:** adicionar biblioteca de geração de QR code (pura, sem dependência de backend).
  - Candidatas recomendadas: `react-qr-code` (zero deps, SVG nativo) ou `qrcode.react` (Canvas/SVG)
  - O agente implementador deve escolher e documentar a escolha antes de implementar
- **Responsividade:** desktop mostra QR + botão; mobile esconde QR e dá destaque ao botão

---

## Seção 3 — Abordagem Recomendada

**Opção escolhida: Ajuste Direto (Opção 1)**

**Justificativa:**
- A feature já estava planejada no PRD — é uma reativação, não uma feature nova
- Zero impacto em backend, banco, migrations, CI/CD
- Esforço baixo: ~1 story simples ou adendo à Story 4.2 existente
- Risco baixo: componente visual isolado, sem efeitos colaterais em outros fluxos
- Não afeta prazo nem MVP — é aditivo dentro do Epic 4 já planejado

**Esforço estimado:** Baixo (~2–4h de implementação frontend)
**Risco:** Baixo
**Timeline:** Pode entrar na iteração atual junto com ou após a Story 4.2

---

## Seção 4 — Propostas de Mudança Detalhadas

### Mudança 1 — FR14 (PRD e Epics)

**Story:** N/A (FR, não story)
**Seção:** Functional Requirements — FR14

**ANTES:**
```
FR14: A tela coringa deve realizar polling em `GET /api/proof-sessions/{token}` a cada 5–10s nas fases ativas; parar nas fases terminais; exibe botão de deep link `yaid://verify?session=<token>` (sem QR code no MVP).
```

**DEPOIS:**
```
FR14: A tela coringa deve realizar polling em `GET /api/proof-sessions/{token}` a cada 5–10s nas fases
ativas; parar nas fases terminais; no estado `waiting_user`, exibe botão de deep link
`yaid://verify?session=<token>` em destaque e QR code codificando a mesma URL — em dispositivos
mobile o QR code é ocultado e o botão de deep link recebe destaque visual ampliado; em desktop
ambos são exibidos com o QR como elemento principal de escaneamento.
```

**Rationale:** Reconcilia FR14 com o PRD body, que sempre descreveu QR code. Remove descoping injustificado.

---

### Mudança 2 — Story 4.2 — Adicionar ACs de QR Code

**Story:** 4.2 — Tela Coringa com Polling e 6 Estados Visuais
**Seção:** Acceptance Criteria — estado `waiting_user`

**ANTES (AC atual do estado `waiting_user`):**
```
**Given** a URL `/v/[sessionToken]` com token válido e sessão em `waiting_user`
**When** a página carrega
**Then** exibe layout independente (sem sidebar ou topbar), container centralizado com marca YaID
**And** exibe o nome da company solicitante e o proof_type traduzido para linguagem natural (ex: "Verificação de identidade pessoal")
**And** exibe botão de deep link `yaid://verify?session=<token>` em destaque
**And** exibe contador regressivo de tempo até expiração
**And** inicia polling a `GET /api/proof-sessions/{sessionToken}` a cada 5–10 segundos
```

**DEPOIS (AC atualizado + novo AC responsivo):**
```
**Given** a URL `/v/[sessionToken]` com token válido e sessão em `waiting_user`
**When** a página carrega
**Then** exibe layout independente (sem sidebar ou topbar), container centralizado com marca YaID
**And** exibe o nome da company solicitante e o proof_type traduzido para linguagem natural (ex: "Verificação de identidade pessoal")
**And** exibe botão de deep link `yaid://verify?session=<token>` em destaque
**And** exibe QR code codificando a URL `yaid://verify?session=<token>` — o mesmo destino do botão
**And** exibe contador regressivo de tempo até expiração
**And** inicia polling a `GET /api/proof-sessions/{sessionToken}` a cada 5–10 segundos

**Given** a tela coringa em `waiting_user` acessada em dispositivo mobile (viewport < 1024px ou `md:` breakpoint)
**When** o componente de QR code renderiza
**Then** o QR code é ocultado (`hidden md:block` ou equivalente responsivo)
**And** o botão de deep link recebe tamanho e destaque ampliados (`size="lg"`, touch target mínimo 48px)

**Given** a tela coringa em `waiting_user` acessada em desktop (viewport ≥ 1024px)
**When** o componente de QR code renderiza
**Then** o QR code é exibido como elemento principal de escaneamento, acima ou ao lado do botão de deep link
**And** o QR code exibe também uma instrução textual ("Escaneie com o app YaID Wallet")
```

**Rationale:** Torna o estado `waiting_user` usável em contextos desktop onde o holder recebe o link num computador e precisa abrir no celular via escaneamento — o principal caso de uso do QR.

---

### Mudança 3 — Dependência de Biblioteca (nota para o agente implementador)

**Tipo:** Decisão técnica a ser tomada pelo agente implementador antes de codificar.

O agente implementador deve escolher entre:
- **`react-qr-code`** — SVG nativo, zero dependências, ~5kb. Preferido para alinhamento com o stack atual (shadcn/ui + Tailwind).
- **`qrcode.react`** — Canvas e SVG, mais popular, levemente maior.

A escolha deve ser documentada como comentário inline ou no PR antes de implementar.

---

## Seção 5 — Plano de Handoff para Implementação

**Classificação de escopo: Minor**

**Handoff:** Developer agent — implementação direta

**Responsabilidades:**
1. Aplicar as mudanças textuais em `epics.md` (FR14 + Story 4.2 ACs conforme acima)
2. Aplicar a mudança em `prd.md` (FR14 — mesmo texto)
3. Escolher a biblioteca de QR code e instalá-la (`npm install react-qr-code` ou equivalente)
4. Implementar o componente `QrCodeBlock` (ou nome equivalente) na tela coringa:
   - Codifica `yaid://verify?session=<token>`
   - Hidden em mobile, visível em desktop
   - Instrução textual abaixo do QR
5. Atualizar o AC do estado `opened` para confirmar que o QR também é ocultado junto com o botão de deep link ao transicionar para `opened`

**Critérios de sucesso:**
- QR code aparece no estado `waiting_user` em desktop
- QR code é ocultado em mobile sem regressão no botão de deep link
- Escanear o QR abre o app YaID com o `session_token` correto
- Os demais 5 estados visuais da tela coringa não sofrem regressão
- `npm run build` passa sem erros após a instalação da lib

---

*Gerado em 2026-08-31 via bmad-correct-course workflow.*
