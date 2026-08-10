---
storyId: 2-2
title: Criação de App com API Key One-Shot
epic: 2
status: done
startedAt: '2026-06-05'
---

# Story 2.2: Criação de App com API Key One-Shot

> 📋 **Referência UX:** `ux-design-specification.md` — seções "Component Strategy" (`ApiKeyModal`, `CopyButton`), "Form Patterns" (cards Identificação + Webhook), "Modal Patterns" (ApiKeyModal bloqueante), "Feedback Patterns" (botão disabled, toast após fechar modal).

Como empresa parceira,
Quero criar uma nova aplicação e receber a API key em uma exibição única e segura,
Para que eu possa integrar meu sistema com a YaID sem risco de exposição inadvertida do secret.

## Acceptance Criteria

**Given** a página `/(dashboard)/apps/new` com formulário de criação
**When** a página carrega
**Then** exibe dois cards: "Identificação" (campo nome, obrigatório) e "Webhook" (campo webhook_url, opcional), mais sidebar institucional com informações sobre API keys

**Given** o formulário preenchido com nome válido
**When** o usuário clica em "Criar app"
**Then** o botão fica `disabled` durante o envio
**And** `POST /api/company-apps` é chamado com `{ name, webhookUrl }`
**And** o backend gera `app_id` e `secret` aleatórios, persiste apenas `SHA-256("<app_id>.<secret>")` como `api_key_hash`, nunca o secret
**And** a resposta inclui `{ appId, apiKey: "<app_id>.<secret>", ... }` — única vez que `apiKey` é retornado

**Given** a resposta de sucesso da criação
**When** o frontend recebe `apiKey`
**Then** um modal bloqueante é exibido com:
  - A API key completa em fonte monospace, selecionável e com botão de copiar
  - Aviso em destaque amarelo: "Esta é a única vez que a API key será exibida"
  - Checkbox obrigatório: "Confirmo que copiei minha API key"
  - Botão "Concluir" desabilitado até o checkbox ser marcado
**And** ESC não fecha o modal
**And** clique fora do modal não fecha o modal

**Given** o checkbox marcado e botão "Concluir" clicado
**When** o modal é fechado
**Then** o usuário é redirecionado para `/(dashboard)/apps`

**Given** o formulário com nome vazio ou inválido
**When** o usuário tenta submeter
**Then** erros de validação inline são exibidos pelo React Hook Form + Zod sem chamada à API

## Tasks / Subtasks

- [x] Task 1 — Corrigir backend de criação (AC: #2)
  - [x] Adicionar `appId` (TEXT público) à entidade `CompanyApp` e ao `CompanyAppMapper`
  - [x] Gerar `app_id` e `secret` aleatórios; hash `SHA-256("<app_id>.<secret>")`; retornar `appId` + `apiKey` one-shot
  - [x] Tornar `webhookUrl` opcional no schema Zod; `environment` default `"dev"` quando omitido
  - [x] Ajustar `CreateProofRequestUseCase` para verificar hash com `"<app_id>.<secret>"` (compatibilidade B2B)
- [x] Task 2 — Componentes reutilizáveis (AC: #3)
  - [x] Criar `components/shared/copy-button.tsx`
  - [x] Criar `components/apps/api-key-modal.tsx` (bloqueante, focus trap, sem ESC/clique-fora)
- [x] Task 3 — Página de criação (AC: #1, #3, #4, #5)
  - [x] Reescrever `app/(dashboard)/apps/new/page.tsx` com React Hook Form + Zod
  - [x] Dois cards (Identificação + Webhook opcional) + sidebar institucional
  - [x] Integrar `ApiKeyModal`; toast de sucesso ao concluir; redirect `/apps`
- [x] Task 4 — Client store (AC: #2)
  - [x] Atualizar `utils/apps-store.ts` — `CreateAppInput` sem `environment` obrigatório; tipo de resposta com `appId`

## Dev Notes

### Estado atual (brownfield)

- `app/(dashboard)/apps/new/page.tsx` já existe com modal inline, mas:
  - Usa `useState` em vez de RHF + Zod
  - Tem card "Ambiente" extra (fora do escopo desta story)
  - Webhook é obrigatório (deve ser opcional)
  - Modal não é componente extraído (`ApiKeyModal`)
- Backend `CreateCompanyAppUseCase` gera UUID como parte da API key e **não persiste `app_id`** — bug crítico que quebra auth B2B (`findByAppId` na Story 3.1)
- `CompanyAppMapper.toPersistence` omite `app_id` apesar do tipo `CompanyAppPersistence` tê-lo

### Padrões a seguir

- Formulários: `react-hook-form` + `zodResolver` — ver `app/(dashboard)/settings/page.tsx`, `app/sign-up/page.tsx`
- Erros inline: `text-sm text-red-600` abaixo do campo; toast só para erros de API
- API client: `fetchWithAuth` via `utils/apps-store.ts`
- Backend: camadas `viewmodel → controller → usecase → repository` em `src/modules/company-app/app/`

### Arquivos principais

| Ação | Arquivo |
|------|---------|
| UPDATE | `src/shared/domain/entities/CompanyApp.ts` |
| UPDATE | `src/shared/infra/dto/CompanyAppMapper.ts` |
| UPDATE | `src/modules/company-app/app/create_company_app_viewmodel.ts` |
| UPDATE | `src/modules/company-app/app/create_company_app_usecase.ts` |
| UPDATE | `src/modules/proof-request/app/create_proof_request_usecase.ts` |
| NEW | `components/shared/copy-button.tsx` |
| NEW | `components/apps/api-key-modal.tsx` |
| UPDATE | `app/(dashboard)/apps/new/page.tsx` |
| UPDATE | `utils/apps-store.ts` |

### Geração de app_id

```typescript
function generateAppId() {
  return randomBytes(12).toString("base64url"); // ex: "xK9mP2nQ4rTv"
}
```

### Hash da API key

```typescript
const apiKey = `${appId}.${secret}`;
const apiKeyHash = await this.hasher.hash(apiKey);
```

### Schema frontend (Zod)

```typescript
const createAppSchema = z.object({
  name: z.string().min(1, "Informe o nome do app").max(50),
  webhookUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https:\/\//i.test(v), "O webhook deve começar com https://"),
});
```

### Testing

- Testes unitários do use case de criação: formato apiKey, app_id persistido, hash não contém secret
- Testes estruturais do `ApiKeyModal`: ESC bloqueado, checkbox obrigatório

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#company_apps]
- [Source: _bmad-output/implementation-artifacts/stories/3-1-endpoint-b2b-criacao-de-proof-request.md — findByAppId]

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking

### Debug Log References

### Completion Notes List

- Corrigido bug crítico: `app_id` TEXT não era persistido — quebrava auth B2B (Story 3.1)
- Backend agora gera `appId` público + `secret`, hash SHA-256 da string completa `appId.secret`
- Página reescrita com RHF+Zod; card Ambiente removido; webhook opcional
- Componentes `CopyButton` e `ApiKeyModal` extraídos conforme UX spec
- 20 testes de contrato adicionados em `tests/unit/story-2-2/`

### File List

- src/shared/domain/entities/CompanyApp.ts
- src/shared/infra/dto/CompanyAppMapper.ts
- src/modules/company-app/app/create_company_app_viewmodel.ts
- src/modules/company-app/app/create_company_app_usecase.ts
- src/modules/company-app/app/list_company_apps_viewmodel.ts
- src/modules/company-app/app/list_company_apps_usecase.ts
- src/modules/company-app/app/get_company_app_viewmodel.ts
- src/modules/company-app/app/get_company_app_usecase.ts
- src/modules/company-app/app/update_company_app_viewmodel.ts
- src/modules/company-app/app/update_company_app_usecase.ts
- src/modules/proof-request/app/create_proof_request_usecase.ts
- components/shared/copy-button.tsx
- components/apps/api-key-modal.tsx
- app/(dashboard)/apps/new/page.tsx
- utils/apps-store.ts
- tests/unit/story-2-2/create-company-app.test.mjs
- package.json
