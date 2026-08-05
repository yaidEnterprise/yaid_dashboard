# Story 8.2: Topbar Dinâmica Integrada à Company Logada

> ?? **Referência UX:** [`ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) — UX-DR2 e seção "#2 — Topbar dinâmica" (nome real via `GET /api/companies/me`, avatar com inicial dinâmica + `aria-label`, `Skeleton` no load, sem badge global de ambiente).

## User Story

Como empresa parceira logada,
Quero ver meu nome real e avatar na topbar,
Para que o dashboard reflita quem está logado em vez de um placeholder de demonstração.

## Acceptance Criteria

**AC #1 — Dados reais da company:**
**Given** a topbar (`app-topbar.tsx`) de um usuário autenticado
**When** a topbar carrega
**Then** consome `GET /api/companies/me` e exibe o nome real da company + avatar com inicial dinâmica derivada desse nome

**AC #2 — Skeleton durante carregamento:**
**Given** a chamada `GET /api/companies/me` ainda em andamento
**When** a topbar renderiza
**Then** exibe `Skeleton` no lugar do nome e do avatar — nunca um nome placeholder
**And** em erro de carregamento, mantém um avatar neutro e não bloqueia a navegação

**AC #3 — Acessibilidade do avatar:**
**Given** o avatar dinâmico
**When** revisado para acessibilidade
**Then** possui `aria-label` com o nome real da company (o texto da inicial não basta para leitor de tela)

**AC #4 — Remoção de hardcodes e EnvBadge:**
**Given** a topbar após esta story
**When** revisada
**Then** os valores hardcoded ("Acme Identidade Ltda.", "Maria R."/"MR") e o badge global "Homologação"/`EnvBadge` foram removidos — o ambiente é atributo do app, não da sessão

## Dev Notes

- O endpoint `GET /api/companies/me` já existe: `app/api/companies/me/route.ts`
- Retorna `{ id, name, cnpj, status, createdAt }` via `GetMyCompanyUseCase`
- A autenticação é gerenciada pelo middleware — o fetch client-side herda a sessão via cookie
- Usar `fetchWithAuth` de `utils/fetch-with-auth.ts` para o fetch (garante redirect em 401)
- Padrão de Skeleton: `animate-pulse rounded-md bg-surface-muted` (ver `components/shared/list-skeleton.tsx`)
- **Mudança puramente de UI** — nenhum arquivo de backend é alterado

## Files Changed

- `components/layout/app-topbar.tsx` — reescrito (único arquivo de produção alterado)
- `tests/unit/story-8-2/topbar-dynamic.test.mjs` — novo arquivo de testes
- `package.json` — adicionado script `test:story:8.2`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status atualizado

## Status

done
