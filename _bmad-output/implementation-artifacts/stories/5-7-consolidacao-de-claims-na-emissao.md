# Story 5.7: Consolidação de Claims na Emissão de Credencial

Status: done

> Origem: Sprint Change Proposal 2026-07-28 (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md`).
> Supersede parte da Story 5.4 (`_bmad-output/implementation-artifacts/stories/5-4-emissao-de-verifiable-credential.md`).
>
> ⚠️ **Restrição de entrega — decisão do usuário, 2026-07-30.** Esta story está marcada no
> planejamento como **entrega acoplada à Story 5.8** (5.7 sem 5.8 faz a credencial de um menor de
> idade aprovar um pedido de `age_over_18`, porque `verify_presentation_usecase` hoje só valida que
> as claims são booleanas, nunca se a claim pedida corresponde ao `proof_type`). O usuário optou
> **conscientemente** por implementar apenas a 5.7 nesta sessão. **O código resultante não deve ser
> considerado pronto para liberação/deploy até a Story 5.8 ser implementada** — é um estado
> intermediário aceito deliberadamente, não um erro do desenvolvedor.

## Story

Como holder com app mobile,
Quero que minha credencial responda às duas perguntas em uma única emissão,
Para que eu não precise enviar meu documento mais de uma vez.

## Acceptance Criteria

1. **Given** uma chamada `POST /api/credentials/issue` autenticada por DID
   **When** a emissão é processada com sucesso
   **Then** a VC é construída com **ambas** as claims: `{ personhood: true, ageOver18: <boolean> }`
   **And** `personhood` é sempre `true` — a leitura bem-sucedida do documento é a própria evidência
   **And** `ageOver18` é `true` ou `false`, derivado da data de nascimento lida no documento
   **And** ambas permanecem estritamente booleanas — nenhuma PII entra na VC

2. **Given** um holder cuja data de nascimento indica **menos de 18 anos**
   **When** a emissão é processada
   **Then** a emissão **conclui com sucesso** (HTTP 201)
   **And** a VC carrega `{ personhood: true, ageOver18: false }`
   **And** **não** é retornado HTTP 422 — não houve falha de processamento

3. **Given** o contrato de entrada da rota
   **When** o body é validado
   **Then** aceita `{ documentImage, bodySignature }` — o campo `proofType` **não é mais aceito**
   **And** o payload assinado pelo holder passa a ser apenas `documentImage`
   **And** a validação da assinatura ocorre antes de qualquer outra operação, como na Story 5.4

4. **Given** um documento cujo OCR falha (ilegível, ou sem nome/CPF/data de nascimento)
   **When** o processamento é executado
   **Then** retorna HTTP 422 com `{ error: "Document processing failed" }`
   **And** este é o **único** caminho que produz 422 relacionado ao documento

5. **Given** uma data de nascimento presente mas não parseável para data válida
   **When** o cálculo de idade é executado
   **Then** retorna HTTP 422 — não é honesto afirmar `ageOver18: false` quando a idade é desconhecida

6. **Given** o fluxo existente de emissão (Story 5.4)
   **When** esta story é aplicada
   **Then** a validação da assinatura do body, o OCR em memória, o descarte de PII e o
   `registerDID` on-chain permanecem inalterados

## Tasks / Subtasks

- [x] Task 1: Criar enum compartilhado `ProofType` (AC: #1)
  - [x] Criar `src/shared/domain/enums/ProofType.ts` com `enum ProofType { PERSONHOOD = "personhood", AGE_OVER_18 = "age_over_18" }` (vocabulário `proof_type`/API), seguindo o padrão de `ProofRequestStatus.ts`
  - [x] No mesmo arquivo, exportar o mapeamento para a chave de claim camelCase da VC, ex.: `PROOF_TYPE_CLAIM_KEY: Record<ProofType, "personhood" | "ageOver18">` — único lugar do mapeamento `age_over_18` ↔ `ageOver18` (consumido também pela futura Story 5.8, fora de escopo aqui)

- [x] Task 2: Remover `proofType` do contrato de entrada (AC: #3)
  - [x] `src/modules/credential/app/issue_credential_viewmodel.ts`: remover o campo `proofType` de `IssueCredentialSchema` — schema passa a ser `{ documentImage: z.string().min(1), bodySignature: z.string().min(1) }`
  - [x] `src/modules/credential/app/issue_credential_controller.ts`: parar de repassar `proofType` ao `useCase.execute`
  - [x] `src/modules/credential/app/issue_credential_usecase.ts`: remover `proofType` de `IssueCredentialInput`

- [x] Task 3: Ajustar payload assinado pelo holder (AC: #3)
  - [x] Em `issue_credential_usecase.ts`, trocar `` `${documentImage}:${proofType}` `` por `documentImage` puro como payload assinado (linha ~83 do arquivo atual)

- [x] Task 4: Consolidar construção de claims (AC: #1, #2, #4, #5)
  - [x] Remover o branching atual por `proofType` (`if (proofType === "personhood") ... else if (proofType === "ageOver18") ... else 422`)
  - [x] Novo fluxo linear, sempre executado após OCR bem-sucedido:
    1. `personhood` = sempre `true`
    2. Parsear `ocrResult.birthDate` — se `isNaN(new Date(...).getTime())`, lançar `AppError("Document processing failed", 422, "UNPROCESSABLE_ENTITY")` (AC #5 — mesma mensagem/código do 422 de OCR, pois do ponto de vista do app mobile ambos são "não consegui extrair um documento processável")
    3. Calcular idade a partir da data de nascimento válida (mesma lógica de cálculo de idade já existente — reaproveitar, não reescrever)
    4. `ageOver18` = `age >= 18` (não lançar erro nem 422 quando `< 18` — apenas `false`)
    5. `claims = { [PROOF_TYPE_CLAIM_KEY[ProofType.PERSONHOOD]]: true, [PROOF_TYPE_CLAIM_KEY[ProofType.AGE_OVER_18]]: ageOver18 }`

- [x] Task 5: Atualizar `issue_credential_presenter.ts` se necessário (AC: #1–#6)
  - [x] Confirmar que nenhuma mudança de assinatura de construtor é necessária (o presenter não referencia `proofType`) — nenhuma alteração feita, confirmado

- [x] Task 6: Corrigir/atualizar testes estruturais quebrados pela mudança de contrato
  - [x] `tests/unit/story-5-4/credential-issuance.test.mjs` linha ~107-111 (`"Story 5.4 IssueCredentialUseCase verifies age is >= 18 for ageOver18"`) assume o comportamento antigo (branch por `proofType`, `age < 18` lançando erro). Ajustada essa asserção para refletir o novo comportamento (sem quebrar as demais asserções da 5.4 que continuam válidas — assinatura, OCR em memória, registro DID, códigos 401/422/502) — arquivo mantido, apenas a asserção obsoleta foi corrigida
  - [x] Rodada toda a suíte de `tests/unit/story-5-4/` e `tests/unit/story-5-5/` após a mudança — nada mais quebrou (5.5 não foi afetada — ela só lê `claims` como `Record<string, unknown>` genérico)

- [x] Task 7: Criar testes unitários novos em `tests/unit/story-5-7/`
  - [x] Seguir o padrão estrutural dos testes existentes (existência de arquivo + asserções estáticas de conteúdo via regex + `tsc --noEmit`), consistente com `tests/unit/story-5-4/` e `tests/unit/story-5-5/`
  - [x] Cobrir: schema sem `proofType`; claims sempre incluem `personhood: true` e `ageOver18` booleano; ausência de branch por `proofType` no use case; payload assinado é `documentImage` puro (sem `:proofType`); 422 tanto para OCR falho quanto para data de nascimento não parseável; ausência de 422 para idade < 18 isolada (nenhum `age < 18` lançando erro no caminho novo)

### Review Findings

**Patch (applied):**
- [x] [Review][Patch] Adicionar `.strict()` ao `IssueCredentialSchema` para rejeitar campos desconhecidos (ex.: um `proofType` remanescente de um cliente antigo) em vez de descartá-los silenciosamente — alinha o schema à literalidade da AC #3 ("o campo `proofType` não é mais aceito") [src/modules/credential/app/issue_credential_viewmodel.ts]
- [x] [Review][Patch] Documentar por que `PROOF_TYPE_CLAIM_KEY` mapeia para camelCase (`ageOver18`) enquanto o valor do enum é snake_case (`age_over_18`) — é intencional (vocabulário canônico: `proof_type` na API é snake_case, chave de claim na VC é camelCase), mas merecia um comentário para não parecer inconsistência [src/shared/domain/enums/ProofType.ts]

**Defer (pré-existentes, fora de escopo desta story):**
- [x] [Review][Defer] Payload assinado (`documentImage` puro) não tem domain separator/nonce — replayable se o mesmo valor assinado for reaproveitado; pré-existente desde a Story 5.4 (o antigo `:${proofType}` não funcionava como nonce), não introduzido pela consolidação de claims [src/modules/credential/app/issue_credential_usecase.ts:83] — deferred, pre-existing
- [x] [Review][Defer] Fallback hardcoded `test-issuer-private-key` → chave privada conhecida publicamente permanece sem guarda fora do stage TEST; pré-existente, já mapeado como escopo do Epic 10 (Story 10.2) [src/modules/credential/app/issue_credential_usecase.ts:143-146] — deferred, pre-existing
- [x] [Review][Defer] `claims` tipado como `Record<string, boolean>` genérico, sem garantia em tempo de compilação restrita às duas chaves conhecidas; forma de tipo pré-existente desde a Story 5.4 [src/modules/credential/app/issue_credential_usecase.ts:20] — deferred, pre-existing
- [x] [Review][Defer] Suíte de testes é 100% estática (regex sobre o source + `tsc --noEmit`), nenhum teste dinâmico/comportamental executa o use case com dependências mockadas para verificar o output em runtime; padrão sistêmico em todas as stories, não específico deste diff [tests/unit/story-5-7/claim-consolidation.test.mjs] — deferred, pre-existing
- [x] [Review][Defer] Robustez de fronteira de `ocrResult.birthDate` (OcrResult nulo/indefinido, data de nascimento futura/implausível) depende inteiramente do contrato do `OcrProvider`, sem checagem defensiva no use case; o mesmo padrão já existia no branch `ageOver18` pré-5.7, agora exercitado em 100% das requisições em vez de só quando `proofType === "ageOver18"`; mitigado hoje porque `ApiOcrProvider` lança exceção antes de retornar dado malformado (`ApiOcrProvider.ts:73`), mas não defendido na fronteira do use case [src/modules/credential/app/issue_credential_usecase.ts:118-130] — deferred, pre-existing

**Dismissed (7):** remoção do 422 para menor de idade (é a própria AC #2); claims sempre presentes/bundling (é a própria AC #1); comentário TODO acima do fallback de chave (pré-existente ao início desta sessão, não introduzido por este diff — falso positivo de baseline do diff); enum `ProofType` "decorativo" sem consumidor de verificação (mandatado pela AC #1, payoff chega com a Story 5.8 ainda não implementada); ausência de teste para menor de idade (coberto pelo teste estrutural já criado); teste da 5.7 residindo no arquivo de testes da 5.4 (deliberado — Task 6 pediu para preservar o arquivo, só corrigir a asserção obsoleta); rejeitar 422 quando `birthDate` não é parseável mesmo para quem "só precisaria" de `personhood` (conceito obsoleto pós-5.7 — não existe mais seleção por claim, é exatamente a AC #5).

## Dev Notes

### O que muda vs. o que NÃO muda

**Muda:** contrato de entrada (`proofType` sai do body e do payload assinado), construção de claims
(sempre ambas, nunca uma seleção exclusiva), o caso de menor de idade deixa de ser 422.

**Não muda:** validação de assinatura do holder (ordem: assinatura antes de qualquer outra
operação), processamento OCR em memória, descarte de PII, assinatura Ed25519 da VC pelo issuer,
`BlockchainClient.registerDID(holderDid)`, formato de erro `{ error: string }`, formato da VC
completa (`id, type, issuer, holder, issuedAt, claims, proof`) — **não** é VC-JWT. A migração para
VC-JWT (EdDSA) descrita em `architecture.md` §"Credenciais & Formato da VC" é escopo do **Epic 9**
(stories 9.1/9.2, ainda em `backlog`) — não implementar aqui.

### Único caminho de 422 relacionado a documento (AC #4, #5)

Depois desta story, **todo** 422 de `/api/credentials/issue` vem de: (a) falha do
`ocrProvider.processDocument()` (try/catch já existente), ou (b) data de nascimento presente mas
não parseável (`isNaN(new Date(ocrResult.birthDate).getTime())`). Idade `< 18` **não** é mais uma
dessas causas — é um resultado válido (`ageOver18: false`), não uma falha.

### Arquivo principal a modificar

`src/modules/credential/app/issue_credential_usecase.ts` (lido por completo durante o planejamento
desta story). Estado atual relevante:

- Linha 83: `` const payloadStr = `${documentImage}:${proofType}`; `` → payload assinado inclui
  `proofType`. Vira `documentImage` puro.
- Linhas 117-141: branch `if (proofType === "personhood") ... else if (proofType === "ageOver18") ... else` — bloco inteiro é substituído pelo fluxo linear da Task 4.
- Linhas 147-152: comentário TODO + substituição de `"test-issuer-private-key"` por chave hex —
  **não mexer**. É o assunto do Epic 10 (Story 10.1), tema independente desta story (ver
  `sprint-change-proposal-2026-07-28.md` §7). Deixar como está.
- O restante (construção/assinatura da VC, `registerDID`) permanece linha a linha igual.

Arquivos que **leem** `claims` mas não precisam mudar nesta story: `verify_presentation_usecase.ts`
(Regra 5 atual só valida que os valores são booleanos — tratamento correto da nova claim
`ageOver18: false` é escopo da Story 5.8, fora desta entrega).

### Vocabulário canônico (fixado nesta story)

`proof_type` na API/banco usa `personhood` | `age_over_18` (snake_case — já usado em
`create_proof_request_viewmodel.ts:5` via `z.enum(["personhood", "age_over_18"])`). A chave de
claim dentro da VC usa `personhood` | `ageOver18` (camelCase). O enum `ProofType` criado na Task 1
é o único lugar desse mapeamento — não duplicar strings literais para isso em outros arquivos.

### Padrão de enum existente a seguir

`src/shared/domain/enums/ProofRequestStatus.ts` e `ProofSessionStatus.ts` usam TypeScript `enum`
nativo com chaves `UPPER_SNAKE_CASE` e valores string em `snake_case`. Seguir o mesmo estilo para
`ProofType`.

### Testes — padrão do projeto

Testes são `node:test` + `node:assert/strict` em arquivos `.test.mjs`, com três categorias:
existência de arquivo, verificação estática de conteúdo via regex sobre o source, e compilação
`tsc --noEmit` como último teste (com `STAGE: "TEST"` no env). Ver `tests/unit/story-5-4/` e
`tests/unit/story-5-5/` como referência direta — não inventar um padrão novo.

### Escopo explicitamente fora desta story

- Story 5.8 (correspondência claim ↔ proof_type na verificação) — **não implementar**. O usuário
  decidiu conscientemente separar as entregas nesta sessão apesar da restrição de acoplamento
  documentada em `epics.md` (Story 5.7, nota final) e `architecture.md` (linha ~218-220).
- Migração para VC-JWT (Epic 9) — fora de escopo, não tocar formato de serialização/assinatura.
- Epic 10 (higiene de chaves de teste) — não tocar o TODO/substituição de `ISSUER_PRIVATE_KEY` já
  presente no arquivo.
- `docs/e2e-happy-path-postman.md` e a coleção Postman — o Sprint Change Proposal §6 lista a
  atualização do guia E2E como pertencente à entrega conjunta de 5.7/5.8; como apenas 5.7 está
  sendo entregue agora, **não** atualizar esse guia ainda (ficaria inconsistente, já documentando
  um estado parcial). Deixar para quando 5.8 for implementada.

### Project Structure Notes

Nenhum arquivo novo fora do padrão já estabelecido pela Story 5.4: apenas um novo enum em
`src/shared/domain/enums/` (caminho já previsto em `architecture.md` — estrutura de diretórios,
linha ~603 — mas inexistente na codebase até agora). Nenhuma migration, nenhuma mudança de schema
de banco, nenhuma mudança de rota (`POST /api/credentials/issue` continua a mesma rota, mesmo
`app/api/credentials/issue/route.ts`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7] — AC originais
- [Source: _bmad-output/planning-artifacts/architecture.md#Credenciais & Formato da VC] — semântica de claims consolidadas, decisão sobre `proofType`, enum compartilhado
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md §4.1] — decisão C1 (remover `proofType`), rationale
- [Source: src/modules/credential/app/issue_credential_usecase.ts] — arquivo principal, lido por completo
- [Source: _bmad-output/implementation-artifacts/stories/5-4-emissao-de-verifiable-credential.md] — story superseded parcialmente, contexto de implementação original
- [Source: tests/unit/story-5-4/credential-issuance.test.mjs] — padrão de teste + asserção a corrigir

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `node --test tests/unit/story-5-7/claim-consolidation.test.mjs` — falhas confirmadas contra o código pré-mudança (red phase: proofType branching, payload assinado com `:proofType`, ausência do enum `ProofType`), depois 14/14 passando após a implementação.
- `node --test tests/unit/story-5-7/... tests/unit/story-5-4/... tests/unit/story-5-5/*` — 62/62 passando, sem regressão em 5.4/5.5.
- `npm test` (suíte completa) — 582/582 passando.
- `npx eslint` nos arquivos alterados — sem findings.

### Completion Notes List

- Claims consolidadas: `personhood` é sempre `true`; `ageOver18` é sempre calculado (`age >= 18`) e incluído na VC, nunca lançando erro por idade isolada.
- Menor de idade agora recebe HTTP 201 com `{ personhood: true, ageOver18: false }` — o branch antigo por `proofType` (incluindo o `else` que retornava 422 para `proofType` desconhecido) foi removido por completo.
- `proofType` removido do contrato de entrada em 3 pontos: `IssueCredentialSchema` (viewmodel), `IssueCredentialController.handle`, `IssueCredentialInput` (usecase). O payload assinado pelo holder passou de `` `${documentImage}:${proofType}` `` para `documentImage` puro.
- 422 continua reservado a duas causas apenas: falha de `ocrProvider.processDocument()` e data de nascimento não parseável (`isNaN(birthDate.getTime())`) — ambas com a mesma mensagem `"Document processing failed"`, consistente com o comportamento pré-existente.
- Criado `src/shared/domain/enums/ProofType.ts` com o enum `ProofType` (`PERSONHOOD = "personhood"`, `AGE_OVER_18 = "age_over_18"`) e a constante `PROOF_TYPE_CLAIM_KEY` mapeando cada membro para a chave de claim camelCase da VC (`personhood`, `ageOver18`). É o único lugar desse mapeamento na codebase; o use case consome as chaves via `PROOF_TYPE_CLAIM_KEY[ProofType.PERSONHOOD]` / `[ProofType.AGE_OVER_18]` em vez de strings literais duplicadas.
- `issue_credential_presenter.ts` não precisou de nenhuma alteração — confirmado que não referenciava `proofType`.
- Assinatura do body, OCR em memória, descarte de PII, assinatura Ed25519 da VC pelo issuer e `registerDID` on-chain permanecem linha a linha inalterados, exceto a mudança pontual do payload assinado (Task 3) e da lógica de claims (Task 4).
- Corrigida uma asserção obsoleta em `tests/unit/story-5-4/credential-issuance.test.mjs` que checava `age < 18` lançando erro — o restante do arquivo (5.4) permanece válido e passando.
- Escopo mantido estritamente à Story 5.7 por decisão explícita do usuário: Story 5.8 (correspondência claim ↔ proof_type na verificação), migração VC-JWT (Epic 9), higiene de chaves de teste (Epic 10) e atualização da coleção Postman/guia E2E **não foram tocados** — ver nota de restrição de entrega no topo da story.

### File List

**Novos:**
- `src/shared/domain/enums/ProofType.ts`
- `tests/unit/story-5-7/claim-consolidation.test.mjs`

**Modificados:**
- `src/modules/credential/app/issue_credential_usecase.ts` — payload assinado sem `proofType`, claims consolidadas (`personhood` sempre `true`, `ageOver18` sempre calculado), remoção do branch por `proofType`
- `src/modules/credential/app/issue_credential_viewmodel.ts` — `IssueCredentialSchema` sem o campo `proofType`; `.strict()` adicionado (patch de code review)
- `src/modules/credential/app/issue_credential_controller.ts` — não repassa mais `proofType` ao use case
- `src/shared/domain/enums/ProofType.ts` — comentário explicando a diferença de casing entre enum e claim key (patch de code review)
- `tests/unit/story-5-4/credential-issuance.test.mjs` — asserção de idade atualizada para o novo comportamento (não lançar erro para `age < 18`)
- `tests/unit/story-5-7/claim-consolidation.test.mjs` — teste adicional cobrindo `.strict()` (patch de code review)

## Change Log

- **2026-07-31** — Implementação completa da Story 5.7: claims consolidadas (`personhood` + `ageOver18`) em uma única emissão, remoção de `proofType` do contrato de entrada e do payload assinado, menor de idade deixa de retornar 422, criação do enum compartilhado `ProofType`. 14 novos testes estruturais + correção de 1 asserção obsoleta em 5.4. Suíte completa (582 testes) passando sem regressões. **Story 5.8 não implementada nesta entrega — decisão consciente do usuário apesar da restrição de entrega acoplada documentada no planejamento.**
- **2026-07-31** — Code review (3 camadas: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0 decision-needed, 2 patch (aplicados: `.strict()` no schema de entrada, comentário de casing no `ProofType`), 5 defer (pré-existentes, registrados em `deferred-work.md`), 7 dismissed (comportamentos mandatados pela própria AC ou falsos positivos de baseline do diff). Suíte completa (583 testes) passando após os patches. Status → `test`.
