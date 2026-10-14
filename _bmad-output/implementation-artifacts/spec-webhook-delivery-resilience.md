---
title: 'Entrega de webhook resiliente em ambiente serverless'
type: bugfix
created: '2026-10-13'
status: done
baseline_commit: d9b3ff1176a22ddc84ab2e11f98d577ea332198d
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Em produção (AWS Amplify SSR / Lambda) o log `[webhook] delivery error ... error=fetch failed` aparece com frequência: os call sites disparam `DeliverWebhookUseCase.execute()` sem `await`, e o runtime congela a execução depois da resposta HTTP, matando o `fetch` em andamento. Além disso o log esconde a causa real (`error.cause`) e não há retry.

**Approach:** Aguardar a entrega do webhook (`await`) nos 4 call sites antes de retornar, tornar `execute()` resiliente com retry/backoff para falhas de rede e enriquecer o log com `error.cause` e `webhookUrl`.

## Boundaries & Constraints

**Always:** `execute()` nunca lança (erros logados e engolidos). O corpo do webhook continua sem VC/VP/DID/nonce/PII. Assinatura e headers `X-YaID-Signature`/`X-YaID-Timestamp` inalterados; cada tentativa reenvia o mesmo corpo e a mesma assinatura. Retry apenas para falhas de rede (`fetch` lançou, inclusive timeout); respostas HTTP (2xx/4xx/5xx) não geram retry e mantêm o log `delivery failed`.

**Ask First:** Trocar `await` por `after()`/`waitUntil` ou fila (SQS); alterar o contrato público de `DeliverWebhookInput`.

**Never:** Importar `next/*` em use cases; mudar o formato do payload; adicionar dependências; alterar o `WebhookSigner`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sucesso | endpoint responde 2xx | 1 chamada a `fetch`, sem log de erro | N/A |
| Falha transitória | 1ª tentativa lança `fetch failed`, 2ª responde 2xx | 2 chamadas, entrega concluída | log `warn` da tentativa falha |
| Falha persistente | todas as tentativas lançam | 3 tentativas com backoff; `execute()` resolve | `console.error` `delivery error` com `webhookUrl`, `attempts` e `cause` (code/message) |
| HTTP não-2xx | endpoint responde 500 | 1 chamada, sem retry | `delivery failed` como hoje |
| Sem webhookUrl | app sem URL | nenhuma chamada a `fetch` | N/A |

</frozen-after-approval>

## Code Map

- `src/modules/webhook/app/deliver_webhook_usecase.ts` -- envia o webhook; recebe retry, log de `cause`/`webhookUrl`
- `src/modules/proof-session/app/get_proof_session_usecase.ts:48` -- dispara webhook EXPIRED
- `src/modules/proof-session/app/cancel_proof_session_usecase.ts:46` -- dispara webhook REJECTED
- `src/modules/presentation/app/verify_presentation_usecase.ts:343` -- helper `fireWebhook` (APPROVED/REJECTED), chamado nas linhas 117 e 335
- `src/modules/proof-request/app/review_proof_request_usecase.ts:48` -- dispara webhook na revisão manual
- `tests/unit/story-6-1/webhook-delivery.test.mjs` -- testes estáticos (regex sobre fonte) do Story 6.1
- `tests/unit/story-7-5/review-proof-request.dynamic.test.ts`, `tests/unit/story-9-2/verify-presentation-vc-jwt.dynamic.test.ts` -- fakes de `DeliverWebhookUseCase`

## Tasks & Acceptance

**Execution:**
- [ ] `src/modules/webhook/app/deliver_webhook_usecase.ts` -- extrair `sendWithRetry` (3 tentativas, backoff 500ms/1500ms, timeout por tentativa 5s) e logar `cause`, `webhookUrl`, `attempts` -- cobre a causa de `fetch failed` e falhas transitórias
- [ ] 4 call sites listados no Code Map -- substituir fire-and-forget por `await this.deliverWebhook.execute(...)`; `fireWebhook` passa a ser `async` e é aguardado -- evita congelamento do Lambda
- [ ] `tests/unit/story-6-1/webhook-delivery.test.mjs` -- ajustar asserts que dependam do formato antigo (`fire-and-forget`, regex de log)
- [ ] `tests/unit/story-6-1/` -- novo teste dinâmico de `DeliverWebhookUseCase` com `fetch` mockado cobrindo a I/O Matrix
- [ ] testes 7-5 e 9-2 -- ajustar o caso "fire-and-forget" para refletir que o use case aguarda e não rejeita

**Acceptance Criteria:**
- Given um use case com webhook configurado, when ele conclui, then a entrega já terminou (a promise de `execute()` foi aguardada antes do retorno).
- Given `fetch` lançando em todas as tentativas, when `execute()` roda, then resolve sem lançar e o log contém `webhookUrl`, `attempts` e `cause`.
- Given `npm test`, when executado, then passa sem falhas.

## Spec Change Log

## Design Notes

Latência: pior caso ≈ 5s×3 + 2s de backoff ≈ 17s, só quando o endpoint do cliente está fora do ar. No caminho feliz o custo é uma requisição. Se isso incomodar na resposta ao wallet, a alternativa é `after()` do Next 16 injetado por porta (fora de escopo; ver Ask First).

`error.cause` do undici traz `code` (`ECONNRESET`, `ENOTFOUND`, `UND_ERR_CONNECT_TIMEOUT`...).

## Verification

**Commands:**
- `npm test` -- expected: todos os testes passam
- `npx tsc --noEmit` -- expected: sem erros

## Suggested Review Order

**Entrega resiliente (ponto de entrada)**

- Loop de retry só para falha de rede; HTTP não-2xx não é retentado.
  [`deliver_webhook_usecase.ts:85`](../../src/modules/webhook/app/deliver_webhook_usecase.ts#L85)

- `error.cause` (inclui AggregateError) revela a causa real de `fetch failed`.
  [`deliver_webhook_usecase.ts:19`](../../src/modules/webhook/app/deliver_webhook_usecase.ts#L19)

**Call sites aguardam a entrega (evita congelamento do Lambda)**

- Helper `fireWebhook` agora é async e aguardado nas duas chamadas.
  [`verify_presentation_usecase.ts:335`](../../src/modules/presentation/app/verify_presentation_usecase.ts#L335)

- Revisão manual aguarda o webhook antes de retornar.
  [`review_proof_request_usecase.ts:49`](../../src/modules/proof-request/app/review_proof_request_usecase.ts#L49)

- Cancelamento aguarda o webhook REJECTED.
  [`cancel_proof_session_usecase.ts:48`](../../src/modules/proof-session/app/cancel_proof_session_usecase.ts#L48)

- Expiração via GET aguarda o webhook EXPIRED.
  [`get_proof_session_usecase.ts:50`](../../src/modules/proof-session/app/get_proof_session_usecase.ts#L50)

**Testes**

- Teste dinâmico cobre a matriz de I/O com `fetch` mockado.
  [`deliver-webhook-retry.dynamic.test.ts:28`](../../tests/unit/story-6-1/deliver-webhook-retry.dynamic.test.ts#L28)

- Asserts estáticos trocados de fire-and-forget para await.
  [`webhook-delivery.test.mjs:227`](../../tests/unit/story-6-1/webhook-delivery.test.mjs#L227)
