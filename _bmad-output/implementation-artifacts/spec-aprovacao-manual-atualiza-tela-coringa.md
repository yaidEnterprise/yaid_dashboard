---
title: 'Aprovação manual de proof-request atualiza a tela coringa'
type: bugfix
created: '2026-10-13'
status: done
baseline_commit: a14628242c59c5fcfdfe631cbd83635df750b3e1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ao aprovar manualmente uma proof-request no painel (app homol), `ReviewProofRequestUseCase` só atualiza `proof_request.status` e dispara o webhook. A `proof_session` fica em `waiting_user`/`opened`, então a tela coringa (`app/v/[sessionToken]`, que faz polling da sessão) nunca mostra o estado aprovado e a ação não pode ser verificada. No fluxo real (`VerifyPresentationUseCase`) a sessão vai para `approved_by_user`.

**Approach:** Na decisão `approve`, o use case localiza a `proof_session` da request e a leva para `approved_by_user` (com `approvedAt`) antes de atualizar a request e disparar o webhook, espelhando o fluxo real.

## Boundaries & Constraints

**Always:** Ordem igual ao fluxo real: sessão → status da request → webhook. Guards existentes (404 anti-enumeração, 403 não-homol, 422 terminal) e contrato HTTP/DTO de saída inalterados. Sessão já terminal (`expired`/`cancelled`/`approved_by_user`) não é alterada. Aprovação manual vale tanto para sessão `waiting_user` quanto `opened`.

**Ask First:** Alterar o comportamento de `reject` (ex.: levar a sessão para `cancelled`); mudar o schema do banco.

**Never:** Pular as regras de VP no fluxo real (`VerifyPresentationUseCase` fica intocado); relaxar `approveByUser` (continua exigindo `OPENED`); novo endpoint ou mudança de UI; falhar a aprovação quando a request não tem sessão.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Aprovar, sessão `waiting_user` | request pendente, sessão `waiting_user` | sessão `approved_by_user` + `approvedAt`; request `approved`; webhook | N/A |
| Aprovar, sessão `opened` | request pendente, sessão `opened` | idem | N/A |
| Aprovar, sem sessão | `findByProofRequestId` → null | request `approved` + webhook; nenhuma escrita de sessão | N/A |
| Aprovar, sessão terminal | sessão `expired`/`cancelled` | sessão não é persistida de novo; request segue o fluxo atual | N/A |
| Rejeitar | decision `reject` | sessão não é lida nem alterada (comportamento atual) | N/A |
| Guards | outra empresa / não-homol / request terminal | 404 / 403 / 422, sem nenhuma escrita | erros atuais |

</frozen-after-approval>

## Code Map

- `src/modules/proof-request/app/review_proof_request_usecase.ts` -- aprovação manual; recebe `ProofSessionRepository` e atualiza a sessão
- `src/modules/proof-request/app/review_proof_request_presenter.ts` -- composition root; injeta `getProofSessionRepository()`
- `src/shared/domain/entities/ProofSession.ts` -- novo `approveManually(now)` (waiting_user|opened → approved_by_user)
- `src/shared/domain/interfaces/repositories/ProofSessionRepository.ts` -- novo `findByProofRequestId`
- `src/shared/infra/repositories/SupabaseProofSessionRepository.ts` -- implementa `findByProofRequestId` (`proof_request_id`)
- `tests/unit/story-7-5/review-proof-request.dynamic.test.ts` -- fakes + casos novos
- `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`, `tests/unit/story-9-2/verify-presentation-vc-jwt.dynamic.test.ts` -- fakes de `ProofSessionRepository` ganham o método novo

## Tasks & Acceptance

**Execution:**
- [x] `ProofSession.ts` -- adicionar `approveManually(now)`; no-op em status terminal -- transição sem exigir `OPENED`
- [x] `ProofSessionRepository.ts` + `SupabaseProofSessionRepository.ts` -- adicionar `findByProofRequestId(id)` -- localizar a sessão pela request
- [x] `review_proof_request_usecase.ts` + `review_proof_request_presenter.ts` -- injetar `sessionRepo` (2º parâmetro, `deliverWebhook` passa a 3º) e aprovar a sessão antes de `updateStatus` -- fluxo igual ao real
- [x] Testes (7-5, 5-8, 9-2) -- atualizar construtores/fakes e cobrir a matriz I/O (aprovar waiting_user/opened, sem sessão, sessão terminal, reject sem tocar sessão, ordem sessão→request→webhook)

**Acceptance Criteria:**
- Given app homol com sessão ativa, when a aprovação manual é feita, then `GET /api/proof-sessions/{token}` retorna `approved_by_user` e a tela coringa exibe o estado aprovado no próximo polling.
- Given qualquer teste existente da Story 7.5, when a suíte roda, then continua verde (guards e DTO inalterados).

## Verification

**Commands:**
- `npm run typecheck` -- expected: sem erros
- `npm test` -- expected: todas as suítes verdes
- `npm run lint` -- expected: sem erros novos

## Suggested Review Order

**Aprovação manual propaga para a sessão**

- Ponto de entrada: aprova a sessão antes da request e do webhook, como no fluxo real.
  [`review_proof_request_usecase.ts:45`](../../src/modules/proof-request/app/review_proof_request_usecase.ts#L45)

- Transição nova, aceita `waiting_user` e `opened`, no-op em terminal; `approveByUser` intacto.
  [`ProofSession.ts:82`](../../src/shared/domain/entities/ProofSession.ts#L82)

**Acesso à sessão pela request**

- Nova porta no domínio.
  [`ProofSessionRepository.ts:12`](../../src/shared/domain/interfaces/repositories/ProofSessionRepository.ts#L12)

- Implementação Supabase; `order + limit 1` porque `proof_request_id` não é UNIQUE.
  [`SupabaseProofSessionRepository.ts:38`](../../src/shared/infra/repositories/SupabaseProofSessionRepository.ts#L38)

- Composition root injeta o repositório de sessão.
  [`review_proof_request_presenter.ts:9`](../../src/modules/proof-request/app/review_proof_request_presenter.ts#L9)

**Testes**

- Matriz I/O: estados da sessão, sem sessão, terminais, reject, ordem e guards.
  [`review-proof-request.dynamic.test.ts:380`](../../tests/unit/story-7-5/review-proof-request.dynamic.test.ts#L380)
