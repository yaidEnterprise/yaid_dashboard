---
storyId: 2-3
title: Detalhe e Edição de App
epic: 2
status: done
completedAt: '2026-07-15'
---

# Story 2.3: Detalhe e Edição de App

> 📋 **Referência UX:** `ux-design-specification.md` — seções "Form Patterns" (cards editáveis por contexto, botões Salvar/Cancelar), "Modal Patterns" (AlertDialog para desabilitar app — ação com impacto assimétrico, confirmação seletiva), "Component Strategy" (`CopyButton` para app_id) e "Feedback Patterns" (toast de sucesso/erro sem resetar os campos).

Como empresa parceira,
Quero visualizar os detalhes de um app, editar suas informações e controlar seu status,
Para que eu mantenha minha integração atualizada e possa desabilitar um app comprometido com segurança.

## Acceptance Criteria

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

## Tasks / Subtasks

- [x] Task 1: Reescrever `app/(dashboard)/apps/[appId]/page.tsx` satisfazendo todos os ACs
  - [x] Card "Identificação" — `useForm` + `zodResolver`, campo nome editável, botões Salvar/Cancelar, toast sucesso/erro
  - [x] Card "Webhook" — `useForm` + `zodResolver`, campo webhookUrl opcional editável, botões Salvar/Cancelar, toast sucesso/erro
  - [x] Card "Chave da API" — apenas `app.appId` com `CopyButton` (nunca o secret)
  - [x] Toggle de status: desabilitar → AlertDialog de confirmação; reabilitar → PATCH direto
  - [x] Estado loading com skeleton, estado erro com mensagem e botão voltar

- [x] Task 2: Verificar backend (AC: #1, #2, #5) — sem mudanças necessárias
  - [x] `GET /api/company-apps/{appId}` retorna 404 para app de outra company (ForbiddenError → 404 via handleHttpError)
  - [x] `PATCH /api/company-apps/{appId}` aceita name, webhookUrl, status parcialmente
  - [x] Isolamento por companyId verificado no use case

- [x] Task 3: Criar testes unitários `tests/unit/story-2-3/detalhe-de-app.test.mjs`
  - [x] Contrato backend: GET e PATCH exportados na route, use case valida companyId
  - [x] Contrato frontend: page usa useForm/zodResolver, tem AlertDialog, usa CopyButton, usa updateApp

- [x] Task 4: Rodar testes e build
  - [x] 29/29 testes passando
  - [x] `node node_modules/typescript/bin/tsc --noEmit` — TypeScript limpo

## Dev Notes

### Análise do Estado Atual

**Backend — já implementado (sem mudanças necessárias):**

- `app/api/company-apps/[appId]/route.ts` — exporta GET e PATCH
- `GetCompanyAppUseCase` — valida `app.companyId !== input.companyId` → ForbiddenError → 404 via handleHttpError
- `UpdateCompanyAppUseCase` — aceita parcialmente name, webhookUrl, status
- `UpdateCompanyAppSchema` (Zod) — name, webhookUrl opcionais mas pelo menos um obrigatório

**Frontend — `app/(dashboard)/apps/[appId]/page.tsx` precisa de refatoração completa:**

Atual:
- ✅ Carrega via `getApp(appId)` — AC #1 parcialmente OK
- ❌ Cards não são editáveis — usa apenas display estático
- ❌ Toggle de status sem confirmação dialog — AC #3 falha
- ❌ Webhook hardcoded como `app.webhookUrl` sem edição — AC #2 falha
- ❌ Card "Chave da API" não usa `CopyButton` — minor
- ❌ Usa `app.id` onde deveria usar `app.appId` (same value but semantically wrong)

### Padrão de Form Editável (card com RHF+Zod)

```tsx
// Identificação card
const identSchema = z.object({
  name: z.string().min(1, "Informe o nome do app").max(50, "Máximo de 50 caracteres"),
});
type IdentValues = z.infer<typeof identSchema>;

function IdentCard({ app, onSaved }: { app: YaidApp; onSaved: (updated: YaidApp) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<IdentValues>({
    resolver: zodResolver(identSchema),
    defaultValues: { name: app.name },
  });

  const onSubmit = async (values: IdentValues) => {
    try {
      const updated = await updateApp(app.id, { name: values.name.trim() });
      onSaved(updated);
      toast.success("Nome atualizado");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao salvar");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="...">
      {/* name input + save/cancel buttons */}
      <button type="submit" disabled={!isDirty || isSubmitting}>Salvar</button>
    </form>
  );
}
```

### Padrão de AlertDialog (baseado no LogoutConfirmDialog de settings/page.tsx)

```tsx
function DisableConfirmDialog({
  open, onCancel, onConfirm, loading,
}: { open: boolean; onCancel: () => void; onConfirm: () => void; loading: boolean }) {
  // Mesmo padrão de settings/page.tsx — ESC fecha (cancelar)
  // role="dialog", aria-modal="true", focus trap no botão de confirmação
}
```

### Status no projeto: `"enabled"` / `"disabled"`

A Story 2.3 no epics menciona `{ status: "active" }` para reabilitar, mas o domínio usa `"enabled"`. O UpdateCompanyAppSchema aceita `z.enum(["enabled", "disabled"])`. Usar `"enabled"` para reabilitar.

### Convenções do Projeto

- `fetchWithAuth` via `utils/apps-store.ts` (já tem `getApp` e `updateApp`)
- Toast: `toast.success()` / `toast.error()` de `sonner`
- `StatusBadge` de `@/components/feedback/status-badge` — suporta `enabled`/`disabled`
- `CopyButton` de `@/components/shared/copy-button`
- Dialog: inline como em `app/(dashboard)/settings/page.tsx` (sem biblioteca externa)
- Skeleton: `animate-pulse rounded bg-surface-muted`
- CSS variables: `text-text-primary`, `bg-surface`, `border-border`, etc.

### References

- [Epics: Story 2.3 AC](../../planning-artifacts/epics.md#story-23-detalhe-e-edição-de-app)
- [Frontend: app/(dashboard)/apps/[appId]/page.tsx](../../../../app/(dashboard)/apps/[appId]/page.tsx)
- [Backend: app/api/company-apps/[appId]/route.ts](../../../../app/api/company-apps/[appId]/route.ts)
- [GetCompanyAppUseCase](../../../../src/modules/company-app/app/get_company_app_usecase.ts)
- [UpdateCompanyAppUseCase](../../../../src/modules/company-app/app/update_company_app_usecase.ts)
- [CopyButton](../../../../components/shared/copy-button.tsx)
- [settings/page.tsx (LogoutConfirmDialog pattern)](../../../../app/(dashboard)/settings/page.tsx)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6-thinking

### Debug Log References

### Completion Notes List

- `app/(dashboard)/apps/[appId]/page.tsx` reescrito por completo:
  - Card "Identificação" editavel: RHF+Zod, campo nome, Salvar (desabilitado até `isDirty`), Cancelar — AC #2
  - Card "Webhook" editável: RHF+Zod, campo webhookUrl opcional com validação HTTPS, Salvar/Cancelar — AC #2
  - Card "Chave da API": apenas `app.appId` (= `app.id`) com `CopyButton` — AC #1 (secret nunca exibido)
  - Toggle de status: para `enabled → disabled` abre `DisableConfirmDialog` com aviso de impacto; para `disabled → enabled` PATCH direto sem dialog — AC #3 e #4
  - Skeleton de loading com `animate-pulse`; estado de erro com "App não encontrado" e link de retorno
- Backend já estava correto: GET e PATCH em `app/api/company-apps/[appId]/route.ts`, isolamento por `companyId` nos use cases, ForbiddenError mapeado para 404 via `handleHttpError` — AC #5
- 29 testes criados, todos passando; TypeScript sem erros

### File List

**Criados:**
- `_bmad-output/implementation-artifacts/stories/2-3-detalhe-de-app.md`
- `tests/unit/story-2-3/detalhe-de-app.test.mjs`

**Modificados:**
- `app/(dashboard)/apps/[appId]/page.tsx`

**Não alterados (verificados apenas):**
- `app/api/company-apps/[appId]/route.ts`
- `src/modules/company-app/app/get_company_app_usecase.ts`
- `src/modules/company-app/app/update_company_app_usecase.ts`
- `utils/apps-store.ts`

## Change Log

- 2026-07-15: Story criada via bmad-story-pipeline.
