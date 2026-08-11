---
title: 'Corrigir falhas do npm run test'
type: 'bugfix'
created: '2026-08-11'
status: 'done'
route: 'one-shot'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `npm run test` tinha 3 falhas: `proxy.ts` foi acidentalmente reescrito num commit não relacionado (`5bba41d`) de uma função explícita para um re-export, quebrando o teste da Story 1.2 que verifica o texto-fonte; e dois testes da Story 2.2 (`create-company-app.test.mjs`) ainda esperavam o comportamento pré-Story-7.4 (`environment` default `"dev"`, sem card "Ambiente"), mas a Story 7.4 (status `done`) mudou deliberadamente esse comportamento para default `"homol"` com seletor de Ambiente.

**Approach:** Reverter `proxy.ts` para a forma de função explícita (equivalente funcional, restaura o texto-fonte esperado pelo teste). Atualizar os dois testes desatualizados da Story 2.2 para refletir o comportamento correto e intencional da Story 7.4, com nota explicando a superseção.

## Boundaries & Constraints

**Always:** Preservar o comportamento funcional real do middleware/proxy; não alterar a lógica de autenticação.

**Ask First:** Se corrigir teste vs. reverter código produzisse resultados de negócio diferentes — confirmado com o usuário antes de editar (escolheu reverter `proxy.ts` e atualizar os testes da Story 2.2).

**Never:** Reverter o comportamento intencional da Story 7.4 (seletor de Ambiente, default `"homol"`).

</frozen-after-approval>

## Code Map

- `proxy.ts` -- entrypoint de middleware do Next.js, restaurado para função explícita
- `tests/unit/story-2-2/create-company-app.test.mjs` -- testes desatualizados alinhados à Story 7.4
- `_bmad-output/implementation-artifacts/deferred-work.md` -- pendências identificadas na revisão adversarial, não corrigidas neste fix

## Tasks & Acceptance

**Execution:**
- [x] `proxy.ts` -- restaurar `export function proxy(...)` explícito -- corrige regressão acidental do commit `5bba41d`
- [x] `tests/unit/story-2-2/create-company-app.test.mjs` -- atualizar expectativas de default e card Ambiente -- alinha com Story 7.4 (done)
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- registrar 3 pendências da revisão adversarial -- doc da Story 2.2 desatualizado, falta teste de sincronia de default, testes baseados em regex de texto-fonte

**Acceptance Criteria:**
- Given a suíte completa, when `npm run test` roda, then todos os 1013 testes passam (950 + 63), 0 falhas.

## Verification

**Commands:**
- `npm run test` -- expected: `tests 950 / pass 950 / fail 0` e `tests 63 / pass 63 / fail 0`

## Suggested Review Order

**Regressão do proxy.ts**

- Volta à função explícita que delega para o middleware compartilhado, desfazendo o re-export acidental.
  [`proxy.ts:4`](../../proxy.ts#L4)

**Testes desatualizados da Story 2.2 (superados pela Story 7.4)**

- Nota de topo do arquivo explica que a Story 7.4 (done) superou parte do contrato original da Story 2.2.
  [`create-company-app.test.mjs:6`](../../tests/unit/story-2-2/create-company-app.test.mjs#L6)

- Default de `environment` corrigido de `"dev"` para `"homol"`, conforme Story 7.4.
  [`create-company-app.test.mjs:36`](../../tests/unit/story-2-2/create-company-app.test.mjs#L36)

- Assertion invertida: agora exige o card "Ambiente" reintroduzido pela Story 7.4.
  [`create-company-app.test.mjs:94`](../../tests/unit/story-2-2/create-company-app.test.mjs#L94)

**Pendências registradas**

- Três achados da revisão adversarial (doc da Story 2.2 desatualizado, falta de teste de sincronia de default, testes baseados em regex de texto) documentados para trabalho futuro.
  [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md)
