# Story 7.5: Review Manual (Aprovar/Reprovar) em Apps de Homologação

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como empresa parceira com um app de homologação,
Quero aprovar ou reprovar manualmente uma proof_request pelo dashboard,
Para que eu exercite o ciclo completo até o webhook real sem depender do app mobile durante os testes.

> 📋 **Referência UX:** [`ux-design-specification.md`](../../planning-artifacts/ux-design-specification.md) — seção "#4 — Review manual (Aprovar/Reprovar) no detalhe da proof request" (linha ~1115): botões **Aprovar** (primary/green) e **Reprovar** (destructive) na área de ações do header, visíveis só em `homol` + status não-terminal; confirmação obrigatória ("Esta ação envia o webhook real para o app e não pode ser desfeita."); `toast.success` ao concluir.

## Acceptance Criteria

1. **Given** um `POST /api/proof-requests/{requestId}/review` autenticado por sessão, com body `{ decision: "approve" | "reject" }`, para uma proof_request de um app `homol` em status não-terminal
   **When** o `ReviewProofRequestUseCase` executa
   **Then** `approve` transiciona a proof_request para `approved` e `reject` para `rejected`
   **And** `updated_at = now()` é gravado (via `updateStatus()` da Story 7.2)
   **And** `DeliverWebhookUseCase` (Story 6.1) é disparado — o mesmo caminho de um fluxo real

2. **Given** uma proof_request cujo app tem `environment = "prod"` (ou `"dev"` legado)
   **When** o endpoint de review é chamado
   **Then** o guard server-side rejeita com `AppError` 403 — defesa em profundidade, independente da UI

3. **Given** uma proof_request em status terminal (`approved`, `rejected`, `expired`)
   **When** o review é chamado
   **Then** o guard rejeita com `AppError` 422 — não há re-transição de estado terminal

4. **Given** um `requestId` que não pertence à company autenticada
   **When** o endpoint é chamado
   **Then** retorna 404 (isolamento por company, sem enumeration — mesmo padrão do `GetProofRequestUseCase`, NFR6)

5. **Given** a página `/(dashboard)/proof-requests/[requestId]` para um app `homol` e status não-terminal (`pending_user`/`processing`)
   **When** o header do detalhe é renderizado
   **Then** os botões **Aprovar** (primary/green) e **Reprovar** (destructive) aparecem na área de ações
   **And** cada um exige um diálogo de confirmação ("Esta ação envia o webhook real para o app e não pode ser desfeita.")
   **And** ao concluir, exibe `toast.success` ("Verificação aprovada"/"Verificação reprovada"), atualiza o status na tela e o campo "Atualizada em"

6. **Given** um app `prod` ou uma proof_request em status terminal
   **When** a página de detalhe é renderizada
   **Then** os botões de review não aparecem na UI

> **Nota de terminologia:** o epics.md cita status "opened" como não-terminal — esse valor **não existe** em `ProofRequestStatus` (`src/shared/domain/enums/ProofRequestStatus.ts`: `pending_user | processing | approved | rejected | expired`). O status não-terminal real é `pending_user` **ou** `processing` (setado em `challenge_proof_session_usecase.ts` quando o holder abre a sessão). Use exatamente esses dois valores nos guards e na condição de visibilidade da UI.

## Tasks / Subtasks

- [x] Task 1: `ReviewProofRequestUseCase` + viewmodel (AC: #1, #2, #3, #4)
  - [x] Criar `src/modules/proof-request/app/review_proof_request_viewmodel.ts`: `ReviewProofRequestSchema = z.object({ decision: z.enum(["approve", "reject"]) })` + `ReviewProofRequestOutputDTO = { id: string; status: ProofRequestStatus; updatedAt: string }`
  - [x] Criar `src/modules/proof-request/app/review_proof_request_usecase.ts` seguindo **exatamente** o padrão de `cancel_proof_session_usecase.ts` (ver Dev Notes): busca `findById`, guard de ownership (404), guard de ambiente (403), guard de status terminal (422), `updateStatus`, dispara `DeliverWebhookUseCase` fire-and-forget
  - [x] Criar `src/modules/proof-request/app/review_proof_request_controller.ts`: parse do body com `ReviewProofRequestSchema.parse`, chama use case
  - [x] Criar `src/modules/proof-request/app/review_proof_request_presenter.ts`: `makeReviewProofRequestController()` compõe `ProofRequestRepository` (via `envs.getProofRequestRepository()`) + `makeDeliverWebhookUseCase()`

- [x] Task 2: Rota HTTP + middleware (AC: #1, #2, #3, #4)
  - [x] Criar `app/api/proof-requests/[requestId]/review/route.ts` — `POST`, segue o padrão de `app/api/proof-requests/[requestId]/route.ts` (try/catch → `handleHttpError`)
  - [x] **Crítico:** adicionar regra em `isSessionAuthApiRoute()` (`src/shared/middleware.ts`) para `POST /api/proof-requests/{id}/review` — hoje só `GET /api/proof-requests*` passa por `withSessionAuth`; sem isso a rota nova fica sem autenticação de sessão (ver Dev Notes)

- [x] Task 3: Client store (AC: #5)
  - [x] `utils/proof-requests-store.ts`: adicionar `reviewProofRequest(requestId: string, decision: "approve" | "reject")` via `fetchWithAuth` POST, seguindo o padrão de `getProofRequest`/`asJson` já existentes no arquivo

- [x] Task 4: UI — botões de review + diálogo de confirmação (AC: #5, #6)
  - [x] `app/(dashboard)/proof-requests/[requestId]/page.tsx`: adicionar área de ações no header (ao lado de `StatusBadge`/`EnvBadge`) com botões Aprovar/Reprovar, visíveis apenas quando `data.environment === "homol" && (data.status === "pending_user" || data.status === "processing")`
  - [x] Criar diálogo de confirmação reaproveitando a estrutura de `DisableConfirmDialog` (`app/(dashboard)/apps/[appId]/page.tsx`, ver Dev Notes) — não existe `AlertDialog` do shadcn/ui neste repo, não adicionar a dependência
  - [x] Handler: chama `reviewProofRequest`, em sucesso atualiza `data.status`/`data.updatedAt` local e `toast.success(...)`; em erro `toast.error((e as Error).message)`; fecha o diálogo e reseta loading no `finally`

- [x] Task 5: Testes (AC: todos)
  - [x] Criar `tests/unit/story-7-5/` seguindo o padrão da Story 7.3: `.test.mjs` (estrutural, regex sobre source) + `.dynamic.test.ts` (comportamental, `tsx --test`, fakes em memória para `ProofRequestRepository`/`DeliverWebhookUseCase`, `node:assert/strict`)
  - [x] Cobrir: transição approve/reject, guard 403 (`environment !== "homol"`, incluindo `"dev"` legado), guard 422 (cada status terminal), guard 404 (not found e company diferente), disparo fire-and-forget do webhook, visibilidade condicional dos botões na UI (estrutural)
  - [x] Adicionar script `"test:story:7.5"` ao `package.json`, mesmo formato de `"test:story:7.3"`

- [x] Task 6: Rodar suíte completa e validar
  - [x] `npm run test:story:7.5` — 29/29 passando (16 estruturais + 13 comportamentais)
  - [x] `npm run test` (suíte completa) — 957/966 passando; as 9 falhas são pré-existentes em `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` (testes de bash real do pipeline Amplify da Story 11.8, arquivo não tocado por esta story) — confirmado via `git status --short` (sem alterações nesse arquivo)
  - [x] `npm run lint` — 18 problemas (6 erros/12 warnings), mesma contagem documentada como baseline pré-existente na Story 7.3; nenhum nos arquivos criados/modificados por esta story (confirmado item a item no output do lint)
  - [x] `npx tsc --noEmit` — limpo, zero erros

### Review Findings

- [x] [Review][Patch] Regex de session-auth para `POST .../review` não tolera barra final — uma variante com trailing slash não bate no `test(pathname)` e cai no fallback sem autenticação (fail-open, defesa em profundidade reduzida) [`src/shared/middleware.ts:28`] — corrigido: regex passou a `/^\/api\/proof-requests\/[^/]+\/review\/?$/`.
- [x] [Review][Patch] Backdrop click e Escape fecham o `ReviewConfirmDialog` sem checar `loading`, contradizendo a própria mensagem do diálogo ("não pode ser desfeita") — a request/webhook em andamento não é abortada, só a UI esconde o diálogo [`app/(dashboard)/proof-requests/[requestId]/page.tsx:294`, `:312`] — corrigido: ambos os handlers agora checam `!loading` antes de chamar `onCancel()`, mesmo guard já usado no botão "Cancelar".
- [x] [Review][Patch] Mensagem do guard de ambiente mistura inglês e português ("...homologação apps") e é exibida ao usuário via `toast.error`, inconsistente com o resto das strings do diff (100% PT-BR) [`src/modules/proof-request/app/review_proof_request_usecase.ts:33`] — corrigido: mensagem reescrita em inglês puro ("homologation apps"), consistente com as demais mensagens de `AppError` do módulo (ex.: `ForbiddenError("Company not allowed to create apps")` da Story 7.3).
- [x] [Review][Patch] Em caso de erro no review (ex.: 422 por corrida concorrente — outro reviewer já decidiu a mesma request), a UI não resincroniza `data`/`canReview` após o `catch` — os botões Aprovar/Reprovar continuam visíveis para uma request já terminal, permitindo cliques repetidos que sempre falham [`app/(dashboard)/proof-requests/[requestId]/page.tsx:75`] — corrigido: o `catch` agora refaz `getProofRequest(requestId)` e atualiza `data`, resincronizando `canReview` sem interromper o fluxo se o refetch também falhar.
- [x] [Review][Defer] Race condition (TOCTOU) na transição de status — `findById()` lê um snapshot, o guard de status terminal valida contra esse snapshot, e `updateStatus()` escreve sem compare-and-swap; duas chamadas concorrentes de review podem ambas passar o guard 422 antes de qualquer escrita, disparando dois webhooks ou um `reject` sobrescrevendo um `approve` recém-aplicado — deferido, `ProofRequestRepository.updateStatus()` não suporta update condicional e é usada por 3+ use cases (`cancel_proof_session`, `verify_presentation`, este); corrigir exige mudar a interface compartilhada, fora do escopo desta story [`src/modules/proof-request/app/review_proof_request_usecase.ts`, `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts`]
- [x] [Review][Defer] `updatedAt` retornado ao client/webhook é calculado em memória (`new Date().toISOString()`) em vez de lido de volta do valor que `updateStatus()` efetivamente persistiu — deferido, mesma limitação estrutural do item acima (`updateStatus()` retorna `Promise<void>`, não a linha atualizada); na prática o drift é sub-milissegundo dentro da mesma request [`src/modules/proof-request/app/review_proof_request_usecase.ts`]
- [x] [Review][Defer] `req.headers.get("x-company-id")!` sem guard contra `null` — deferido, padrão idêntico ao já existente na rota GET irmã (`app/api/proof-requests/[requestId]/route.ts`), não introduzido por esta story [`app/api/proof-requests/[requestId]/review/route.ts`]
- [x] [Review][Defer] `await req.json()` sem tratamento de corpo malformado/vazio — um `SyntaxError` cai no branch genérico 500 de `handleHttpError` em vez de um 400 — deferido, padrão idêntico ao já existente em `app/api/proof-requests/route.ts` (rota B2B de criação), não introduzido por esta story [`app/api/proof-requests/[requestId]/review/route.ts`]
- [x] [Review][Defer] `ReviewConfirmDialog` não implementa focus trap (Tab pode levar o foco para fora do modal enquanto ele está visível) — deferido, mesma lacuna de acessibilidade já presente no `DisableConfirmDialog` que esta story reaproveitou como padrão; corrigir isoladamente aqui deixaria os dois diálogos inconsistentes entre si [`app/(dashboard)/proof-requests/[requestId]/page.tsx`]
- [x] [Review][Defer] `useEffect` do diálogo depende de `onCancel`, passado como arrow function inline pelo componente pai — um re-render do pai por motivo não relacionado (ex.: outro estado mudando) re-executa o efeito e rechama `.focus()` no botão de confirmação — deferido, padrão idêntico ao já existente em `DisableConfirmDialog`/`app/(dashboard)/apps/[appId]/page.tsx:621` (`onCancel={() => setDisableDialogOpen(false)}`), não introduzido por esta story [`app/(dashboard)/proof-requests/[requestId]/page.tsx`]
- [x] [Review][Defer] Botões "Aprovar"/"Reprovar" no header não são desabilitados durante `reviewLoading` — clicar novamente reabre/reseta o diálogo, mas sem risco de double-submit real porque o botão de confirmação do diálogo já fica desabilitado pelo mesmo estado `reviewLoading` compartilhado — deferido, severidade baixa, UX menor [`app/(dashboard)/proof-requests/[requestId]/page.tsx`]
- [x] [Review][Defer] Sem validação de formato do `requestId` (UUID ou outro) antes de chegar ao repositório — deferido, mesmo padrão da rota GET irmã, que também não valida [`app/api/proof-requests/[requestId]/review/route.ts`]
- [x] [Review][Defer] Resposta de `reviewProofRequest()` é apenas type-cast (`as ReviewProofRequestResult`), sem validação de schema em runtime — deferido, mesmo padrão já usado por `getProofRequest()` no mesmo arquivo [`utils/proof-requests-store.ts`]

## Dev Notes

### Padrão de referência direto: `CancelProofSessionUseCase`

`src/modules/proof-session/app/cancel_proof_session_usecase.ts` é o precedente mais próximo — uma ação autenticada por sessão que transiciona uma proof_request e dispara webhook. Reaproveitar a estrutura quase literalmente:

```ts
// cancel_proof_session_usecase.ts (referência)
const session = await this.sessionRepo.findByTokenHash(tokenHash);
if (!session) throw new NotFoundError("Session not found", "PROOF_SESSION_NOT_FOUND");
if (TERMINAL_STATUSES.has(session.status)) throw new UnprocessableEntityError("Session already in terminal state");
session.cancel();
await this.sessionRepo.update(session);
await this.requestRepo.updateStatus(session.proofRequestId, ProofRequestStatus.REJECTED);
if (this.deliverWebhook) {
  this.deliverWebhook.execute({ proofRequestId, status, proofType: "verification", updatedAt: new Date().toISOString() })
    .catch((err) => console.error(`[webhook] fire-and-forget error: ${err}`));
}
```

Diferenças para `ReviewProofRequestUseCase`:
- Não há `ProofSession`/`.cancel()` envolvido — a entrada é direto por `requestId` via `ProofRequestRepository.findById()`.
- **Webhook é fire-and-forget (`.catch()`, nunca `await`)** — não bloquear a resposta HTTP na entrega do webhook, mesma decisão do cancel.
- `proofType` do webhook deve ser `row.request.proofType` real (não a string fixa `"verification"` usada no cancel) — o webhook já expõe esse campo em `DeliverWebhookInput`.

### Assinatura exata de `ReviewProofRequestUseCase.execute()`

```ts
async execute(input: {
  requestId: string;
  companyId: string;
  decision: "approve" | "reject";
}): Promise<ReviewProofRequestOutputDTO> {
  const row = await this.requestRepo.findById(input.requestId);
  // 404 para not-found E para company errada — nunca 403 (NFR6, mesmo padrão do GetProofRequestUseCase)
  if (!row || row.app.companyId !== input.companyId) {
    throw new NotFoundError("Proof request not found", "PROOF_REQUEST_NOT_FOUND");
  }
  if (row.app.environment !== "homol") {
    throw new ForbiddenError("Manual review is only available for homologação apps");
  }
  const TERMINAL = new Set([ProofRequestStatus.APPROVED, ProofRequestStatus.REJECTED, ProofRequestStatus.EXPIRED]);
  if (TERMINAL.has(row.request.status)) {
    throw new UnprocessableEntityError("Proof request already in terminal state");
  }

  const newStatus = input.decision === "approve" ? ProofRequestStatus.APPROVED : ProofRequestStatus.REJECTED;
  await this.requestRepo.updateStatus(input.requestId, newStatus);

  if (this.deliverWebhook) {
    this.deliverWebhook
      .execute({
        proofRequestId: input.requestId,
        status: newStatus,
        proofType: row.request.proofType,
        externalReference: row.request.externalRef,
        updatedAt: new Date().toISOString(),
      })
      .catch((err) => console.error(`[webhook] fire-and-forget error: ${err}`));
  }

  return { id: input.requestId, status: newStatus, updatedAt: new Date().toISOString() };
}
```

`requestRepo.updateStatus(id, status)` (`SupabaseProofRequestRepository.ts:106`) já grava `status` **e** `updated_at = now()` na mesma operação — não toca `result`/`validated_at` (e não deve: essas colunas são exclusivas do fluxo real de `verify_presentation_usecase`, fora do escopo desta story). `ProofRequestWithApp.app.environment` já vem populado no `findById()` via join com `company_apps` — nenhuma query extra necessária.

Ordem dos guards importa: ownership (404) → ambiente (403) → status terminal (422). O AC pede exatamente essa hierarquia de defesa.

### `AppError` — classes a usar (já existem, não criar novas)

`src/shared/errors/AppError.ts`: `NotFoundError(message, code)` → 404, `ForbiddenError(message)` → 403, `UnprocessableEntityError(message, code)` → 422. `handleHttpError` (`src/shared/http/handleHttpError.ts`) já mapeia essas classes para `{ error: { code, message } }` na rota — não precisa de tratamento adicional no `route.ts`.

### Composição do presenter — mesma receita do `cancel_proof_session_presenter.ts`

```ts
// review_proof_request_presenter.ts
import { Environments } from "@/shared/environments";
import { makeDeliverWebhookUseCase } from "@/modules/webhook/app/deliver_webhook_presenter";

export async function makeReviewProofRequestController() {
  const envs = Environments.getEnvs();
  const requestRepo = await envs.getProofRequestRepository();
  const deliverWebhook = await makeDeliverWebhookUseCase();
  return new ReviewProofRequestController(
    new ReviewProofRequestUseCase(requestRepo, deliverWebhook)
  );
}
```

### Rota HTTP — padrão idêntico ao GET existente

`app/api/proof-requests/[requestId]/route.ts` já existe (GET). O novo arquivo é `app/api/proof-requests/[requestId]/review/route.ts`:

```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ requestId: string }> }) {
  try {
    const companyId = req.headers.get("x-company-id")!;
    const { requestId } = await ctx.params;
    const body = await req.json();
    const controller = await makeReviewProofRequestController();
    const result = await controller.handle({ requestId, companyId, body });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
```

### ⚠️ Gap crítico no middleware — sem isso a rota fica sem autenticação de sessão

`src/shared/middleware.ts`, função `isSessionAuthApiRoute()` (linha ~22), hoje só libera `GET`:

```ts
function isSessionAuthApiRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/company-apps")) return true;
  if (pathname.startsWith("/api/companies")) return true;
  if (pathname.startsWith("/api/auth/sign-out")) return true;
  if (pathname.startsWith("/api/proof-requests") && method === "GET") return true;
  return false;
}
```

`POST /api/proof-requests` já tem uma regra própria mais acima no arquivo (linha ~72, aceita API key **ou** sessão — usada pelo endpoint B2B de criação). A nova rota `POST /api/proof-requests/{requestId}/review` **não** deve aceitar API key (é uma ação do dashboard, autenticada só por sessão) — não reusar aquele bloco. Adicionar uma regra dedicada em `isSessionAuthApiRoute`:

```ts
if (/^\/api\/proof-requests\/[^/]+\/review$/.test(pathname) && method === "POST") return true;
```

Sem esse ajuste, a requisição cai no fallback "passa sem autenticação" do middleware e `req.headers.get("x-company-id")` chega `null` na rota — o use case quebraria silenciosamente ou (pior) executaria sem isolamento por company. Este arquivo **não está na epics.md como arquivo a tocar** — é um achado desta análise, não pular.

### UI — reaproveitar `DisableConfirmDialog`, não instalar `AlertDialog`

Não existe `AlertDialog` do shadcn/ui neste repo (grep confirma zero uso em código de app, só em docs). O precedente real é um diálogo local hand-rolled: `DisableConfirmDialog` em `app/(dashboard)/apps/[appId]/page.tsx` (linhas ~90-174) — `role="dialog" aria-modal aria-labelledby`, fecha com Escape, foco automático no botão de confirmação, fecha ao clicar no backdrop, header (ícone + título + descrição) e footer (Cancelar + botão de ação com `Loader2` enquanto `loading`). Reaproveitar essa estrutura — um único componente parametrizado por `decision: "approve" | "reject"` (título/ícone/cor variam) é suficiente; não criar duas cópias quase idênticas nem adicionar `@radix-ui/react-alert-dialog` como dependência nova sem necessidade comprovada.

Cores dos botões (tokens já existentes em `app/globals.css`, nenhum token novo necessário):
- **Aprovar**: `bg-success text-success-foreground hover:bg-success/90` (`--color-success: #16A34A`, `--color-success-foreground: #FFFFFF` — hoje só usados em variantes `-bg`/`-text` de badge; este é o primeiro uso como botão sólido, mas os tokens já existem)
- **Reprovar**: `bg-destructive text-destructive-foreground hover:bg-destructive/90` (mesmo padrão do botão "Desabilitar" em `DisableConfirmDialog`)

Texto da confirmação (fonte: ux-design-specification.md): "Esta ação envia o webhook real para o app e não pode ser desfeita."

Handler no `page.tsx` segue o padrão já usado em `apps/[appId]/page.tsx` para `handleDisableConfirm`: `useState` para dialog aberto + loading, chama a store function em `try`, `toast.success`/`toast.error`, fecha o diálogo no `try`, reseta loading no `finally`. Ao suceder, atualizar `data` local com `{ ...data, status: result.status, updatedAt: result.updatedAt }` — evita um novo fetch completo da página.

### Client store — método novo em `utils/proof-requests-store.ts`

O arquivo já expõe `getProofRequest()` e o helper `asJson()` (trata erro `{ error: { message } }` → `Error`). Adicionar:

```ts
export async function reviewProofRequest(
  requestId: string,
  decision: "approve" | "reject"
): Promise<{ id: string; status: ProofRequestStatus; updatedAt: string }> {
  const res = await fetchWithAuth(`/api/proof-requests/${requestId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  return (await asJson(res)) as { id: string; status: ProofRequestStatus; updatedAt: string };
}
```

### Condição de visibilidade dos botões (client-side, espelha os guards do backend)

`app/(dashboard)/proof-requests/[requestId]/page.tsx` já tem `data.environment` e `data.status` disponíveis (vêm do `GET` existente, sem fetch adicional):

```ts
const canReview =
  data.environment === "homol" &&
  (data.status === "pending_user" || data.status === "processing");
```

A UI é só uma conveniência — o guard real é o backend (defesa em profundidade, AC #2/#3).

### Testes — padrão real do projeto (não `architecture.md`)

`architecture.md` diz "testes co-locados ao módulo", mas o padrão **real** e consistente em toda a Epic 7 é `tests/unit/story-{epic}-{num}/` com script `test:story:X.Y` dedicado. Seguir o padrão real (Stories 7.1/7.2/7.3), não o documento. A Story 7.3 é a referência mais próxima por também ter um guard de negócio: `.test.mjs` para inspeção estrutural (regex sobre o source) + `.dynamic.test.ts` (via `tsx --test`, `node:assert/strict`, fakes em memória implementando `ProofRequestRepository`/`DeliverWebhookUseCase`) para exercitar o comportamento real dos guards. Padrão de asserção de guard:

```ts
await assert.rejects(
  () => useCase.execute({ requestId, companyId, decision: "approve" }),
  (err) => {
    assert.ok(err instanceof ForbiddenError);
    assert.equal(err.statusCode, 403);
    return true;
  }
);
```

Script no `package.json` (mesmo formato de `"test:story:7.3"`):
```json
"test:story:7.5": "node --test \"tests/unit/story-7-5/*.test.mjs\" && tsx --test \"tests/unit/story-7-5/*.dynamic.test.ts\""
```

Nota: a Story 7.4 não criou testes dedicados (não há `test:story:7.4`/`tests/unit/story-7-4/`) — não seguir esse precedente aqui, pois 7.5 tem lógica de negócio real (guards) que a 7.4 (troca de asset/Select) não tinha. Seguir 7.3.

### Shape de erro real da API (diverge de `architecture.md`)

`architecture.md` diz `{ error: string }`; o código real (`handleHttpError.ts`) usa `{ error: { code: string, message: string } }`. `asJson()` em `proof-requests-store.ts` já lê `json.error?.message` — compatível. Seguir o código, não o doc.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/modules/proof-request/app/review_proof_request_viewmodel.ts` | CRIAR | `ReviewProofRequestSchema` (Zod) + `ReviewProofRequestOutputDTO` |
| `src/modules/proof-request/app/review_proof_request_usecase.ts` | CRIAR | `ReviewProofRequestUseCase` — guards 404/403/422, `updateStatus`, webhook fire-and-forget |
| `src/modules/proof-request/app/review_proof_request_controller.ts` | CRIAR | Parse do body, delega ao use case |
| `src/modules/proof-request/app/review_proof_request_presenter.ts` | CRIAR | `makeReviewProofRequestController()` |
| `app/api/proof-requests/[requestId]/review/route.ts` | CRIAR | `POST`, mesmo padrão do GET existente na pasta pai |
| `src/shared/middleware.ts` | MODIFICAR | Nova regra em `isSessionAuthApiRoute()` para `POST .../review` — **crítico, não previsto no epics.md** |
| `utils/proof-requests-store.ts` | MODIFICAR | `reviewProofRequest(requestId, decision)` |
| `app/(dashboard)/proof-requests/[requestId]/page.tsx` | MODIFICAR | Botões Aprovar/Reprovar + diálogo de confirmação (reaproveitando o padrão de `DisableConfirmDialog`) |
| `tests/unit/story-7-5/*.test.mjs` + `*.dynamic.test.ts` | CRIAR | Testes estruturais + comportamentais |
| `package.json` | MODIFICAR | Script `test:story:7.5` |

Arquivos a **checar mas provavelmente não tocar**: `app/api/proof-requests/[requestId]/route.ts` (GET existente, só referência de padrão), `src/shared/domain/entities/ProofRequest.ts` (sem métodos de transição de estado — a transição acontece via `updateStatus()` do repositório, não via mutador da entidade, ao contrário de `ProofSession.cancel()`).

### References

- [Epics: Story 7.5 AC](../../planning-artifacts/epics.md#story-75-review-manual-aprovarreprovar-em-apps-de-homologação)
- [UX spec: "#4 — Review manual"](../../planning-artifacts/ux-design-specification.md) (linha ~1115)
- [Story 7.4 (seletor de ambiente, precedente de `EnvBadge`/`environment`)](7-4-seletor-de-ambiente-na-criacao-de-app.md)
- [Story 7.3 (padrão de guard com `AppError` + testes estruturais/comportamentais)](7-3-allowlist-de-criacao-de-apps.md)
- [Story 7.2 (garante `updateStatus()` grava `updated_at`)](7-2-coluna-updated-at-e-gravacao-em-toda-transicao.md)
- [`CancelProofSessionUseCase` (padrão direto de guard + transição + webhook)](../../../../src/modules/proof-session/app/cancel_proof_session_usecase.ts)
- [`DeliverWebhookUseCase`](../../../../src/modules/webhook/app/deliver_webhook_usecase.ts)
- [`ProofRequestRepository` (interface, `findById`/`updateStatus`)](../../../../src/shared/domain/interfaces/repositories/ProofRequestRepository.ts)
- [`GetProofRequestUseCase` (padrão de 404 anti-enumeration)](../../../../src/modules/proof-request/app/get_proof_request_usecase.ts)
- [`AppError` (classes de erro existentes)](../../../../src/shared/errors/AppError.ts)
- [`handleHttpError`](../../../../src/shared/http/handleHttpError.ts)
- [`src/shared/middleware.ts` (gap crítico a corrigir)](../../../../src/shared/middleware.ts)
- [`DisableConfirmDialog` (padrão de diálogo a reaproveitar)](../../../../app/(dashboard)/apps/[appId]/page.tsx)
- [Página de detalhe atual](../../../../app/(dashboard)/proof-requests/[requestId]/page.tsx)
- [`utils/proof-requests-store.ts` (client store atual)](../../../../utils/proof-requests-store.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` (após cada task e no final) → limpo, zero erros em todas as execuções
- `npm run test:story:7.5` → 29/29 passando (16 testes estruturais em `.test.mjs`, 13 testes comportamentais em `.dynamic.test.ts` via `tsx --test`)
- `npm run test` (suíte completa) → 957/966 passando. As 9 falhas estão todas em `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` ("Patch #2/#3/#4 (real bash)", "STAGE derivado de AMPLIFY_BRANCH_NAME") — testes que exercitam scripts bash reais do pipeline Amplify da Story 11.8; `git status --short` confirma que esse arquivo não foi tocado por esta story, portanto são falhas pré-existentes de ambiente (não relacionadas a Story 7.5)
- `npm run lint` → 18 problemas (6 erros, 12 warnings) — mesma contagem documentada como baseline na Story 7.3 ("6 erros/12 warnings, mesma contagem pré-existente"). Nenhum erro/warning nos 7 arquivos criados e nos 4 arquivos modificados por esta story; o único erro reportado em um arquivo tocado (`app/(dashboard)/proof-requests/[requestId]/page.tsx:48:5`, `react-hooks/set-state-in-effect`) está no `useEffect` de carregamento original da página (linha não alterada por esta story — a story só adicionou código abaixo desse bloco)
- `grep -rn "DeliverWebhookUseCase\|deliver_webhook"` e leitura de `cancel_proof_session_usecase.ts`/`get_proof_request_usecase.ts` confirmaram o padrão exato de guard + webhook fire-and-forget a reaproveitar antes de escrever qualquer código

### Completion Notes List

- `ReviewProofRequestUseCase` criado espelhando `CancelProofSessionUseCase`: guard de ownership (404, anti-enumeration) → guard de ambiente (403, `ForbiddenError`) → guard de status terminal (422, `UnprocessableEntityError`) → `updateStatus()` → webhook fire-and-forget (`.catch()`, nunca `await`). `updateStatus()` já grava `updated_at = now()` na mesma operação (garantia da Story 7.2), sem trabalho adicional necessário.
- Guard de ambiente rejeita qualquer `environment !== "homol"`, incluindo o valor legado `"dev"` — não apenas `"prod"` — conforme a nota de defesa em profundidade do AC #2.
- **Gap crítico corrigido no middleware** (`src/shared/middleware.ts`): `isSessionAuthApiRoute()` só autenticava `GET /api/proof-requests*` por sessão. Adicionada regra dedicada para `POST /api/proof-requests/{id}/review` (regex `/^\/api\/proof-requests\/[^/]+\/review$/`), separada da regra existente de `POST /api/proof-requests` (que aceita API key OU sessão, usada pelo endpoint B2B de criação) — a rota de review é exclusivamente autenticada por sessão de dashboard, nunca por API key.
- UI: botões "Aprovar" (verde, `bg-success`/`text-success-foreground`) e "Reprovar" (`bg-destructive`, mesmo padrão do botão "Desabilitar" já existente) adicionados à área de ações do header do detalhe, condicionados a `data.environment === "homol" && (data.status === "pending_user" || data.status === "processing")`. Diálogo de confirmação (`ReviewConfirmDialog`) reaproveita a estrutura exata de `DisableConfirmDialog` (`app/(dashboard)/apps/[appId]/page.tsx`) — parametrizado por `decision: "approve" | "reject"` em vez de duplicar o componente. Nenhuma dependência nova adicionada (não existe `AlertDialog` do shadcn/ui neste repo).
- Ao concluir a review com sucesso, o estado local (`data.status`/`data.updatedAt`) é atualizado diretamente a partir da resposta do endpoint, sem um novo fetch completo da página.
- Testes seguem o padrão dual da Story 7.3: `.test.mjs` (inspeção estrutural via regex sobre o source, cobrindo a ordem dos guards, a rota, o middleware, o store e a página) + `.dynamic.test.ts` (comportamental via `tsx --test`, com fakes em memória de `ProofRequestRepository`/`DeliverWebhookUseCase` implementando as interfaces reais, seguindo o padrão de `verify-presentation-vc-jwt.dynamic.test.ts` da Story 9.2). Cobertura: as 4 transições (approve/reject × pending_user/processing), os dois valores rejeitados pelo guard de ambiente (`prod`/`dev`), os 3 status terminais no guard 422, os dois casos do guard 404 (not-found e company diferente), fire-and-forget do webhook (inclusive quando a entrega falha), e validação do body pelo controller (Zod).
- Nenhuma dependência nova instalada. Nenhum arquivo fora do escopo listado no Project Structure Notes da story foi alterado.
- Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, execução paralela) → Acceptance Auditor não encontrou violações de AC. 4 patches aplicados: regex do middleware tolerante a barra final, guard `!loading` no backdrop/Escape do diálogo de confirmação, mensagem de erro do guard de ambiente unificada em inglês, resync de `data`/`canReview` após erro no review (evita botões presos visíveis para uma request já terminal). 9 itens deferidos — em sua maioria limitações estruturais pré-existentes e replicadas de precedentes já shippados (`cancel_proof_session_usecase.ts`, `DisableConfirmDialog`, a rota GET irmã), não regressões introduzidas por esta story. 1 achado dispensado como falso positivo (export não utilizado do DTO, consistente com a convenção de todo `*_viewmodel.ts` do projeto). Reconfirmado após os patches: `npx tsc --noEmit` limpo, `npm run test:story:7.5` 29/29, `npm run lint` 18 problemas (mesma contagem, nenhum novo).

### File List

**Criados:**
- `src/modules/proof-request/app/review_proof_request_viewmodel.ts`
- `src/modules/proof-request/app/review_proof_request_usecase.ts`
- `src/modules/proof-request/app/review_proof_request_controller.ts`
- `src/modules/proof-request/app/review_proof_request_presenter.ts`
- `app/api/proof-requests/[requestId]/review/route.ts`
- `tests/unit/story-7-5/review-proof-request.dynamic.test.ts`
- `tests/unit/story-7-5/review-manual-em-apps-homologacao.test.mjs`

**Modificados:**
- `src/shared/middleware.ts` (nova regra de session-auth para `POST .../review`)
- `utils/proof-requests-store.ts` (`reviewProofRequest()`)
- `app/(dashboard)/proof-requests/[requestId]/page.tsx` (botões Aprovar/Reprovar, `ReviewConfirmDialog`, handler)
- `package.json` (script `test:story:7.5`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status da story)

## Change Log

- 2026-08-16: Story criada e implementada via bmad-story-pipeline. `ReviewProofRequestUseCase` transiciona proof_requests de apps `homol` em status não-terminal para `approved`/`rejected`, gravando `updated_at` e disparando o webhook real (fire-and-forget). Guards em profundidade: 404 (ownership, anti-enumeration), 403 (ambiente ≠ homol, incluindo `dev` legado), 422 (status já terminal). Corrigido gap crítico de autenticação no middleware — `POST /api/proof-requests/{id}/review` não tinha regra de session-auth. UI: botões Aprovar/Reprovar no header do detalhe com diálogo de confirmação reaproveitando o padrão de `DisableConfirmDialog`, feedback via `toast.success`/`toast.error`, atualização local do status sem refetch. 29 testes novos (16 estruturais + 13 comportamentais), 957/966 na suíte completa (9 falhas pré-existentes em `story-11-8`, não relacionadas). Lint e `tsc --noEmit` limpos nos arquivos tocados. Status → `review`.
- 2026-08-16: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, execução paralela). Acceptance Auditor: zero violações de AC. 4 patches aplicados: regex do middleware tolerante a barra final na rota de review, guard `!loading` no fechamento do diálogo via backdrop/Escape, mensagem de erro do guard de ambiente unificada em inglês (era mista PT/EN), resync de `data` após erro no review para evitar botões presos numa request já terminal. 9 itens deferidos para `deferred-work.md` (majoritariamente limitações estruturais pré-existentes replicadas de precedentes do projeto — `cancel_proof_session_usecase.ts`, `DisableConfirmDialog`, a rota GET irmã — não regressões desta story). 1 achado dispensado como falso positivo. Reconfirmado: `tsc --noEmit` limpo, 29/29 testes de story, lint sem novos problemas. Status → `test`.
