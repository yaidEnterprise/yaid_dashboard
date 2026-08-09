# Story 7.4: Seletor de Ambiente na Criação de App + EnvBadge

Status: done

## Story

Como empresa parceira,
Quero escolher o ambiente (homologação/produção) ao criar um app,
Para que apps de teste fiquem claramente separados dos de produção e o comportamento de review seja inequívoco.

## Acceptance Criteria

1. **Given** a página `/(dashboard)/apps/new`
   **When** o formulário é renderizado
   **Then** o card *Identificação* contém um `Select` de ambiente com opções "Homologação" e "Produção", validado por Zod `z.enum(["homol","prod"])`, default seguro **`homol`**
   **And** há texto auxiliar abaixo do label: "Apps de homologação permitem aprovar/reprovar verificações manualmente para teste. Produção não."

2. **Given** o formulário submetido
   **When** `POST /api/company-apps` é chamado
   **Then** o campo `environment` é enviado e persistido (a coluna `company_apps.environment` já existe; o default do schema de criação passa de `dev` para escolha explícita com fallback `homol`)

3. **Given** as telas `/(dashboard)/apps` (tabela) e `/(dashboard)/apps/[appId]` (detalhe)
   **When** um app é exibido
   **Then** um `EnvBadge` (âmbar para Homologação, azul para Produção, sempre acompanhado de texto) aparece ao lado do `StatusBadge`
   **And** o ambiente não é editável após a criação no MVP

## Implementation Notes

### Files Changed

- `app/globals.css` — Cores do `EnvBadge` corrigidas: `env-sandbox-*` → âmbar (`#FFFBEB`/`#92400E`/`#FCD34D`) e `env-prod-*` → azul (`#EFF6FF`/`#1D4ED8`/`#BFDBFE`), alinhando com UX-DR3.

- `app/(dashboard)/apps/new/page.tsx` — Adicionado campo `environment` (Select nativo) no card Identificação com Zod `z.enum(["homol","prod"])` e `defaultValues: { environment: "homol" }`. Campo `environment` é passado ao `createApp()`.

- `utils/apps-store.ts` — `CreateAppInput` recebe campo opcional `environment?: "homol" | "prod"`.

- `src/modules/company-app/app/create_company_app_viewmodel.ts` — Default do `environment` no `CreateCompanyAppSchema` alterado de `"dev"` para `"homol"`.

- `app/(dashboard)/apps/page.tsx` — Importa `EnvBadge` e exibe ao lado do `StatusBadge` na coluna "Status / Ambiente" da tabela. Apps com `environment === "dev"` (legados) não exibem badge.

- `app/(dashboard)/apps/[appId]/page.tsx` — Importa `EnvBadge` e exibe ao lado do `StatusBadge` no header do detalhe do app (tamanho `md`). Ambiente é somente-leitura.

- `components/feedback/environment-badge.tsx` — Sem mudança de lógica; cores atualizadas via CSS.

### Pre-existing TypeScript Warnings

Os erros `TS7016` de `lucide-react` são pré-existentes em toda a codebase e não foram introduzidos por esta story. O Next.js compila sem erros em desenvolvimento (usando o compilador SWC que não verifica `@types`).
