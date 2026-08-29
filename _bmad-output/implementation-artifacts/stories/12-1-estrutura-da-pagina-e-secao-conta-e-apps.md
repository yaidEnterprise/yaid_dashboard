# Story 12.1: Estrutura da Página e Seção "Conta e Apps"

Status: review

## Story

Como desenvolvedor,
Quero uma página pública `/docs` com layout independente e navegação por seções,
Para que empresas parceiras acessem um guia de integração sem precisar de login.

## Acceptance Criteria

1. **Given** a rota `/docs`, fora do grupo `(dashboard)`
   **When** acessada sem autenticação
   **Then** carrega normalmente sem sidebar/topbar do dashboard
   **And** usa layout próprio com a marca oficial YaID
   **And** não cria API, busca de company nem conteúdo dependente de sessão.

2. **Given** a navegação da página
   **When** renderizada
   **Then** contém links para as âncoras “Visão geral”, “Criando sua conta e seu primeiro app”, “Ambientes: Homologação vs Produção”, “Solicitando uma verificação (Proof Request)” e “Webhooks”
   **And** cada link aponta para um `id` existente na própria página
   **And** os dois últimos destinos formam o shell que a Story 12.2 completará.

3. **Given** trechos técnicos na documentação
   **When** exibidos
   **Then** reutilizam `CodeBlock` e `InlineCode` de `components/api/code-block.tsx`
   **And** blocos possuem o botão de copiar já implementado
   **And** exemplos usam somente valores fictícios e placeholders claramente identificáveis.

4. **Given** a seção “Visão geral”
   **When** renderizada
   **Then** descreve o fluxo completo, nesta ordem: criar conta → criar app → obter API key → chamar `POST /api/proof-requests` → redirecionar o holder → receber webhook.

5. **Given** a seção “Criando sua conta e seu primeiro app”
   **When** renderizada
   **Then** documenta o cadastro em `/sign-up` com email, senha, nome da empresa e CNPJ
   **And** documenta a criação em `/apps/new` com nome, webhook HTTPS opcional e ambiente
   **And** informa que a criação pode depender da liberação da empresa (`can_create_apps`)
   **And** reforça que a API key aparece uma única vez e deve ser copiada antes de concluir o modal.

6. **Given** a seção “Ambientes: Homologação vs Produção”
   **When** renderizada
   **Then** explica que o ambiente é escolhido na criação e é imutável no MVP
   **And** informa que apps de homologação permitem `Aprovar`/`Reprovar` manualmente no dashboard e disparam o webhook real
   **And** informa que apps de produção dependem exclusivamente do fluxo do holder
   **And** deixa claro que não há isolamento de dados: uma proof request é real nos dois ambientes.

7. **Given** a página em viewport móvel ou desktop e navegação por teclado
   **When** usada
   **Then** preserva hierarquia semântica (`h1` único e `h2` por seção), foco visível, link para pular ao conteúdo e alvos de âncora legíveis sem ficarem encobertos pelo cabeçalho.

## Tasks / Subtasks

- [x] Task 1: Criar o layout público da documentação (AC: #1, #7)
  - [x] Criar `app/docs/layout.tsx` com metadata própria, `Toaster` para o feedback de cópia e sem importar o chrome do dashboard.
  - [x] Reutilizar `public/yaid_icon.svg`, tokens de `app/globals.css` e tipografia já configurada no root layout.

- [x] Task 2: Criar a página única e sua navegação por âncoras (AC: #2, #7)
  - [x] Criar `app/docs/page.tsx` como conteúdo estático/server component.
  - [x] Renderizar os cinco links e cinco destinos com IDs estáveis e HTML semântico.
  - [x] Manter os destinos de Proof Requests e Webhooks como introduções curtas, sem antecipar o conteúdo detalhado da Story 12.2.

- [x] Task 3: Escrever as seções da Story 12.1 (AC: #3, #4, #5, #6)
  - [x] Descrever o fluxo ponta a ponta em uma sequência realmente ordenada.
  - [x] Documentar signup, criação do app, allowlist e captura one-shot da API key.
  - [x] Comparar homologação e produção com as restrições normativas, incluindo webhook real e ausência de isolamento.
  - [x] Reusar `CodeBlock`/`InlineCode` com exemplo exclusivamente fictício.

- [x] Task 4: Atualizar a regressão antiga de `CodeBlock` (AC: #3)
  - [x] Em `tests/unit/story-7-6/qa-regression.test.mjs`, remover/estreitar a guarda global que exige zero consumidores de `CodeBlock`; preservar a garantia de que ele não retorna ao detalhe de proof request.
  - [x] Marcar como resolvido o item correspondente em `_bmad-output/implementation-artifacts/deferred-work.md`.

- [x] Task 5: Criar cobertura da Story 12.1 e validar (AC: #1–#7)
  - [x] Criar `tests/unit/story-12-1/*.test.mjs` no padrão `node:test` do projeto (já existiam, escritos antes da implementação; usados como contrato).
  - [x] Cobrir rota/layout público, marca, ausência do chrome autenticado, cinco links/IDs, conteúdo normativo, reuso de `CodeBlock`/`InlineCode` e placeholders fictícios.
  - [ ] Adicionar `test:story:12.1` ao `package.json` — **pendente**: `package.json` não pôde ser editado nesta execução (agente paralelo na mesma árvore). Linha a aplicar: `"test:story:12.1": "node --test \"tests/unit/story-12-1/*.test.mjs\""`.
  - [x] Rodar teste da story, testes afetados (7.6), TypeScript e lint.

## Dev Notes

### Escopo e solução mínima

- A entrega é estática e frontend-only. Não criar endpoint, middleware específico, client fetch, estado global, biblioteca ou subsistema multi-página de documentação.
- `/docs` já cai no branch público final de `src/shared/middleware.ts`; não adicionar allowlist só para satisfazer um teste estrutural.
- Produção mínima esperada: `app/docs/layout.tsx` + `app/docs/page.tsx`. Não extrair componentes de uso único.
- A Story 12.1 entrega conteúdo completo somente para Visão geral, Conta/Apps e Ambientes. Os headings/IDs de Proof Requests e Webhooks precisam existir agora porque a navegação completa é AC, mas o conteúdo detalhado pertence à 12.2.

### Direção visual

- Sujeito: guia técnico de integração para desenvolvedores/gestores de empresas parceiras. Trabalho único da página: levar o leitor de conta criada a integração compreendida.
- Paleta: tokens existentes — background `#F8FAFC`, surface `#FFFFFF`, texto `#0F172A`, trust `#2563EB`, borda `#E2E8F0`, code `#0F172A`.
- Tipografia: Geist/Inter do root layout para leitura e Geist Mono no código. Não adicionar fonte.
- Layout: cabeçalho público compacto + conteúdo largo; navegação por âncoras funciona como índice; a sequência do fluxo é o elemento de assinatura porque os números codificam etapas reais, não decoração.
- Não copiar literalmente o `max-w-[520px]` mobile-only da tela coringa: o padrão a herdar é independência de chrome + marca, enquanto documentação longa requer largura de leitura maior.
- Acessibilidade: `h1` único, `h2` por seção, `nav aria-label`, skip link, foco visível e `scroll-mt-*` nos alvos.

### Estado atual a preservar

- `components/api/code-block.tsx` já é client boundary, fornece `CodeBlock`/`InlineCode`, cópia via Clipboard API, fallback manual e feedback Sonner. Reusar sem duplicar lógica.
- `app/layout.tsx` já define `lang="pt-BR"`, fontes, favicon e tokens globais.
- `app/sign-up/page.tsx` confirma email, senha, nome da empresa e CNPJ.
- `app/(dashboard)/apps/new/page.tsx` confirma nome, ambiente (`homol` default / `prod`) e webhook HTTPS opcional.
- `components/apps/api-key-modal.tsx` confirma reveal one-shot e bloqueio até o usuário declarar que copiou a chave.
- O backend e a UI de review já limitam Aprovar/Reprovar a apps `homol`; não modificar esses fluxos.

### Regressão conhecida que esta story deve corrigir

`tests/unit/story-7-6/qa-regression.test.mjs` transformou o fato temporário “CodeBlock ficou sem consumidores” em uma regra global. A Story 12.1 resolve exatamente o deferred que previa reutilizá-lo em uma tela de docs. Atualize a QA antiga para proteger apenas o escopo real da 7.6 (não reintroduzir resposta JSON bruta no detalhe), em vez de criar uma exceção de caminho para `/docs`.

### Testes

- Siga o padrão já estabelecido: `node:test`, `assert` e inspeção de fonte para contratos de UI estática; mantenha uma execução real do TypeScript como validação separada.
- Teste de auth deve verificar que `/docs` não está na lista de páginas protegidas, sem exigir alteração do middleware quando o fallthrough já é público.
- A página deve importar os componentes compartilhados e incluir texto suficiente para provar os requisitos; não teste classes cosméticas específicas além das necessárias para ausência de chrome, acessibilidade e âncoras.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---|---|---|
| `app/docs/layout.tsx` | CRIAR | Metadata, Toaster e boundary de layout público |
| `app/docs/page.tsx` | CRIAR | Página estática, marca, índice, cinco seções e conteúdo 12.1 |
| `tests/unit/story-12-1/*.test.mjs` | CRIAR | Contratos estruturais e conteúdo normativo |
| `tests/unit/story-7-6/qa-regression.test.mjs` | MODIFICAR | Remover a proibição global obsoleta de consumidores de CodeBlock |
| `_bmad-output/implementation-artifacts/deferred-work.md` | MODIFICAR | Registrar resolução do deferred de CodeBlock |
| `package.json` | MODIFICAR | Script `test:story:12.1` |

### References

- [Epics: Epic 12 e Story 12.1](../../planning-artifacts/epics.md#epic-12-documentação-pública-de-integração)
- [PRD: Documentação pública de integração](../../planning-artifacts/prd.md#documentação-pública-de-integração)
- [Sprint Change aprovado](../../planning-artifacts/sprint-change-proposal-2026-08-22.md)
- [UX: Visual Design Foundation](../../planning-artifacts/ux-design-specification.md#visual-design-foundation)
- [UX: Accessibility Strategy](../../planning-artifacts/ux-design-specification.md#accessibility-strategy)
- [Componente CodeBlock/InlineCode](../../../components/api/code-block.tsx)
- [Layout público de referência](../../../components/verification/verification-layout.tsx)
- [Middleware atual](../../../src/shared/middleware.ts)
- [Regressão antiga a ajustar](../../../tests/unit/story-7-6/qa-regression.test.mjs)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (story authoring) · Claude Opus 5 (implementação)

### Debug Log References

- `node --test "tests/unit/story-12-1/*.test.mjs"` — 16/16 pass
- `node --test "tests/unit/story-7-6/*.test.mjs"` — 15/15 pass (inclui a execução real de `tsc --noEmit`)
- `npx tsc --noEmit` — sem erros
- `npx eslint app/docs tests/unit/story-7-6` — limpo

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- `/docs` implementado como server component estático: nenhum `fetch`, nenhum acesso a sessão, nenhuma rota de API criada. O middleware não foi alterado — `/docs` já cai no fallthrough público (passo 7).
- Header público próprio com `yaid_icon.svg`; o `Toaster` vive em `app/docs/layout.tsx` para dar feedback ao botão de copiar do `CodeBlock`.
- Elemento de assinatura: a esteira numerada de 6 etapas em "Visão geral" (01→06), que codifica o fluxo real da integração.
- Seções "Proof Request" e "Webhooks" entregues apenas como shell com intro curta e nota de que o contrato detalhado será publicado ali (Story 12.2).
- A guarda global de "zero consumidores de `CodeBlock`" da Story 7.6 foi estreitada para o escopo real da 7.6 (o detalhe de proof request não pode reintroduzir o bloco de resposta bruta), em vez de criar uma exceção de caminho para `/docs`.
- `package.json` não foi alterado (restrição de execução paralela); o script `test:story:12.1` está pendente de aplicação manual.

### File List

- `app/docs/layout.tsx` (novo)
- `app/docs/page.tsx` (novo)
- `tests/unit/story-7-6/qa-regression.test.mjs` (modificado — guarda global estreitada)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificado — deferred de `CodeBlock` marcado como RESOLVIDO)
- `tests/unit/story-12-1/docs-page.test.mjs` (pré-existente, usado como contrato)
- `tests/unit/story-12-1/docs-public-route.test.mjs` (pré-existente, usado como contrato)

## Change Log

- 2026-08-28: Story criada com contexto completo para implementação.
- 2026-08-28: Implementação concluída — `/docs` público com layout próprio, índice por âncoras e seções Visão geral, Conta/Apps e Ambientes; QA obsoleta da 7.6 corrigida. Status → review.
