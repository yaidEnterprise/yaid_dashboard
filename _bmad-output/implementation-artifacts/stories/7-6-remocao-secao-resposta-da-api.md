# Story 7.6: Remoção da Seção "Resposta da API" no Detalhe

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como empresa parceira,
Quero uma tela de detalhe sem payload técnico cru,
Para que eu foque no resultado e no significado da validação, sem ruído de SSI.

## Acceptance Criteria

1. **Given** a página `/(dashboard)/proof-requests/[requestId]`
   **When** revisada após esta story
   **Then** a seção "Resposta da API" (o `CodeBlock` com o `payload` bruto da rota GET) é removida
   **And** permanecem o card de "Resumo" e o card de "Atributos confirmados"
   **And** a coluna lateral com o card de privacidade é preservada
   **And** o layout de grid `lg:grid-cols-3` (coluna principal `lg:col-span-2` + aside) é preservado

2. **Given** os imports do arquivo de detalhe
   **When** a seção é removida
   **Then** o import de `CodeBlock` de `@/components/api/code-block` é removido de `page.tsx` (o import de `InlineCode` permanece — ainda usado no ID da página e na referência externa)
   **And** a construção da variável `payload` (`JSON.stringify(...)`) é removida por não ter mais consumidor

3. **Given** qualquer status da proof_request
   **When** a tela de detalhe é exibida
   **Then** nenhuma saída bruta de JSON da rota é exibida ao usuário-empresa

## Tasks / Subtasks

- [x] Task 1: Remover o bloco "Resposta da API" da página de detalhe (AC: #1, #2, #3)
  - [x] Em `app/(dashboard)/proof-requests/[requestId]/page.tsx`, removida a `<div>` "Bloco técnico" inteira (título "Resposta da API", parágrafo descritivo e `<CodeBlock language="json" code={payload} />`)
  - [x] Removida a construção de `payload` (`JSON.stringify({...}, null, 2)`) — não era usada em mais nenhum lugar da página
  - [x] Removido o import `CodeBlock` (`import { InlineCode } from "@/components/api/code-block";`) — `InlineCode` preservado (usado no ID da página e no campo "Referência externa")
  - [x] Confirmado que a coluna principal (`lg:col-span-2`) contém apenas os cards "Resumo" e "Atributos confirmados", e que o `<aside>` de privacidade permanece intocado

- [x] Task 2: Atualizar o teste existente da Story 3.3 que assume a presença do CodeBlock (AC: #2, #3)
  - [x] Em `tests/unit/story-3-3/proof-request-detail.test.mjs`, o teste antigo `"renders the API JSON via CodeBlock and keeps the privacy card (AC #1)"` foi renomeado para `"keeps the privacy card and no longer exposes the raw API JSON (Story 7.6)"` — agora afirma a AUSÊNCIA de `CodeBlock`/`JSON.stringify` e a presença do card de privacidade
  - [x] Teste `"has NO timeline (FR8: sem timeline no MVP)"` não foi tocado — continua válido, não relacionado a esta story

- [x] Task 3: Criar testes estruturais da Story 7.6
  - [x] Criado `tests/unit/story-7-6/proof-request-detail-no-api-response.test.mjs` (padrão `node:test` + leitura de fonte via `readFileSync`, mesmo padrão de `tests/unit/story-3-3/`)
  - [x] Cobertura: ausência do import `CodeBlock`; presença do import `InlineCode`; ausência do texto `"Resposta da API"`; ausência de `const payload = JSON.stringify`; ausência de `<CodeBlock` no JSX; presença de "Resumo", "Atributos confirmados", "Privacidade"; preservação de `lg:grid-cols-3`/`lg:col-span-2`
  - [x] Script `"test:story:7.6": "node --test \"tests/unit/story-7-6/*.test.mjs\""` adicionado ao `package.json`

- [x] Task 4: Rodar testes e validar sem regressão
  - [x] `npm run test:story:7.6` — 9/9 passando
  - [x] `npm run test:story:3.3` — 20/20 passando (teste atualizado da Task 2 incluído)
  - [x] `npm run test` (suíte completa) — 577/577 passando, zero regressão
  - [x] `npm run lint` — 21 problemas pré-existentes em outros arquivos (mesmo conjunto já documentado na Story 7.1); zero problemas nos arquivos desta story
  - [x] `npx tsc --noEmit` — zero erros de tipo (verificação adicional do code review, sem erros introduzidos pela remoção)

### Review Findings

- [x] [Review][Defer] Componente `CodeBlock` (`components/api/code-block.tsx`) fica sem nenhum consumidor na codebase após a remoção do import em `page.tsx` — `InlineCode` (mesmo arquivo) segue em uso ativo [components/api/code-block.tsx] — deferido, decisão explícita de escopo desta story (arquivo compartilhado, não deletar); ver `deferred-work.md`

## Dev Notes

### Escopo é puramente de remoção — não crie nada novo

Esta é uma story de limpeza de UI. Não crie componentes novos, não adicione lógica, não toque em nenhum endpoint de backend. O único arquivo de produção tocado é `app/(dashboard)/proof-requests/[requestId]/page.tsx`. Não delete o arquivo `components/api/code-block.tsx` — ele é um componente compartilhado (`CodeBlock`/`InlineCode`), e `InlineCode` continua em uso nesta mesma página (ID da requisição, campo "Referência externa"). Apagar o arquivo quebraria esses usos.

### Drift entre a AC do épico e o código real (mesmo padrão já visto na Story 7.1)

A AC do épico (`epics.md`, Story 7.6) e a UX spec (UX-DR5) mencionam preservar "a timeline" e o componente nomeado `PrivacyCard`. **Nenhum dos dois existe hoje**:

- **Não existe timeline** na página de detalhe. A Story 3.3 (`FR8`) explicitamente implementou **sem timeline no MVP**, e há um teste (`tests/unit/story-3-3/proof-request-detail.test.mjs`, `"has NO timeline (FR8...)"`) que garante isso. Não adicione timeline nesta story — está fora de escopo e contradiria uma AC de uma story já concluída.
- **Não existe um componente `PrivacyCard`** — o card de privacidade é um `<aside>` inline dentro de `page.tsx` (linhas ~234-246, texto "Privacidade" + texto sobre não-armazenamento de dados pessoais). Trate-o como "o card de privacidade" — o bloco JSX existente, não um componente a criar ou importar.

Confie no código real (`page.tsx`) como fonte de verdade, não nos nomes de componentes da UX spec/epics — eles descrevem um estado aspiracional que nunca foi extraído em componentes nomeados.

### Estado atual do arquivo a modificar (`page.tsx`)

Estrutura hoje (216 linhas), na coluna principal (`lg:col-span-2`), em ordem:

1. Card "Resumo" (`<dl>` com App, Tipo, Referência externa, Criada em, Atualizada em) — **preservar**
2. Card "Atributos confirmados" (claims booleanos ou mensagem de status) — **preservar**
3. Bloco "Resposta da API" (título + descrição + `<CodeBlock language="json" code={payload} />`) — **remover inteiro**

Na coluna lateral (`<aside>`): card de privacidade — **preservar, não tocar**.

A variável `payload` (construída via `JSON.stringify` a partir de `data.id`, `data.appId`, `data.appName`, `data.environment`, `data.proofType`, `data.status`, `data.result`, `data.externalReference`, `data.createdAt`, `data.updatedAt`) só é consumida pelo bloco removido — pode ser deletada com segurança, nenhum outro lugar da página a referencia.

### Regressão a corrigir: teste da Story 3.3 quebra com esta mudança

`tests/unit/story-3-3/proof-request-detail.test.mjs` tem um teste que hoje **exige** a presença de `CodeBlock` na página (`assert.match(src, /CodeBlock/, ...)`). Esse teste vai falhar assim que o bloco for removido — **não é uma falha a ignorar, é esperado que você atualize esse teste** como parte desta story (Task 2). Não crie um teste "test:story:7.6" que apenas paralelamente ignora essa quebra — o teste antigo tem que ser corrigido para não referenciar mais `CodeBlock`.

### Testes — padrão do projeto (reforçado pela Story 7.1)

Testes ficam em `tests/unit/story-{epic}-{num}/*.test.mjs`, fora do módulo/componente, com script dedicado `test:story:X.Y` no `package.json`. São testes de inspeção de código-fonte (`readFileSync` + regex/assert), sem executar TypeScript nem montar componentes React — mesmo padrão usado em `tests/unit/story-3-3/proof-request-detail.test.mjs`. Siga esse padrão, não tente configurar um test runner de React/DOM novo para esta story.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---|---|---|
| `app/(dashboard)/proof-requests/[requestId]/page.tsx` | MODIFICAR | Remove bloco "Resposta da API", variável `payload` e import `CodeBlock` |
| `tests/unit/story-3-3/proof-request-detail.test.mjs` | MODIFICAR | Atualizar teste que hoje exige `CodeBlock` na página |
| `tests/unit/story-7-6/*.test.mjs` | CRIAR | Testes estruturais garantindo remoção completa e preservação do restante |
| `package.json` | MODIFICAR | Adicionar script `test:story:7.6` |

Nenhum arquivo de backend (`src/modules/proof-request/`), rota de API, migration ou schema é tocado nesta story — é puramente remoção de UI no frontend.

### References

- [Epics: Story 7.6 AC](../../planning-artifacts/epics.md#story-76-remoção-da-seção-resposta-da-api-no-detalhe)
- [UX Spec: UX-DR5](../../planning-artifacts/ux-design-specification.md)
- [Página de detalhe atual](../../../app/(dashboard)/proof-requests/[requestId]/page.tsx)
- [Componente CodeBlock/InlineCode (não deletar — InlineCode permanece em uso)](../../../components/api/code-block.tsx)
- [Teste da Story 3.3 a corrigir](../../../tests/unit/story-3-3/proof-request-detail.test.mjs)
- [Story 7.1 — padrão de testes estruturais desta fase do épico](7-1-fundacao-de-versionamento-de-schema.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npm run test:story:7.6` → 9/9 passando (red antes da implementação: 4 falhas — import CodeBlock, heading, payload, uso no JSX — confirmadas antes de editar `page.tsx`; green depois).
- `npm run test:story:3.3` → 20/20 passando após atualizar o teste que assumia `CodeBlock`.
- `npm run test` (suíte completa) → 577/577 passando.
- `npm run lint` → 21 problemas pré-existentes (9 erros, 12 warnings) em arquivos não tocados por esta story (`sign-in/page.tsx`, `sign-up/page.tsx`, `api-key-modal.tsx`, viewmodels/testes antigos) — mesmo conjunto documentado como pré-existente na Story 7.1.

### Completion Notes List

- Removida a seção "Resposta da API" (`CodeBlock` com JSON bruto da resposta) de `app/(dashboard)/proof-requests/[requestId]/page.tsx`, junto com a variável `payload` e o import órfão de `CodeBlock`. `InlineCode` foi preservado — segue em uso no ID da requisição e no campo "Referência externa".
- Grid de 2 colunas (`lg:grid-cols-3` com coluna principal `lg:col-span-2` + `<aside>`) preservada; cards "Resumo", "Atributos confirmados" e o card de privacidade inline (`<aside>`, não um componente `PrivacyCard` nomeado — nunca existiu como componente separado) permanecem intocados.
- Confirmado, como já documentado nos Dev Notes: não existe timeline na tela de detalhe (Story 3.3 implementou explicitamente sem timeline, FR8) — nenhuma foi adicionada, e o teste de regressão que garante isso (`"has NO timeline"`) continua passando.
- O componente `components/api/code-block.tsx` (`CodeBlock`/`InlineCode`) não foi deletado — `InlineCode` continua em uso ativo na mesma página.
- Teste pré-existente da Story 3.3 que exigia `CodeBlock` na página foi atualizado (não apenas relaxado) para agora afirmar sua ausência — a regressão esperada foi corrigida, não ignorada.

### File List

**Modificados:**
- `app/(dashboard)/proof-requests/[requestId]/page.tsx` (remove seção "Resposta da API", variável `payload`, import `CodeBlock`)
- `tests/unit/story-3-3/proof-request-detail.test.mjs` (teste que assumia `CodeBlock` atualizado para afirmar sua ausência)
- `package.json` (script `test:story:7.6`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (7-6: backlog → ready-for-dev → in-progress → review)

**Criados:**
- `tests/unit/story-7-6/proof-request-detail-no-api-response.test.mjs`
- `tests/unit/story-7-6/qa-regression.test.mjs` (QA)

## Change Log

- 2026-07-30: Story criada e implementada via bmad-story-pipeline. Seção "Resposta da API" (payload JSON bruto) removida do detalhe de proof_request; card de privacidade, resumo e atributos confirmados preservados. Teste pré-existente da Story 3.3 corrigido (não apenas contornado). 9 testes estruturais novos, 577/577 na suíte completa, zero regressão.
- 2026-07-30: Code review — 0 decision-needed, 0 patch, 1 defer (`CodeBlock` sem consumidores após a remoção, registrado em `deferred-work.md`); demais achados dos revisores adversariais descartados como ruído/falsos positivos por falta de contexto do projeto. `npx tsc --noEmit` confirmado limpo.
- 2026-07-30: QA — `tests/unit/story-7-6/qa-regression.test.mjs` adicionado com 5 testes: guard codebase-wide de que `CodeBlock` não tem mais nenhum consumidor, preservação comportamental de `InlineCode`, wiring do script `test:story:7.6`, compilação TypeScript real. QA encontrou e corrigiu um bug no próprio teste de compilação (invocar `.bin/tsc` via `execFileSync` lança `ENOENT` no Windows e seria mascarado como "sem erros" por um catch genérico) antes de persisti-lo. 14/14 testes da story, 582/582 na suíte completa.
