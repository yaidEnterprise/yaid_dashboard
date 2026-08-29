# Story 13.2: Página Pública "/" — Landing Institucional

Status: review

## Story

Como visitante anônimo (empresa parceira em potencial),
Quero encontrar uma página institucional ao acessar o domínio da YaID,
Para que eu entenda o que é a plataforma e como criar uma conta antes de precisar fazer login.

## Acceptance Criteria

1. **Given** a rota `/` em um novo `app/page.tsx`, fora de qualquer route group e usando apenas o layout global, **when** acessada sem autenticação, **then** a página carrega normalmente sem sidebar ou topbar do dashboard.
2. A landing apresenta um hero com proposta de valor, uma seção "Como funciona" com 3–4 passos do fluxo de verificação em alto nível, CTA principal para `/sign-up` e link secundário para `/docs`.
3. **Given** um usuário com sessão autenticada, **when** acessa `/`, **then** o middleware o redireciona para `/dashboard` e a landing não é exibida.
4. **Given** a landing page, **when** renderizada em mobile e desktop, **then** preserva a identidade visual das páginas públicas: marca YaID, tipografia e paleta existentes.

## Tasks / Subtasks

- [x] Gate obrigatório — confirmar conclusão da Story 13.1 (AC: #1, #3)
  - [x] Confirmar que o Overview atual está em `app/(dashboard)/dashboard/page.tsx` e que não existe mais `app/(dashboard)/page.tsx` servindo `/`.
  - [x] Confirmar que `/` é pública para visitantes e redireciona usuários autenticados para `/dashboard` em `src/shared/middleware.ts`.
  - [x] **HALT se a 13.1 não estiver concluída:** `app/page.tsx` e `app/(dashboard)/page.tsx` resolveriam para a mesma rota `/`.
- [x] Criar a landing estática em `app/page.tsx` (AC: #1, #2, #4)
  - [x] Usar Server Component; não adicionar `"use client"`, estado, fetch, API, provider ou dependência.
  - [x] Criar header público compacto com a marca oficial (`/yaid_icon.svg`) e acesso secundário a `/sign-in`.
  - [x] Criar hero com proposta clara para empresas parceiras e CTA principal para `/sign-up`.
  - [x] Criar a sequência "Como funciona" em 3–4 passos, sem expor DID, VC, VP, blockchain ou detalhes de implementação.
  - [x] Adicionar link secundário para `/docs`; a ausência temporária do Epic 12 não bloqueia esta story.
  - [x] Incluir mensagem explícita de privacidade: a empresa recebe o resultado da validação, não documentos brutos ou dados pessoais do titular.
  - [x] Criar footer simples com marca e links existentes; não inventar páginas legais ou rotas novas.
- [x] Garantir qualidade visual e acessibilidade (AC: #4)
  - [x] Implementar mobile-first com Tailwind CSS 4 e tokens existentes em `app/globals.css`.
  - [x] Usar estrutura semântica (`header`, `nav`, `main`, `section`, `footer`), uma hierarquia única de `h1` e labels acessíveis.
  - [x] Garantir foco de teclado visível, contraste adequado e efeitos opcionais respeitando `prefers-reduced-motion`.
  - [x] Reutilizar `next/image`, `next/link`, `lucide-react` e assets existentes; não criar abstrações ou componentes de uso único sem necessidade.
- [x] Adicionar testes da Story 13.2 (AC: #1–#4)
  - [x] Validar por contrato que `app/page.tsx` existe fora do route group, não inclui o layout do dashboard e contém links para `/sign-up` e `/docs`.
  - [x] Validar conteúdo essencial, marca oficial e seção "Como funciona".
  - [x] Cobrir a regra de redirect autenticado em `/` após a 13.1.
  - [x] Executar testes da story, suíte completa, lint e build/typecheck.

## Dev Notes

### Gate de dependência

- A Story 13.2 é desbloqueada exclusivamente pela 13.1. O estado observado em 2026-08-28 ainda tem `epic-13`, 13.1 e 13.2 em `backlog`, mantém `app/(dashboard)/page.tsx` e não possui `app/(dashboard)/dashboard/page.tsx`.
- Route groups do App Router não participam da URL. Portanto, criar `app/page.tsx` antes de mover `app/(dashboard)/page.tsx` produz duas páginas para `/`; não tente contornar isso com rewrite, feature flag, layout condicional ou nova rota.

### Direção visual — “trust ledger”

- **Assunto:** verificação de identidade privada para empresas parceiras. **Público:** desenvolvedor ou gestor técnico avaliando a YaID. **Trabalho único da página:** explicar o valor e levar à criação de conta.
- **Paleta:** `#F8FAFC` (background), `#FFFFFF` (surface), `#0F172A` (ink/primary), `#2563EB` (trust), `#0D9488` (privacy), `#E2E8F0` (border), todos já disponíveis como tokens Tailwind.
- **Tipo:** Geist Sans existente para display e corpo; Geist Mono apenas para pequenos rótulos técnicos, se necessário. Não adicionar fontes.
- **Layout:** hero editorial assimétrico; à direita/abaixo, uma trilha contínua com as etapas reais “Solicite → Usuário confirma → YaID verifica → Receba o resultado”. A numeração é funcional porque representa uma sequência.
- **Assinatura:** a trilha visual conecta os participantes sem mostrar documentos pessoais; este é o único gesto visual forte. Evitar gradientes genéricos, glassmorphism, dashboards falsos, estatísticas inventadas e animações dispersas.
- Copy deve ser PT-BR, direta e sem jargão SSI. Exemplo de tese: “Confirme quem importa. Sem coletar o que não precisa.” O CTA mantém verbo concreto: “Criar conta”.

### Arquitetura e preservação

- Stack instalada: Next.js 16.2.6 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4 e `lucide-react` 0.477.0.
- `app/layout.tsx` fornece Geist, idioma `pt-BR`, favicon e tokens globais. A landing deve usar somente esse layout.
- `app/(dashboard)/layout.tsx` adiciona `AppSidebar`, `AppTopbar` e `Toaster`; a landing não deve importar nenhum deles.
- `components/verification/verification-layout.tsx` confirma o padrão de página pública e o uso de `/yaid_icon.svg`, mas é estreito e orientado a uma única tarefa; não reutilizá-lo para uma landing de múltiplas seções.
- `app/globals.css` já contém todas as cores, radius e shadows necessários. Não alterar tokens globais apenas para esta página, a menos que a implementação prove uma lacuna real.
- Conteúdo é estático. Nenhuma API, leitura de sessão dentro da page, mudança de banco ou variável de ambiente faz parte da 13.2.
- O redirect autenticado pertence ao middleware implementado pela 13.1; não duplicar verificação de sessão em `app/page.tsx`.

### Testing Requirements

- Seguir o padrão do repositório: `tests/unit/story-13-2/*.test.mjs`, usando `node:test` para contratos estruturais.
- Preferir poucos testes orientados aos ACs. Não testar classes Tailwind em detalhe; testar estrutura/rotas/conteúdo que representem comportamento público.
- Verificação proporcional: teste da story → `npm test` → `npm run lint` → `npm run build`.
- Testes existentes têm alterações locais não relacionadas nas stories 1.1/10.2; preservá-las e não incluí-las na File List ou commits desta story.

### Project Structure Notes

- Arquivo novo esperado após a 13.1: `app/page.tsx`.
- Teste novo esperado: `tests/unit/story-13-2/landing-page.test.mjs` (ou nome equivalente único).
- Não criar `app/(marketing)`, layout de marketing, pasta de componentes para uma única página, CSS Module ou dependência de UI.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 13: Landing Page Institucional`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 13.2: Página Pública "/" — Landing Institucional`]
- [Source: `_bmad-output/planning-artifacts/prd.md#Landing page institucional`]
- [Source: `_bmad-output/planning-artifacts/round-plan.md#Rodada 2 — 2 stories em paralelo`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-22-landing-page.md#Story 13.2: Página Pública "/" — Landing Institucional`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Executive Summary`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Estrutura do Projeto & Fronteiras`]
- [Next.js Project Structure — route groups](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- 2026-08-28: detectada dependência técnica dura da 13.1 e colisão atual da rota `/`.
- 2026-08-28: HALT no primeiro gate do `bmad-dev-story`: `app/(dashboard)/page.tsx` ainda existe, `app/(dashboard)/dashboard/page.tsx` não existe e o middleware ainda protege `/` como dashboard.
- 2026-08-28: gate reavaliado e **liberado** — `app/(dashboard)/page.tsx` removido, `app/(dashboard)/dashboard/page.tsx` presente e `src/shared/middleware.ts` já trata `/` como pública (bloco 2). HALT não se aplica mais.
- 2026-08-28: ciclo red-green — `tests/unit/story-13-2/landing-page.test.mjs` criado primeiro e falhando por ausência de `app/page.tsx`; verde após a implementação (15/15).
- 2026-08-28: `npx next build` classifica `/` como `○ (Static)`, confirmando Server Component estático e ausência de colisão de rota.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Landing implementada em `app/page.tsx`, fora de route group, usando exclusivamente o layout global (`app/layout.tsx`). Nenhum layout próprio foi criado.
- Server Component 100% estático: sem `"use client"`, estado, efeito, fetch, API, provider, dependência nova ou leitura de sessão. O redirect de autenticado permanece só no middleware da 13.1 (AC #3), sem duplicação na page.
- Direção visual "trust ledger" aplicada com os tokens já existentes em `app/globals.css` (`background`, `surface`, `primary`, `trust`, `privacy`, `border`, escala `text-*`). Nenhum hex cru e nenhum token global novo.
- Hero editorial assimétrico (`lg:grid-cols-12`, 7/5): à esquerda a tese "Confirme quem importa. Sem coletar o que não precisa."; à direita a trilha contínua "Como funciona" com as quatro etapas reais — Solicite → Usuário confirma → YaID verifica → Receba o resultado. A trilha reaproveita o padrão de `<ol>` com borda-guia e nós numerados já usado em `app/docs/page.tsx`, mantendo coerência entre as duas páginas públicas.
- Seção de privacidade construída como "ledger" de duas colunas (recebe / não recebe), tornando explícito o AC: a empresa recebe o resultado da validação e nunca documentos brutos ou dados pessoais do titular.
- Copy em PT-BR, sem jargão SSI (DID/VC/VP/blockchain), sem estatística inventada e sem depoimento. Todo o conteúdo é verificável contra o produto atual (chave de API exibida uma única vez, webhook por app, ambiente de homologação, liberação de criação de apps pelo time).
- Acessibilidade: skip link para `#conteudo`, hierarquia com um único `h1`, `header`/`nav`/`main`/`section`/`footer` semânticos, `aria-labelledby` por seção, `aria-hidden` nos ícones decorativos, `focus-visible:ring` em todos os alvos e `motion-reduce:transition-none` nas transições.
- Mobile-first: layout base em coluna única, com `sm:`/`md:`/`lg:` apenas ampliando. Nenhuma variante `max-*`.
- Reuso apenas de `next/image`, `next/link` e `lucide-react` (já instalados). Nenhum componente de uso único, pasta de componentes, CSS Module ou `app/(marketing)` foi criado.
- Verificação: story 13.2 15/15 verdes; story 13.1 6/6 verdes (sem regressão); `npx tsc --noEmit` limpo; `npx eslint app/page.tsx` limpo; `npx next build` com sucesso.
- Falhas remanescentes na suíte completa (14) são alheias a esta story: `story-12-1`/`story-12-2` estão sendo alteradas pela Story 12.2 em andamento e `story-1-1`/`story-11-8` dependem de modificações pré-existentes em `src/shared/environments.ts`. Nenhum outro teste do repositório lê `app/page.tsx`.
- `package.json` e `sprint-status.yaml` não foram alterados nesta execução por restrição de execução paralela; o script `test:story:13.2` e o status `review` devem ser aplicados manualmente.

### File List

- `app/page.tsx` (novo)
- `tests/unit/story-13-2/landing-page.test.mjs` (novo)
- `_bmad-output/implementation-artifacts/stories/13-2-pagina-publica-landing-institucional.md` (modificado)

## Change Log

- 2026-08-28: Story 13.2 implementada — landing institucional pública em `app/page.tsx` (hero, trilha "Como funciona", ledger de privacidade, integração e fechamento), com testes de contrato em `tests/unit/story-13-2/`. Status: ready-for-dev → review.
