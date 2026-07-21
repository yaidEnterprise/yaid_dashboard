# Story 3.5: Overview do Dashboard

Status: done

> 📋 **Referência UX:** `ux-design-specification.md` — seções "Design Opportunities" (card "próximo passo" como onboarding progressivo), "Empty States" (estado inicial guia a próxima ação), "Privacy Pattern" (aviso institucional de privacidade) e "Experience Mechanics" (jornada "Do cadastro à API key em mãos").

## Story

Como empresa parceira autenticada,
Quero ver uma página inicial informativa ao acessar o dashboard,
Para que eu saiba o próximo passo recomendado na minha jornada de integração com a YaID.

## Acceptance Criteria

1. **Given** a página `/(dashboard)` (overview) para um usuário autenticado
   **When** a página carrega
   **Then** exibe um aviso institucional de privacidade da YaID (conteúdo estático)
   **And** exibe um card "Próximo passo recomendado" com conteúdo adaptativo baseado no estado da company

2. **Given** uma company sem nenhum app cadastrado
   **When** o card de próximo passo renderiza
   **Then** exibe orientação para criar o primeiro app com CTA para `/apps/new`

3. **Given** uma company com apps mas sem proof_requests
   **When** o card de próximo passo renderiza
   **Then** exibe orientação para criar a primeira proof_request com exemplo de chamada à API

4. **Given** uma company com apps e proof_requests
   **When** o card de próximo passo renderiza
   **Then** exibe orientação sobre como verificar o status das validações ou configurar webhook
   **And** nenhum dado mockado é exibido — todas as informações vêm de `GET /api/companies/me` e `GET /api/company-apps`

5. **Given** a página de overview enquanto os dados carregam
   **When** os requests ainda não completaram
   **Then** um estado de loading é exibido (skeleton)

6. **Given** a página de overview quando a API retorna erro
   **When** o request falha
   **Then** uma mensagem de erro é exibida com opção de tentar novamente

## Tasks / Subtasks

- [ ] Task 1: Reescrever `app/(dashboard)/page.tsx` para buscar dados reais (AC: #1–#6)
  - [ ] Remover dados hardcoded (`recentRequests`, apps ativos mock, métricas mock)
  - [ ] Implementar fetch paralelo de `GET /api/companies/me` (via `fetchWithAuth`) e `GET /api/company-apps` (via `listApps()`) e `GET /api/proof-requests` (via `listProofRequests()`)
  - [ ] Implementar estados: loading, error, data
  - [ ] Renderizar skeleton durante carregamento (reutilizar `MetricCardsSkeleton` + skeletons customizados)
  - [ ] Renderizar alert de erro com botão "Tentar novamente"

- [ ] Task 2: Implementar card "Próximo passo recomendado" adaptativo (AC: #1–#4)
  - [ ] Derivar estado da company: sem apps → CTA criar app; com apps sem proof_requests → CTA criar proof_request via API; com ambos → CTA verificar status / configurar webhook
  - [ ] Card com ícone `Sparkles`, label "Próximo passo recomendado", título e descrição contextuais, CTA com `Link`

- [ ] Task 3: Implementar métricas reais com `MetricCard` (AC: #4)
  - [ ] Calcular contagens de `proof_requests` usando `countByStatus()` do store
  - [ ] Renderizar 4 `MetricCard` (Total, Aprovadas, Pendentes, Rejeitadas) com valores reais
  - [ ] Sem trends no MVP (não há histórico de 30 dias) — remover dados de trend mock

- [ ] Task 4: Implementar card "Apps ativos" com dados reais (AC: #4)
  - [ ] Contar apps do resultado de `listApps()`
  - [ ] Listar nomes dos apps com `EnvBadge`
  - [ ] Link "Gerenciar apps" para `/apps`

- [ ] Task 5: Implementar tabela "Solicitações recentes" com dados reais (AC: #4)
  - [ ] Usar `listProofRequests()` e exibir as 5 mais recentes (ordenadas por `createdAt` desc)
  - [ ] Colunas: ID (InlineCode truncado), proof_type, status (StatusBadge), criada (tempo relativo)
  - [ ] Link "Ver todas" para `/proof-requests`
  - [ ] Se não houver proof_requests, ocultar a seção inteira

- [ ] Task 6: Manter aviso institucional de privacidade (AC: #1)
  - [ ] Preservar o card estático de privacidade existente (ícone `KeyRound` + texto)

- [ ] Task 7: Validar build e testes (AC: todos)
  - [ ] `npm run build` sem erros TypeScript
  - [ ] Criar testes unitários em `tests/unit/story-3-5/`

## Dev Notes

### Estado atual da implementação (análise pré-story)

**O que já existe e funciona:**
- `GET /api/companies/me` em `app/api/companies/me/route.ts` — retorna `{ id, name, cnpj, status, createdAt }`
- `GET /api/company-apps` em `app/api/company-apps/route.ts` — retorna `{ items: YaidApp[] }`
- `GET /api/proof-requests` em `app/api/proof-requests/route.ts` — retorna `{ items: ProofRequestDetail[] }`
- `listApps()` em `utils/apps-store.ts` — wrapper client-side
- `listProofRequests()` e `countByStatus()` em `utils/proof-requests-store.ts` — wrapper + helper
- `MetricCard` em `components/yaid/metric-card.tsx`
- `MetricCardsSkeleton` em `components/shared/list-skeleton.tsx`
- `StatusBadge` em `components/feedback/status-badge.tsx`
- `EnvBadge` em `components/feedback/environment-badge.tsx`
- `InlineCode` em `components/api/code-block.tsx`
- `PageHeader` em `components/layout/page-header.tsx`
- `fetchWithAuth` em `utils/fetch-with-auth.ts`

**O que precisa ser substituído:**
- `app/(dashboard)/page.tsx` usa **dados 100% mock** — métricas hardcoded ("2.847", "+12,4%"), apps ativos hardcoded, solicitações recentes hardcoded
- Trends nos MetricCards ("+12,4%", "+8,1%", etc.) — sem dados históricos no MVP, remover
- Card "Próximo passo" é estático ("Configure o webhook") — tornar adaptativo

### Shape da API (GET /api/companies/me)

```typescript
// Resposta 200
{
  id: string;
  name: string;
  cnpj: string | null;
  status: "active" | "inactive";
  createdAt: string; // ISO 8601
}
```

### Lógica do card "Próximo passo recomendado"

```typescript
function getNextStep(apps: YaidApp[], proofRequests: ProofRequestDetail[]) {
  if (apps.length === 0) {
    return {
      title: "Crie seu primeiro aplicativo",
      description: "Para começar a usar a YaID, cadastre um app e receba sua API key para integração.",
      ctaLabel: "Criar aplicativo",
      ctaHref: "/apps/new",
    };
  }
  if (proofRequests.length === 0) {
    return {
      title: "Crie sua primeira solicitação de verificação",
      description: "Use sua API key para criar uma proof request via POST /api/proof-requests e validar a identidade dos seus usuários.",
      ctaLabel: "Ver documentação da API",
      ctaHref: "/proof-requests",
    };
  }
  return {
    title: "Acompanhe suas validações",
    description: "Verifique o status das suas solicitações de verificação. Configure webhooks para receber notificações em tempo real.",
    ctaLabel: "Ver solicitações",
    ctaHref: "/proof-requests",
  };
}
```

### Tempo relativo para "Solicitações recentes"

Usar cálculo simples client-side:
```typescript
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}
```

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `app/(dashboard)/page.tsx` | MODIFICAR | Substituir mock por dados reais de 3 APIs |

**NÃO alterar:**
- Nenhum backend — todos os endpoints já existem
- Nenhum componente reutilizável — todos já existem
- Nenhum store — `apps-store.ts` e `proof-requests-store.ts` já cobrem

### Previous Story Intelligence (3.3)

- `listProofRequests()` retorna `ProofRequestDetail[]` com `appName`, `environment`, `proofType`, `status`, `createdAt`
- `countByStatus()` retorna `{ total, approved, pending, rejected }`
- Padrão de fetch: `useEffect` + `useState` (loading/error/data)
- Padrão de erro: `try/catch`, mensagem via `error.message`

### Convenções do projeto

- Path aliases: `@/components/*`, `@/utils/*`
- Client components: `"use client"` nas páginas com fetch
- PT-BR para labels de UI
- `npm run build` antes de marcar done

### References

- [Epics: Story 3.5](_bmad-output/planning-artifacts/epics.md#story-35-overview-do-dashboard)
- [UX: Design Opportunities, Empty States, Privacy Pattern](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Apps store](utils/apps-store.ts)
- [Proof requests store](utils/proof-requests-store.ts)
- [MetricCard](components/yaid/metric-card.tsx)
- [Settings page — padrão de fetch](app/(dashboard)/settings/page.tsx)
