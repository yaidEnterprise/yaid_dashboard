# Story 5.8: Correspondência entre Claim Apresentada e Proof Type Solicitado

Status: done

> Origem: Sprint Change Proposal 2026-07-28 (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md`).
> Supersede a Regra 5 da Story 5.5 (`_bmad-output/implementation-artifacts/stories/5-5-verificacao-de-verifiable-presentation.md`).
>
> ⚠️ **Fecha o acoplamento de entrega com a Story 5.7 (`status: done`).** A 5.7 consolidou as claims
> na emissão (`{ personhood: true, ageOver18: <boolean> }`), mas foi entregue **sem** esta story por
> decisão consciente do usuário. Até esta story ser implementada, o sistema está num estado
> intermediário aceito deliberadamente, não pronto para liberação: `verify_presentation_usecase`
> ainda só valida que as claims são booleanas, então a credencial de um menor de idade
> (`ageOver18: false`) **aprova** hoje um pedido de `age_over_18`. Esta story fecha essa lacuna.

## Story

Como empresa parceira,
Quero que uma aprovação signifique que a pergunta que eu fiz foi respondida afirmativamente,
Para que eu não libere acesso com base numa credencial que responde outra coisa.

## Acceptance Criteria

1. **Given** uma `POST /api/presentations/verify` cuja sessão pertence a uma `proof_request`
   **When** o `verify_presentation_usecase` executa
   **Then** a `proof_request` associada é carregada e seu `proof_type` é lido
   **And** o `proof_type` é mapeado para a chave de claim correspondente
   **And** a Regra 5 passa a exigir: a claim mapeada **existe na VC** e seu valor é **exatamente `true`**

2. **Given** uma `proof_request` de `age_over_18` e uma VC com `ageOver18: false`
   **When** a verificação executa
   **Then** retorna `{ valid: false }` e a `proof_request` transiciona para `rejected`

3. **Given** uma `proof_request` de `age_over_18` e uma VC sem a chave `ageOver18`
   **When** a verificação executa
   **Then** retorna `{ valid: false }` — ausência da claim nunca é tratada como aprovação

4. **Given** uma `proof_request` de `personhood` e uma VC com `personhood: true, ageOver18: false`
   **When** a verificação executa
   **Then** retorna `{ valid: true }` — a claim não solicitada é irrelevante para o resultado

5. **Given** a validação original de que todas as claims são booleanas
   **When** esta story é aplicada
   **Then** ela é **preservada** — a correspondência é uma exigência adicional, não substituta

6. **Given** as demais regras da Story 5.5 (1–4 e 6–11)
   **When** esta story é aplicada
   **Then** todas permanecem em vigor e na mesma ordem

7. **Given** o disparo de webhook após a transição de status em `verify_presentation_usecase`
   **When** o webhook é montado
   **Then** o campo `proofType` carrega o `proof_type` real da `proof_request`, substituindo o valor
   hardcoded `"verification"`

## Tasks / Subtasks

- [x] Task 1: Carregar a `proof_request` uma única vez e propagar seu `proof_type` real (AC: #1, #7)
  - [x] Em `src/modules/presentation/app/verify_presentation_usecase.ts`, logo após
    `const proofRequestId = session.proofRequestId;` (linha ~101), chamar
    `await this.requestRepo.findById(proofRequestId)` e guardar o resultado.
  - [x] Se `findById` retornar `null` (integridade referencial quebrada — não deveria acontecer dado
    o FK `proof_session.proof_request_id`), retornar `{ valid: false }` imediatamente, sem chamar
    `updateStatus` nem disparar webhook (mesmo padrão defensivo já usado para "sessão não
    encontrada" na linha 97-99 — não há `proof_request` para atualizar).
  - [x] Extrair `const proofType = proofRequestResult.request.proofType;` (string `"personhood"` |
    `"age_over_18"`, já validada na criação via `create_proof_request_viewmodel.ts:5`).
  - [x] Este `proofType` é reaproveitado tanto pela Regra 5 estendida (Task 2) quanto pelo webhook
    (Task 3) — uma única leitura, sem chamada duplicada ao repositório.

- [x] Task 2: Estender a Regra 5 com a correspondência claim ↔ proof_type (AC: #1, #2, #3, #4, #5, #6)
  - [x] Importar `ProofType, PROOF_TYPE_CLAIM_KEY` de `@/shared/domain/enums/ProofType` no topo do
    arquivo.
  - [x] **Não remover nem mover** o bloco existente da Regra 5 (linhas ~228-235, verificação de que
    todas as claims são booleanas) — ele continua exatamente onde está (AC #5, #6).
  - [x] Imediatamente **depois** desse bloco (ainda antes da Regra 6 — verificação do `vc.holder`),
    inserir a checagem de correspondência:
    ```ts
    const claimKey = PROOF_TYPE_CLAIM_KEY[proofType as ProofType];
    if (!claimKey || vc.claims[claimKey] !== true) {
      return reject();
    }
    ```
  - [x] `!claimKey` cobre defensivamente um `proof_type` fora do enum (não deveria ocorrer — mesma
    nota de integridade da Task 1); `vc.claims[claimKey] !== true` cobre tanto claim ausente
    (`undefined !== true`) quanto claim `false` — ambos rejeitam, nunca aprovam (AC #2, #3).
  - [x] Não alterar a ordem nem o conteúdo das Regras 1-4 e 6-11 (AC #6) — apenas a Regra 5 ganha
    esta extensão.

- [x] Task 3: Substituir o `proofType` hardcoded do webhook pelo valor real (AC: #7)
  - [x] Mudar a assinatura do método privado `fireWebhook` (linha ~293) para receber `proofType:
    string` como terceiro parâmetro, e usá-lo no lugar do literal `"verification"` (linha 299) ao
    montar o input de `this.deliverWebhook.execute(...)`.
  - [x] Atualizar as duas chamadas existentes — dentro do closure `reject()` (linha ~106) e no fluxo
    de sucesso (linha ~285) — para passar o `proofType` carregado na Task 1.
  - [x] **Fora de escopo, não tocar:** `cancel_proof_session_usecase.ts:50` tem o mesmo literal
    `"verification"` hardcoded, mas pertence a um use case e endpoint diferentes (`POST
    /api/proof-sessions/{token}/cancel`, Story 5.6) — nenhuma AC desta story cobre esse fluxo. Deixar
    como está; se for relevante, registrar como item de code-review defer, não corrigir aqui.

- [x] Task 4: Atualizar o guia E2E Postman (responsabilidade do desenvolvedor listada no handoff do
  Sprint Change Proposal §6, deliberadamente adiada até esta story — ver nota de escopo abaixo)
  - [x] Em `docs/e2e-happy-path-postman.md` §4 (linhas ~193-204): remover `proofType` do JSON de body
    do exemplo (`{ "documentImage": "{{docImage}}", "proofType": "personhood", "bodySignature":
    "{{bodySignature}}" }` → sem o campo `proofType`) e do payload assinado no pre-request script
    (`edSign(docImage + ':personhood')` → `edSign(docImage)`), refletindo a mudança de contrato já
    entregue pela Story 5.7 (`proofType` não é mais aceito em `POST /api/credentials/issue`).
  - [x] Não alterar o body de `POST /api/proof-requests` no §3 (linha ~160, `{ "proofType":
    "personhood" }`) — esse é o `proof_type` da *proof request*, endpoint e contrato diferentes,
    inalterado por esta story.
  - [x] Não é necessário alterar mais nada no restante do guia — o resto do fluxo (§5, §6, §7)
    continua igual, e o resultado esperado (`valid: true`) permanece válido com claims consolidadas.

- [x] Task 5: Criar testes unitários novos em `tests/unit/story-5-8/`
  - [x] Seguir o padrão estrutural dos testes existentes (existência de arquivo + asserções estáticas
    de conteúdo via regex + `tsc --noEmit` como último teste) — ver
    `tests/unit/story-5-5/presentation-verification.test.mjs` como referência direta.
  - [x] Cobrir: import de `ProofType`/`PROOF_TYPE_CLAIM_KEY` no use case; chamada a
    `requestRepo.findById` para carregar a `proof_request`; presença da checagem
    `PROOF_TYPE_CLAIM_KEY[...]` e `!== true` (ou equivalente) após o bloco de validação booleana
    existente; ausência do literal `"verification"` hardcoded no use case (deve ter sido substituído
    por uma variável); presença da checagem `!claimKey` como guarda defensiva.
  - [x] Rodar toda a suíte de `tests/unit/story-5-5/` e `tests/unit/story-5-7/` após a mudança — nada
    deve quebrar (5.7 não referencia `verify_presentation_usecase.ts`; 5.5 só testa que as regras
    1-11 existem, sem fixar a posição exata de cada `reject()`, mas confirme antes de finalizar).

### Escopo explicitamente fora desta story

- `cancel_proof_session_usecase.ts` (Story 5.6) — mesmo literal `"verification"` hardcoded, use case
  e endpoint diferentes. Não tocar (ver Task 3).
- `DeliverWebhookUseCase` (`src/modules/webhook/app/deliver_webhook_usecase.ts`) — interface
  `DeliverWebhookInput.proofType` não muda; apenas o **valor** passado por
  `verify_presentation_usecase` deixa de ser hardcoded. Não alterar a assinatura do use case de
  webhook.
- Migração para VC-JWT (Epic 9) — fora de escopo, não tocar formato de serialização/assinatura.
- Epic 10 (higiene de chaves de teste) — não tocar `ISSUER_PRIVATE_KEY`/fallback em nenhum arquivo.
- `CONTEXT.md` já documenta a regra de correspondência corretamente desde o replanejamento de
  2026-07-28 (linha 37: *"A aprovação exige correspondência entre a claim apresentada e o
  `proof_type` pedido..."*) — nenhuma edição necessária lá.

### Review Findings

**Defer (pré-existentes, fora de escopo desta story):**
- [x] [Review][Defer] `requestRepo.findById(proofRequestId)` não tem try/catch: se retornar `null` (integridade referencial quebrada), o método sai por `{ valid: false }` sem chamar `updateStatus` nem disparar webhook (sem rastro de auditoria); se a chamada lançar (erro transitório de rede/DB), a exceção não é capturada localmente e só é convertida em 500 genérico na borda da rota (`app/api/presentations/verify/route.ts` → `handleHttpError`), diferente do padrão gracioso `reject()` usado nas Regras 9/10 para chamadas de blockchain. Padrão pré-existente no mesmo método: a chamada irmã `sessionRepo.findByTokenHash` (linha 95) já é igualmente desprotegida — adicionar try/catch só ao `findById` novo criaria uma inconsistência local; corrigir ambas está fora do escopo desta story (nenhuma AC cobre resiliência a falha de repositório) [src/modules/presentation/app/verify_presentation_usecase.ts:106-110] — deferred, pre-existing pattern
- [x] [Review][Defer] `cancel_proof_session_usecase.ts:50` mantém o mesmo literal `"verification"` hardcoded no payload do webhook — use case e endpoint diferentes (Story 5.6, `POST /api/proof-sessions/{token}/cancel`), nenhuma AC desta story cobre esse fluxo. Já identificado e explicitamente deixado fora de escopo no Dev Notes/Task 3 desta própria story [src/modules/proof-session/app/cancel_proof_session_usecase.ts:50] — deferred, pre-existing, already documented
- [x] [Review][Defer] Suíte de testes é 100% estática (existência de arquivo + regex sobre o source + `tsc --noEmit`), nenhum teste dinâmico/comportamental instancia o use case com repositórios mockados para verificar o `{ valid: true/false }` retornado em runtime nem a transição real de `proof_request.status`. Padrão sistêmico em todas as stories desde a 5.4/5.5, já identificado e deferido no code review da própria Story 5.7 como "pré-existente, não específico do diff" — não introduzido por esta story [tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs] — deferred, pre-existing, systemic

**Dismissed (12):** permissões amplas/entradas de debug avulsas em `.claude/settings.json` (4 achados — arquivo não faz parte do diff desta story, mudança de sessão anterior não relacionada); cast `PROOF_TYPE_CLAIM_KEY[proofType as ProofType]` "mascarando" segurança de tipos (é exatamente o padrão documentado no Dev Notes — a guarda em runtime `!claimKey` é a defesa intencional, não um descuido); divergência entre o guia Postman e uma suposta coleção `.postman_collection.json` (nenhum arquivo de coleção existe no repositório — falso positivo); reformatação do `sprint-change-proposal-2026-07-28.md` sobre status de 10-1/10-2 (descreve o estado da fase de planejamento anterior, não uma alegação sobre o diff desta story); duplicação de prosa entre `CONTEXT.md`/`architecture.md`/`epics.md`/`prd.md` e novo `docs/PROJECT-OVERVIEW.md` (nenhum desses arquivos faz parte da entrega de código da Story 5.8 — mudanças de planejamento pré-existentes de sessão anterior); resultados de teste auto-reportados no Dev Agent Record (convenção já estabelecida pelas stories anteriores, valores conferidos de forma independente pelo Acceptance Auditor e nesta sessão); ausência de log quando `!claimKey` dispara (consistente com o padrão do arquivo inteiro — nenhum outro caminho de `reject()` loga motivo, por design, para não vazar informação); fragilidade da regex do teste de assinatura do `fireWebhook` a reformatação (inerente à convenção de teste estático já usada em todas as stories, aceita anteriormente).

## Dev Notes

### Arquivo principal a modificar

`src/modules/presentation/app/verify_presentation_usecase.ts` (lido por completo durante o
planejamento desta story — 307 linhas). Estado atual relevante:

- Linha 101: `const proofRequestId = session.proofRequestId;` — ponto de inserção da Task 1.
- Linhas 103-108: closure `reject()` — chama `updateStatus` e `fireWebhook`. Precisa do `proofType`
  em escopo (fechamento sobre a variável da Task 1) e da assinatura atualizada de `fireWebhook`
  (Task 3).
- Linhas 228-235: Regra 5 atual (`typeof vc.claims !== "object" || ... || Object.values(vc.claims
  ).some((v) => typeof v !== "boolean")`) — **preservar linha a linha**, apenas inserir a nova
  checagem logo depois (Task 2).
- Linha 285: `this.fireWebhook(proofRequestId, ProofRequestStatus.APPROVED);` — fluxo de sucesso,
  precisa passar `proofType` (Task 3).
- Linhas 290-305: método privado `fireWebhook` — assinatura ganha um terceiro parâmetro; linha 299
  (`proofType: "verification"`) usa o parâmetro em vez do literal.

### Por que carregar a `proof_request` uma vez só, cedo

O use case hoje só guarda `proofRequestId` (string) vindo da sessão — nunca carrega a entidade
`ProofRequest` completa. Esta story precisa do `proof_type` real em **dois** lugares: a checagem de
correspondência (Regra 5 estendida) e o payload do webhook (em **todo** caminho de saída, inclusive
os `reject()` das Regras 1-4 e 6-11, não só a Regra 5). Por isso a leitura acontece uma única vez,
logo após obter `proofRequestId`, e o valor fica em escopo (closure) para todo o resto do método —
evita tanto uma segunda chamada ao repositório quanto duplicar o hardcode em múltiplos pontos.

`ProofRequestRepository.findById` já existe e é o mesmo método usado por
`GetProofRequestUseCase`/`ListProofRequestsUseCase` — não criar um novo método de repositório.
Retorna `ProofRequestWithApp | null`, onde `result.request.proofType` é a string `"personhood"` |
`"age_over_18"` (a mesma validada por `create_proof_request_viewmodel.ts:5` via
`z.enum(["personhood", "age_over_18"])` — os valores já batem 1:1 com `ProofType.PERSONHOOD` /
`ProofType.AGE_OVER_18`).

### Vocabulário canônico e o enum `ProofType` (já existe, criado pela Story 5.7)

`src/shared/domain/enums/ProofType.ts` já foi criado na Story 5.7 e **não precisa ser recriado**:

```ts
export enum ProofType {
  PERSONHOOD = "personhood",
  AGE_OVER_18 = "age_over_18",
}
export const PROOF_TYPE_CLAIM_KEY: Record<ProofType, "personhood" | "ageOver18"> = {
  [ProofType.PERSONHOOD]: "personhood",
  [ProofType.AGE_OVER_18]: "ageOver18",
};
```

Esta story é o **primeiro consumidor real** de `PROOF_TYPE_CLAIM_KEY` do lado da verificação (a
Story 5.7 só o consumiu do lado da emissão). É o único lugar do mapeamento `age_over_18` ↔
`ageOver18` — não duplicar strings literais para isso.

### Por que a checagem cobre "claim ausente" e "claim `false`" com uma única expressão

`vc.claims` é `Record<string, unknown>` (tipo genérico pré-existente, não mexer nesta story — ver
Dev Notes da 5.7). `vc.claims[claimKey]` quando a chave não existe retorna `undefined` em
JavaScript/TypeScript — `undefined !== true` já é `true`, então a mesma condição `!== true` rejeita
tanto claim ausente (AC #3) quanto claim presente e `false` (AC #2), sem precisar de um `in` check
separado. Isso é intencional e suficiente; não adicionar uma checagem `hasOwnProperty` redundante.

### O que muda vs. o que NÃO muda

**Muda:** a Regra 5 ganha uma checagem adicional (correspondência claim ↔ proof_type); o `fireWebhook`
passa a receber o `proof_type` real em vez do literal `"verification"`; o guia E2E Postman perde o
campo `proofType` do exemplo de emissão (Task 4).

**Não muda:** a ordem e o conteúdo das Regras 1-4 e 6-11; a checagem original de que todas as claims
são booleanas (continua no mesmo lugar, ela mesma); o contrato de `POST /api/presentations/verify`
(mesmo body, mesma resposta `{ valid: boolean }`); `updateStatus`/`approveByUser`; a assinatura de
`DeliverWebhookUseCase.execute` (`DeliverWebhookInput` já tem `proofType: string` — só o valor
passado muda); `cancel_proof_session_usecase.ts` (fora de escopo, ver Task 3).

### Testes — padrão do projeto

Testes são `node:test` + `node:assert/strict` em arquivos `.test.mjs`, com três categorias:
existência de arquivo, verificação estática de conteúdo via regex sobre o source, e compilação `tsc
--noEmit` como último teste (com `STAGE: "TEST"` no env). Ver
`tests/unit/story-5-5/presentation-verification.test.mjs` como referência direta — é o teste
estrutural do mesmo arquivo que esta story modifica, não inventar um padrão novo. A suíte completa
hoje tem 583 testes passando (após a Story 5.7); rodar `npm test` ao final e confirmar que o total
sobe sem nenhuma regressão.

### Project Structure Notes

Nenhum arquivo novo em `src/` — apenas modificação de
`src/modules/presentation/app/verify_presentation_usecase.ts`. Novo diretório de teste
`tests/unit/story-5-8/` (padrão já estabelecido por todas as stories anteriores). Edição de
`docs/e2e-happy-path-postman.md` (documentação, não código). Nenhuma migration, nenhuma mudança de
schema de banco, nenhuma mudança de rota.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8] — AC originais
- [Source: _bmad-output/planning-artifacts/architecture.md#Semântica das claims (Sprint Change 2026-07-28)] — regra de correspondência obrigatória, linha ~210-220
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md §5.2, §6] — sequenciamento (5.7 → 5.8 → Postman/E2E), handoff de responsabilidade do desenvolvedor
- [Source: CONTEXT.md linha 37, 47-54] — vocabulário canônico já documentado, glossário de Proof Request
- [Source: src/modules/presentation/app/verify_presentation_usecase.ts] — arquivo principal, lido por completo
- [Source: src/shared/domain/enums/ProofType.ts] — enum e mapeamento já existentes (criados pela Story 5.7)
- [Source: src/shared/domain/interfaces/repositories/ProofRequestRepository.ts] — `findById` já existente, reaproveitado
- [Source: _bmad-output/implementation-artifacts/stories/5-7-consolidacao-de-claims-na-emissao.md] — story anterior, contexto de acoplamento e Dev Notes sobre claims consolidadas
- [Source: tests/unit/story-5-5/presentation-verification.test.mjs] — padrão de teste do arquivo modificado
- [Source: docs/e2e-happy-path-postman.md §3, §4] — guia E2E a atualizar (Task 4)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `node --test tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs` — falhas confirmadas contra o código pré-mudança (red phase: sem import de `ProofType`, sem `findById`/`proofType` real, sem checagem `PROOF_TYPE_CLAIM_KEY`, literal `"verification"` ainda presente), depois 19/19 passando após a implementação (inclui `tsc --noEmit`).
- `node --test tests/unit/story-5-5/presentation-verification.test.mjs` — 27/27 passando, sem regressão nas regras 1-11 pré-existentes.
- `node --test tests/unit/story-5-7/claim-consolidation.test.mjs` — 17/17 passando, confirma que a Story 5.7 (emissão) não foi afetada.
- `npm test` (suíte completa) — 604/604 passando (583 pré-existentes + 19 novos da 5.8, sem regressões, sem falhas de `tsc`).
- `npx eslint src/modules/presentation/app/verify_presentation_usecase.ts tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs` — sem findings.

### Completion Notes List

- `verify_presentation_usecase.ts` agora carrega a `proof_request` associada via `requestRepo.findById(proofRequestId)` uma única vez, logo após obter o `proofRequestId` da sessão — o `proof_type` real fica em escopo (closure) para o resto do método.
- A Regra 5 original (claims booleanas) permanece linha a linha inalterada; imediatamente depois dela foi inserida a checagem de correspondência: `PROOF_TYPE_CLAIM_KEY[proofType as ProofType]` mapeia o `proof_type` para a chave de claim, e `vc.claims[claimKey] !== true` rejeita tanto claim ausente quanto `false` — nunca trata ausência como aprovação.
- As Regras 1-4 e 6-11 permanecem exatamente na mesma ordem e conteúdo — apenas a Regra 5 ganhou a extensão.
- O literal hardcoded `"verification"` do payload de webhook foi substituído pelo `proof_type` real em ambos os pontos de disparo (`reject()` e fluxo de sucesso), via novo parâmetro `proofType: string` em `fireWebhook`. A interface `DeliverWebhookInput` do `DeliverWebhookUseCase` não foi alterada — só o valor passado por este use case mudou.
- `cancel_proof_session_usecase.ts` (Story 5.6) mantém o mesmo literal `"verification"` hardcoded — deliberadamente fora de escopo (use case e endpoint diferentes, nenhuma AC desta story cobre o fluxo de cancelamento).
- `docs/e2e-happy-path-postman.md` §4 atualizado: removido `proofType` do body de exemplo de `POST /api/credentials/issue` e do payload assinado do pre-request script (`edSign(docImage + ':personhood')` → `edSign(docImage)`), refletindo o contrato já entregue pela Story 5.7. O `proofType` do §3 (`POST /api/proof-requests`) foi mantido — é um campo de contrato diferente, inalterado.
- Enum `ProofType`/`PROOF_TYPE_CLAIM_KEY` (`src/shared/domain/enums/ProofType.ts`) reaproveitado sem alterações — criado pela Story 5.7, esta story é seu primeiro consumidor do lado da verificação.
- **Fecha o acoplamento de entrega 5.7/5.8:** com esta story, `verify_presentation_usecase` passa a exigir a claim correspondente ao `proof_type` da `proof_request`, eliminando a lacuna em que uma credencial de menor de idade (`ageOver18: false`) aprovaria um pedido de `age_over_18`.

### File List

**Novos:**
- `tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs`
- `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts` (QA — teste dinâmico/comportamental via `tsx`, instancia o use case real com dependências fake)

**Modificados:**
- `src/modules/presentation/app/verify_presentation_usecase.ts` — import de `ProofType`/`PROOF_TYPE_CLAIM_KEY`; carregamento da `proof_request` via `requestRepo.findById`; extensão da Regra 5 com a checagem de correspondência claim ↔ proof_type; `fireWebhook` recebe `proofType` real em vez do literal `"verification"`
- `docs/e2e-happy-path-postman.md` — §4 (emissão de VC) sem `proofType` no body e no payload assinado, refletindo o contrato da Story 5.7
- `package.json` (QA) — nova devDependency `tsx@^4.23.1`; novo script `test:dynamic` (`tsx --test "tests/unit/**/*.dynamic.test.ts"`) encadeado ao `test` via `&&`; `test:story:5.8` roda estáticos + dinâmicos em sequência
- `package-lock.json` (QA) — apenas adições, resultantes da instalação do `tsx`

## Change Log

- **2026-07-31** — Implementação completa da Story 5.8: `verify_presentation_usecase` passa a carregar a `proof_request` associada e exigir que a claim mapeada do `proof_type` exista e seja exatamente `true` (extensão da Regra 5), fechando o acoplamento de entrega com a Story 5.7. Webhook passa a carregar o `proof_type` real em vez do literal `"verification"`. Guia E2E Postman atualizado para o contrato de emissão sem `proofType`. 19 novos testes estruturais; suíte completa (604 testes) passando sem regressões. Status → `review`.
- **2026-07-31** — Code review (3 camadas: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0 decision-needed, 0 patch, 3 defer (registrados em `deferred-work.md`), 12 dismissed (ruído/fora de escopo/falso positivo). Todas as 7 ACs confirmadas satisfeitas pelo Acceptance Auditor, sem violações. Status → `test`.
- **2026-07-31** — QA: geração de testes unitários formais. Por decisão explícita do usuário, adicionada a devDependency `tsx` para viabilizar o primeiro teste dinâmico/comportamental do projeto (`verify-presentation-usecase.dynamic.test.ts`), instanciando `VerifyPresentationUseCase` real com repositórios fake e VP/VC assinados de verdade — fecha a lacuna "suíte 100% estática" apontada no code review. 6 novos testes dinâmicos, verificados por mutação (desabilitar a checagem de correspondência faz os testes de AC#2/AC#3 falharem). Suíte completa: 610/610 passando (604 estáticos + 6 dinâmicos). Status → `done`.
