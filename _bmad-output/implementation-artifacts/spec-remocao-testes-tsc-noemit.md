---
title: 'Centralizar verificação de compilação TS e remover testes duplicados'
type: 'chore'
created: '2026-08-31'
status: 'done'
context: []
baseline_commit: 'fe119cc094775eaf71a1a73d9a3990f6dfb01e25'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 21 arquivos de teste unitário (`tests/unit/story-*/*.test.mjs`) rodam `tsc --noEmit` inline como parte da suíte, sem nenhum step de typecheck dedicado no CI — são a única verificação de compilação TS antes do deploy. Rodar `tsc --noEmit` 21 vezes é redundante e infla a suíte com testes que não validam comportamento algum.

**Approach:** Extrair a checagem de compilação para um script único (`npm run typecheck`) rodado uma vez no job `tests` (gate) do CI, e desativar (`test.skip`, não deletar) o teste de compilação em cada um dos 21 arquivos. Os 19 arquivos "mistos" mantêm todas as outras asserções ativas; só o teste de compilação é desativado.

## Boundaries & Constraints

**Always:**
- Usar `test.skip(...)` (mesma assinatura `node:test`) no lugar do `test(...)` de compilação — nunca apagar o arquivo ou as demais asserções dos 19 arquivos mistos.
- `npm run typecheck` deve rodar dentro do job `tests` existente (`.github/jobs/tests/action.yml`), preservando a ordem atual do gate (`tests -> deploy-supabase -> deploy-amplify -> smoke-test`) — não criar um job paralelo/posterior que só bloquearia o deploy-amplify.
- Remover imports que ficarem sem uso em cada arquivo após o skip (ex.: `execSync`/`execFileSync`, `resolve` quando usado só para achar o binário do `tsc`).
- Deixar um comentário curto no step de typecheck do CI avisando que novas stories não devem adicionar testes unitários de `tsc --noEmit` — a checagem agora é centralizada ali.

**Ask First:** nenhuma decisão adicional esperada — escopo mecânico e já validado (projeto compila limpo hoje, confirmado via `tsc --noEmit` local).

**Never:** não alterar as outras 3 fases do pipeline (`deploy-supabase`, `deploy-amplify`, `smoke-test`); não tocar nos testes `*.dynamic.test.ts`; não remover/alterar as asserções de regex/source-pattern já existentes nos 19 arquivos mistos.

</frozen-after-approval>

## Code Map

- `package.json` -- adicionar script `"typecheck": "tsc --noEmit"`
- `.github/jobs/tests/action.yml` -- adicionar step `npm run typecheck` (antes de `npm test`) + comentário de política
- 21 arquivos `tests/unit/story-{1-1,1-2,1-3,1-4,1-5,1-6,10-1,10-2,5-1,5-2,5-4,5-5,5-6,5-7,5-8,5-9,6-1,7-1,7-6,9-1,9-2}/*.test.mjs` -- cada um tem exatamente 1 `test(...)` que roda `tsc --noEmit`; vira `test.skip(...)`

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- adicionar `"typecheck": "tsc --noEmit"` aos `scripts` -- fonte única de verdade para verificação de compilação
- [x] `.github/jobs/tests/action.yml` -- adicionar step "Run typecheck (gate)" com `run: npm run typecheck` antes do step "Run test suite (gate)", e um comentário curto explicando que testes unitários de compilação TS foram centralizados aqui -- preserva a posição do gate antes de `deploy-supabase`
- [x] Nos 21 arquivos listados no Code Map -- trocar `test("... compile without TypeScript errors" ...)` por `test.skip(...)` (mesma assinatura, incluindo `{ timeout: 120_000 }` se presente) e remover imports que ficarem sem uso (`execSync`/`execFileSync` e afins) -- elimina a duplicação sem apagar as demais asserções do arquivo

**Acceptance Criteria:**
- Given o script `typecheck` em `package.json`, when executado (`npm run typecheck`), then roda `tsc --noEmit` no projeto inteiro e retorna código de saída não-zero se houver erro de tipo.
- Given o job `tests` do CI, when disparado por um push em `prod`, then executa `npm run typecheck` e `npm test`, falhando (e bloqueando `deploy-supabase`) se qualquer um dos dois falhar.
- Given a suíte `npm test` após a mudança, when executada, then nenhum dos 21 arquivos listados dispara `tsc --noEmit`, e todas as demais asserções pré-existentes desses arquivos continuam passando.
- Given um novo arquivo de teste criado por uma story futura, when o autor olha `.github/jobs/tests/action.yml`, then encontra o comentário instruindo a não adicionar testes unitários de compilação TS.

## Spec Change Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0, sem `error TS` (exceto ruído conhecido de `lucide-react`)
- `npm test` -- expected: mesma contagem de testes anterior menos 21 (os 21 skips aparecem como `skipped`, não `failed`), zero falhas

## Suggested Review Order

**Gate de compilação centralizado no CI**

- Novo step único substitui as 21 checagens `tsc --noEmit` por arquivo — ponto de entrada do design.
  [`action.yml:37`](../../.github/jobs/tests/action.yml#L37)

- Filtro de `error TS` ignora ruído conhecido de `lucide-react`, preservando a tolerância que os testes removidos já aplicavam.
  [`action.yml:41`](../../.github/jobs/tests/action.yml#L41)

- Script `typecheck` é a fonte única de verdade da compilação — usado pelo CI e disponível localmente.
  [`package.json:8`](../../package.json#L8)

**Testes de compilação desativados**

- Padrão replicado nos 21 arquivos: `test` vira `test.skip`, corpo e demais asserções do arquivo intactos.
  [`restructure.test.mjs:202`](../../tests/unit/story-1-1/restructure.test.mjs#L202)
