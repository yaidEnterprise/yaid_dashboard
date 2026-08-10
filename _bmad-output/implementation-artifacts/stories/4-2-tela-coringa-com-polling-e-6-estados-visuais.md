# Story 4.2: Tela Coringa com Polling e 6 Estados Visuais

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como holder,
Quero abrir o link de verificação no browser e ser guiado ao app YaID Wallet,
Para que eu complete o fluxo de verificação de identidade sem entregar documentos ou dados pessoais ao site da empresa.

## Acceptance Criteria

1. **Given** a URL `/v/[sessionToken]` com token válido e sessão em `waiting_user`
   **When** a página carrega
   **Then** exibe layout independente (sem sidebar ou topbar), container centralizado com marca YaID
   **And** exibe o nome da company solicitante e o proof_type traduzido para linguagem natural (ex: "Verificação de identidade pessoal")
   **And** exibe botão de deep link `yaid://verify?session=<token>` em destaque
   **And** exibe contador regressivo de tempo até expiração
   **And** inicia polling a `GET /api/proof-sessions/{sessionToken}` a cada 5–10 segundos

2. **Given** a tela em polling e a sessão transiciona para `opened`
   **When** o poll retorna `status: "opened"`
   **Then** exibe spinner com mensagem "Aguardando confirmação no app"
   **And** o botão de deep link é ocultado
   **And** o polling continua

3. **Given** a tela em polling e a sessão transiciona para `approved_by_user`
   **When** o poll retorna `status: "approved_by_user"`
   **Then** exibe mensagem de sucesso
   **And** se `returnUrl` está presente na resposta, exibe botão "Voltar para [nome da company]" que redireciona para `returnUrl`
   **And** o polling para imediatamente

4. **Given** a tela em polling e a sessão transiciona para `cancelled` (o backend não emite um status `rejected` distinto — ver Dev Notes)
   **When** o poll retorna esse status
   **Then** exibe mensagem genérica de não-conclusão sem detalhar o motivo
   **And** o polling para imediatamente

5. **Given** a tela em polling e a sessão transiciona para `expired`
   **When** o poll retorna `status: "expired"` ou o contador chega a zero
   **Then** exibe mensagem clara de expiração com orientação para a empresa gerar um novo link
   **And** o polling para imediatamente

6. **Given** a URL `/v/[sessionToken]` com token inválido ou inexistente
   **When** a página tenta carregar
   **Then** exibe mensagem genérica de link inválido sem revelar se o token existiu ou não

7. **Given** qualquer estado da tela
   **When** revisado
   **Then** nunca exibe: `externalReference`, token bruto, `requestId` interno ou qualquer dado pessoal do holder

## Tasks / Subtasks

- [x] Task 1: Criar hook `useProofSessionPolling` para orquestrar fetch inicial + polling (AC: #1, #2, #3, #4, #5, #6)
  - [x] Criar `app/v/[sessionToken]/use-proof-session-polling.ts` (ou local ao diretório da rota) com estado `{ session, loading, error }`
  - [x] Fetch inicial via `fetch(`/api/proof-sessions/${sessionToken}`, { cache: "no-store" })` — **não usar `fetchWithAuth`** (rota pública, sem sessão de usuário)
  - [x] `setInterval` de polling a cada 7000ms (dentro da faixa 5–10s pedida pelo AC) somente enquanto o status atual é ativo (`waiting_user` ou `opened`)
  - [x] Parar o polling (`clearInterval`) imediatamente ao receber qualquer status terminal (`approved_by_user`, `expired`, `cancelled`) — nunca fazer mais uma chamada após atingir estado terminal
  - [x] Tratar 404 (`Session not found`) como estado `invalid` distinto de erro genérico de rede
  - [x] Limpar o interval no cleanup do `useEffect` (unmount) para não vazar timers
  - [x] Retornar também `secondsRemaining` derivado de `expiresAt` (ver Task 2) para permitir que o contador force o estado `expired` no client mesmo antes do próximo poll confirmar

- [x] Task 2: Implementar contador regressivo local com fallback para expiração client-side (AC: #1, #5)
  - [x] Criar função utilitária `getSecondsRemaining(expiresAt: string): number` que calcula `Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))`
  - [x] Atualizar o contador a cada 1s via `setInterval` separado do polling (não acoplar o timer visual à cadência de rede)
  - [x] Quando o contador chegar a 0 e o status ainda for ativo, tratar a UI como estado `expired` imediatamente (sem esperar o próximo poll confirmar) — AC #5 exige isso explicitamente
  - [x] Formatar o tempo restante como `mm:ss`

- [x] Task 3: Criar componentes de estado visual em `components/verification/` (AC: #1, #2, #3, #4, #5, #6)
  - [x] `components/verification/verification-layout.tsx` — layout independente: `min-h-screen flex items-center justify-center`, sem sidebar/topbar, card `max-w-[520px]` com logo YaID no topo; usar os tokens semânticos já definidos em `app/globals.css` (`bg-background`, `bg-surface`, `text-text-primary`, etc. — **não** usar classes literais `bg-gray-50`/`blue-600` do documento de UX, que antecede o sistema de tokens já implementado no projeto)
  - [x] `components/verification/deep-link-button.tsx` — botão full-width, `href="yaid://verify?session=<token>"`, altura mínima 48px (touch target), label "Abrir YaID Wallet"
  - [x] `components/verification/verification-state-card.tsx` — componente que recebe o estado atual (`waiting_user | opened | approved_by_user | cancelled | expired | invalid`) e renderiza o card correspondente, reutilizando `StatusBadge` (`@/components/feedback/status-badge`) quando o `StatusKind` existente cobrir o caso (`pending`→waiting, `processing`→opened, `approved`→approved_by_user, `rejected`/`expired`→cancelled/expired — ver nota em Dev Notes sobre `StatusKind` não ter uma entrada dedicada para "opened"/"waiting", ok usar `processing`/`pending` como aproximação semântica)
  - [x] Cada card usa `role="status"` e a raiz do card usa `aria-live="polite"` para que leitores de tela anunciem a mudança de estado a cada transição (AC de acessibilidade da UX spec)

- [x] Task 4: Reescrever `app/v/[sessionToken]/page.tsx` usando os novos componentes e hook (AC: #1-#7)
  - [x] Substituir o fetch único e estado local atuais pelo hook `useProofSessionPolling`
  - [x] Substituir o DTO local `ProofSession` (campos antigos `id`, `proofRequestId`, `createdAt`, `openedAt`, `approvedAt`) pelo shape real de `GetProofSessionOutputDTO`: `{ status, proofType, companyName, expiresAt, returnUrl? }` — o formato antigo usado no arquivo atual não corresponde mais à resposta real da API desde a Story 4.1
  - [x] Estado `waiting_user`: nome da company (`session.companyName`) + `formatProofType(session.proofType)` (reaproveitar de `@/utils/proof-requests-store`, não recriar mapa de labels) + `DeepLinkButton` + contador regressivo
  - [x] Estado `opened`: spinner + "Aguardando confirmação no app" + `DeepLinkButton` **oculto**
  - [x] Estado `approved_by_user`: mensagem de sucesso + botão "Voltar para {companyName}" **somente se** `session.returnUrl` estiver presente (ver Dev Notes — hoje o backend nunca envia esse campo, então o botão deve ficar condicional e funcionar corretamente quando o campo existir no futuro)
  - [x] Estado `cancelled`: mensagem genérica de não-conclusão (não usar a mesma mensagem do estado `expired`, que hoje está reaproveitada incorretamente no arquivo atual)
  - [x] Estado `expired`: mensagem clara + orientação "solicite um novo link à empresa parceira"
  - [x] Estado `invalid` (404 ou token malformado): mensagem genérica, sem diferenciar "não existe" de "existe mas não é seu" (reaproveitar do bloco de erro já existente no arquivo atual)
  - [x] Remover o placeholder de QR code (`QrCode` icon) — fora de escopo do MVP conforme FR14 ("sem QR code no MVP")
  - [x] Adicionar `lang="pt-BR"` na raiz do componente (ou confirmar que já é herdado do `<html>` do layout raiz — verificar `app/layout.tsx`) — já herdado de `app/layout.tsx:28`, nenhuma mudança necessária
  - [x] Garantir que nenhum campo sensível (`externalReference`, `sessionToken` bruto, `requestId` interno) é renderizado em nenhum estado

- [x] Task 5: Validar build e diagnostics (AC: todos)
  - [x] Rodar `getDiagnostics` — zero erros TypeScript nos arquivos criados/modificados
  - [x] Rodar `npm run test` — sem regressão nos testes existentes (baseline atual: 397/397 passando, incluindo 25 novos testes da Story 4.2; um teste pré-existente da Story 1.3 foi ajustado para refletir a extração do `DeepLinkButton` — ver Change Log)

### Review Findings

- [x] [Review][Patch] "opened" exibido por clique local (`clickedOpen`), não por confirmação do servidor — viola intenção do AC #2 e reintroduz o anti-padrão que os Dev Notes explicitamente pediram para evitar; sem reset se o deep link falhar ou o status não avançar [app/v/[sessionToken]/page.tsx]
- [x] [Review][Patch] Erros de rede (não-404) tratados como sessão inválida — primeira carga com falha de rede mostra "Link inválido" permanente; erros durante polling são engolidos silenciosamente [app/v/[sessionToken]/page.tsx, app/v/[sessionToken]/use-proof-session-polling.ts]
- [x] [Review][Patch] `expiresAt` malformado/ausente produz contador `NaN:NaN` que nunca expira [app/v/[sessionToken]/use-proof-session-polling.ts:getSecondsRemaining]
- [x] [Review][Patch] `aria-live="polite"` envolve o contador que muda a cada segundo — leitor de tela reanuncia MM:SS repetidamente [components/verification/verification-state-card.tsx]
- [x] [Review][Patch] Fetch sem timeout/AbortController — requisição travada deixa o spinner de loading indefinidamente [app/v/[sessionToken]/use-proof-session-polling.ts]
- [x] [Review][Patch] Valor de status desconhecido renderiza card vazio sem fallback [components/verification/verification-state-card.tsx]
- [x] [Review][Patch] `StatusBadge` não aplicado aos estados `waiting_user`/`opened` conforme a tabela de mapeamento explícita dos Dev Notes (Task 3) [components/verification/verification-state-card.tsx]
- [x] [Review][Patch] `sessionToken` não é URI-encoded no deep link `yaid://verify?session=` [components/verification/deep-link-button.tsx]
- [x] [Review][Defer] Sem backoff/limite em falhas de fetch repetidas — parcialmente mitigado pelo patch de erro de rede; estratégia completa de backoff fica para hardening futuro fora do escopo do MVP — deferred
- [x] [Review][Defer] Throttling de timers em aba em segundo plano não tratado — comportamento de browser pré-existente a qualquer polling por timer; não governado pelos ACs da story — deferred
- [x] [Review][Defer] Testes são apenas inspeção estrutural de string (sem jsdom/simulação de timers) — convenção pré-existente em todas as stories anteriores (sem jsdom/testing-library instalado no projeto), não introduzida por esta story — deferred, pre-existing

## Dev Notes

### Estado atual do arquivo `app/v/[sessionToken]/page.tsx` — desalinhado com a Story 4.1

O arquivo já existe mas foi escrito **antes** da Story 4.1 mudar o shape da resposta da API. Ele hoje:
- Usa um tipo local `ProofSession` com campos `id`, `proofRequestId`, `createdAt`, `openedAt`, `approvedAt` — **nenhum desses campos existe mais na resposta real** (`GetProofSessionOutputDTO` só tem `status`, `proofType`, `companyName`, `expiresAt`, e opcionalmente `returnUrl` quando existir no backend)
- Não faz polling — busca o status uma única vez no mount
- Não tem contador regressivo funcional (`formatTime` apenas formata uma data absoluta, não uma contagem regressiva)
- Trata `expired` e `cancelled` com a mesma mensagem genérica ("Sessão expirada") — a Story 4.2 exige mensagens distintas (AC #4 vs #5)
- Não tem um estado dedicado para `opened` (spinner "Aguardando confirmação") — hoje mistura essa lógica dentro do card `waiting_user` via `openedApp || session.status === "opened"`
- Exibe um placeholder de QR code que está fora de escopo (FR14: "sem QR code no MVP")
- Não implementa o botão "Voltar para [company]" com `returnUrl`

Esta story precisa **reescrever** esse arquivo, não apenas ajustá-lo incrementalmente.

### Divergência crítica: `returnUrl` não existe na resposta real da API (apesar do AC #3 e da spec assumirem que existe)

A Story 4.1 originalmente planejava incluir `returnUrl` no DTO (ver dev notes daquela story), mas durante o alinhamento de schema (commits `a906849`, `87be0b5` — "align repository with real proof_sessions schema" / "update contract tests to match the real DB schema") ficou confirmado que a coluna `return_url` **não existe** na tabela `proof_requests` do banco real. O código atual (`get_proof_session_viewmodel.ts`, `get_proof_session_usecase.ts`, `ProofSessionRepository.ts`) **não tem** o campo `returnUrl` em lugar nenhum, e o teste `tests/unit/story-4-1/get-proof-session.test.mjs` afirma explicitamente que o DTO **não deve** ter esse campo.

**Implicação para esta story:** o campo `returnUrl` na resposta da API sempre será `undefined` hoje. O AC #3 é condicional ("se `returnUrl` está presente") — implemente o botão "Voltar para [company]" de forma defensiva (só renderiza quando o campo existir), mas **não** trate a ausência do campo como bug desta story. Não é necessário nem está no escopo desta story alterar o backend para adicionar a coluna — isso é uma decisão de escopo já tomada fora desta story. Tipar `returnUrl` como opcional no frontend (`returnUrl?: string | null`).

### Divergência: enum de status não tem `rejected`, apenas `cancelled`

`src/shared/domain/enums/ProofSessionStatus.ts` define apenas: `WAITING_USER`, `OPENED`, `APPROVED_BY_USER`, `EXPIRED`, `CANCELLED`. Não existe um status `REJECTED` distinto no sistema atual. Os épicos mencionam "cancelled ou rejected" tratando-os como sinônimos de "não concluído" — na prática, implemente o tratamento apenas para o valor real `"cancelled"` que a API pode retornar. Não crie lógica para um valor `"rejected"` que nunca será emitido pelo backend.

### Shape real da resposta (Story 4.1, já implementado e testado)

```typescript
// src/modules/proof-session/app/get_proof_session_viewmodel.ts
export type ProofSessionOutputDTO = {
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  proofType: string;
  companyName: string;
  expiresAt: string;
};
```

No frontend, tipar como (adicionando o opcional `returnUrl` para quando existir no futuro):

```typescript
type ProofSessionStatusResponse = {
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  proofType: string;
  companyName: string;
  expiresAt: string;
  returnUrl?: string | null;
};
```

### Rota é pública — não usar `fetchWithAuth`

`src/shared/middleware.ts` classifica `GET /api/proof-sessions/{token}` como rota pública (função `isPublicApiRoute`, linha 32) — sem cookie de sessão de empresa. O holder acessando `/v/[sessionToken]` no celular **não está logado** no dashboard. Usar `fetch` nativo (como o arquivo atual já faz), nunca `@/utils/fetch-with-auth` (que é para chamadas autenticadas do dashboard).

Erro 404 do endpoint retorna `{ error: { code, message } }` via `handleHttpError` — extrair `json?.error?.message` como já faz o código atual.

### Reaproveitar `formatProofType` — não recriar mapa de tradução

`utils/proof-requests-store.ts` já exporta `PROOF_TYPE_LABELS` e `formatProofType(proofType: string): string`, usado em `/proof-requests` e `/proof-requests/[requestId]`. Essas funções não dependem de auth (são puras) — seguras para importar na tela coringa. Reutilizar em vez de criar um novo mapa de labels.

### Componentes de referência (UX spec)

A especificação UX (`_bmad-output/planning-artifacts/ux-design-specification.md`, seção "Component Strategy", linhas 808-818) define três componentes a criar:

- **VerificationLayout** — layout independente da tela coringa, `min-h-screen flex items-center justify-center`, card central `max-w-[520px]`, logo YaID 48px no topo, sem sidebar/topbar.
- **VerificationStateCard** — renderiza um dos 6 estados: `waiting_user` (botão deep link), `opened` (spinner), `approved_by_user` (check verde + botão retorno se `returnUrl`), `cancelled` (X vermelho, mensagem genérica), `expired` (âmbar, orientação), `invalid` (mensagem genérica sem enumeration).
- **DeepLinkButton** — botão full-width `href="yaid://verify?session=<token>"`, label "Abrir YaID Wallet".

**Importante:** a spec de UX usa classes Tailwind literais (`bg-gray-50`, `blue-600`) que antecedem o sistema de design tokens semânticos já implementado no projeto (`bg-background`, `text-text-primary`, `bg-surface`, `success-bg`/`success-text`, `error-bg`/`error-text`, `warning-bg`/`warning-text`, `info-bg`/`info-text`, `neutral-bg`/`neutral-text`, `privacy`, `trust` — definidos em `app/globals.css` e já usados no arquivo atual de `page.tsx` e em `components/feedback/status-badge.tsx`). Siga os tokens semânticos já estabelecidos no código, não os valores literais do documento de UX.

### `StatusBadge` existente não tem `StatusKind` dedicado para `waiting_user`/`opened`

`components/feedback/status-badge.tsx` define `StatusKind = "approved" | "pending" | "rejected" | "expired" | "enabled" | "disabled" | "processing"`. Não crie novos `StatusKind`. Ao renderizar o badge de cada estado da tela coringa, mapeie:

| Status da sessão | `StatusKind` a usar | `label` sugerido |
|---|---|---|
| `waiting_user` | `pending` | "Aguardando" |
| `opened` | `processing` | "Em andamento" |
| `approved_by_user` | `approved` | "Verificado" |
| `cancelled` | `rejected` | "Não concluído" |
| `expired` | `expired` | "Expirado" |
| `invalid` | `rejected` | "Inválido" |

(O arquivo atual já faz algo parecido — `StatusBadge status="rejected" label="Inválida"` para o caso de erro, e `StatusBadge status="expired"` tanto para expired quanto cancelled. Ajustar apenas o mapeamento de `cancelled`, que hoje reusa `expired` incorretamente.)

### Contador regressivo e parada de polling

FR14 e o AC #5 exigem que o polling pare em fases terminais e que o contador force o estado `expired` no client mesmo antes do próximo poll (não esperar até 5-10s depois do tempo zerar). Implementar dois timers independentes:
1. Timer de 1s só para o display do contador (`mm:ss`) e para decidir se já passou de zero.
2. Timer de polling (5-10s, sugestão: 7000ms) que faz o fetch e atualiza o `status` real vindo do servidor — que é a fonte de verdade eventual (o servidor já marca a sessão como `EXPIRED` no banco quando consultada após o vencimento, conforme lógica implementada na Story 4.1 em `get_proof_session_usecase.ts`).

Ambos os timers devem ser limpos (`clearInterval`) ao desmontar o componente e ao atingir um status terminal.

### Convenções do projeto

- Path aliases: `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`; `@/components/*` → `components/*`; `@/utils/*` → `utils/*`
- Ícones: `lucide-react` (já usado no arquivo atual: `ShieldHalf`, `Clock`, `Loader2`, `CheckCircle2`, `Lock`, `ExternalLink`, `XCircle`)
- `npm run build` tem erros pré-existentes de tipos Next.js; usar `getDiagnostics` para validar
- Middleware já classifica `/v/*` como página pública (`isPublicAuthPage`, linha 18 de `src/shared/middleware.ts`) — nenhuma mudança de middleware necessária nesta story

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `app/v/[sessionToken]/page.tsx` | MODIFICAR | Reescrever usando novo DTO, hook de polling e componentes de estado |
| `app/v/[sessionToken]/use-proof-session-polling.ts` | CRIAR | Hook de fetch inicial + polling + contador |
| `components/verification/verification-layout.tsx` | CRIAR | Layout independente da tela coringa |
| `components/verification/verification-state-card.tsx` | CRIAR | Card por estado (6 estados) |
| `components/verification/deep-link-button.tsx` | CRIAR | Botão de deep link reutilizável |

**NÃO alterar:**
- `app/api/proof-sessions/[sessionToken]/route.ts` — já correto (Story 4.1)
- `src/modules/proof-session/app/get_proof_session_usecase.ts` — já correto, não adicionar `returnUrl` nesta story (ver Dev Notes acima)
- `src/shared/middleware.ts` — já classifica a rota como pública
- `utils/proof-requests-store.ts` — apenas importar `formatProofType`, não modificar

### References

- [Epics: Story 4.2 AC](_bmad-output/planning-artifacts/epics.md#story-42-tela-coringa-com-polling-e-6-estados-visuais)
- [Epics: FR13/FR14](_bmad-output/planning-artifacts/epics.md) — linhas 44 e 46
- [UX Design Spec: Component Strategy — VerificationLayout/VerificationStateCard/DeepLinkButton](_bmad-output/planning-artifacts/ux-design-specification.md) — linhas 808-818
- [UX Design Spec: Jornada 3 — Tela Coringa, Todos os Estados do Holder](_bmad-output/planning-artifacts/ux-design-specification.md) — linhas 694-721
- [UX Design Spec: Responsive Design — Tela Coringa Mobile Only](_bmad-output/planning-artifacts/ux-design-specification.md) — linhas 986-1004
- [UX Design Spec: Accessibility — aria-live para polling](_bmad-output/planning-artifacts/ux-design-specification.md) — linha 1030
- [Story 4.1 (endpoint consumido por esta story)](_bmad-output/implementation-artifacts/stories/4-1-endpoint-publico-de-status-da-sessao.md)
- [ProofSessionOutputDTO real: src/modules/proof-session/app/get_proof_session_viewmodel.ts](src/modules/proof-session/app/get_proof_session_viewmodel.ts)
- [Use case real (sem returnUrl): src/modules/proof-session/app/get_proof_session_usecase.ts](src/modules/proof-session/app/get_proof_session_usecase.ts)
- [Middleware — rota pública: src/shared/middleware.ts](src/shared/middleware.ts)
- [StatusBadge existente: components/feedback/status-badge.tsx](components/feedback/status-badge.tsx)
- [formatProofType existente: utils/proof-requests-store.ts](utils/proof-requests-store.ts)
- [Arquivo atual a reescrever: app/v/[sessionToken]/page.tsx](app/v/[sessionToken]/page.tsx)
- [Teste de contrato Story 4.1 confirmando ausência de returnUrl: tests/unit/story-4-1/get-proof-session.test.mjs](tests/unit/story-4-1/get-proof-session.test.mjs)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

### Completion Notes List

- `app/v/[sessionToken]/use-proof-session-polling.ts` criado: hook com fetch inicial + polling a cada 7000ms (dentro da faixa 5–10s), para automaticamente em status terminal, trata 404 como `invalid`, expõe `secondsRemaining` via `getSecondsRemaining(expiresAt)` e contador de 1s independente do ciclo de polling (usa `isActive` derivado como dependência do `useEffect` para evitar warning de `exhaustive-deps` sem acoplar o timer visual à cadência de rede)
- `components/verification/verification-layout.tsx`, `deep-link-button.tsx`, `verification-state-card.tsx` criados conforme a estratégia de componentes da spec de UX, usando os tokens semânticos já estabelecidos em `app/globals.css` (não os literais `gray-50`/`blue-600` do documento de UX)
- `app/v/[sessionToken]/page.tsx` reescrito: substituído o DTO local desatualizado (`id`, `proofRequestId`, `createdAt`, `openedAt`, `approvedAt`) pelo shape real da Story 4.1; removido placeholder de QR code; adicionado estado dedicado para `opened` (spinner sem deep link) e mensagem distinta para `cancelled` vs `expired`; contador força `expired` no client quando chega a zero, sem esperar o próximo poll
- `returnUrl` implementado de forma condicional no botão "Voltar para {company}" — o backend real (Story 4.1) nunca envia esse campo hoje (`return_url` não existe na tabela `proof_requests`); a UI já está pronta para quando existir, sem trabalho adicional necessário nesta story
- Teste pré-existente `tests/unit/story-1-3/proof-session-schema.test.mjs` ajustado: a asserção que verificava a string do deep link diretamente em `page.tsx` foi atualizada para verificar em `components/verification/deep-link-button.tsx`, para onde a lógica foi extraída — a intenção original do teste (não ler `session.deepLinkUrl`, construir a partir do `sessionToken`) foi preservada
- `npx tsc --noEmit`: zero erros. `npx eslint`: zero erros/warnings nos arquivos tocados. `npm run test`: 397/397 passando (372 baseline + 25 novos testes da Story 4.2), sem regressões
- **Patches do code review aplicados (8/8):** removido `clickedOpen` de `page.tsx` — `displayStatus` agora deriva exclusivamente de `session.status` confirmado pelo servidor (única exceção: contador chegando a zero força `expired`, conforme AC #5); adicionado estado visual `network` distinto de `invalid` (primeira carga com falha de rede não é mais confundida com token inválido); `getSecondsRemaining` agora guarda contra `expiresAt` malformado (`Number.isNaN`); `fetchStatus` agora usa `AbortController` com timeout de 10s; `VerificationStateCard` ganhou um branch de fallback para valores de status desconhecidos; `StatusBadge` (`pending`/`processing`) aplicado a `waiting_user`/`opened` conforme a tabela dos Dev Notes; a região `aria-live="polite"` do estado `waiting_user` foi restrita ao título/descrição, excluindo o contador regressivo (que muda a cada segundo) para não gerar reanúncios repetidos em leitores de tela; `DeepLinkButton` agora usa `encodeURIComponent(sessionToken)`
- 9 novos testes estruturais adicionados para travar os patches acima contra regressão futura
- `npx tsc --noEmit`: zero erros. `npx eslint`: zero erros/warnings. `npm run test`: 406/406 passando (397 anteriores + 9 novos), sem regressões

### File List

**Criados:**
- `app/v/[sessionToken]/use-proof-session-polling.ts`
- `components/verification/verification-layout.tsx`
- `components/verification/deep-link-button.tsx`
- `components/verification/verification-state-card.tsx`
- `tests/unit/story-4-2/verification-screen.test.mjs`

**Modificados:**
- `app/v/[sessionToken]/page.tsx`
- `tests/unit/story-1-3/proof-session-schema.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-07-15: Implementação completa da Story 4.2 — tela coringa reescrita com polling, contador regressivo, 6 estados visuais distintos e deep link, seguindo o shape de resposta real da Story 4.1. Ajustado teste estrutural pré-existente da Story 1.3 para refletir a extração do `DeepLinkButton`.
- 2026-07-15: Aplicados os 8 achados `[Review][Patch]` do code review (estado `opened` agora 100% guiado pelo servidor, distinção entre erro de rede e link inválido, guarda contra `expiresAt` malformado, timeout de fetch, fallback para status desconhecido, `StatusBadge` em `waiting_user`/`opened`, `aria-live` restrito ao texto de estado, encode do `sessionToken` no deep link). 3 achados `[Review][Defer]` registrados em `deferred-work.md`.
