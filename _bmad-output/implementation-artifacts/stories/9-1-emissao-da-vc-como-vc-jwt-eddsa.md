# Story 9.1: Emissão da VC como VC-JWT (EdDSA)

Status: done

> ⚠️ **Acoplamento de entrega com a Story 9.2 (`status: backlog`), análogo ao par 5.7/5.8 — porém mais
> severo.** Depois desta story, `POST /api/credentials/issue` passa a retornar uma string JWT em vez
> do objeto JSON-LD atual. `verify_presentation_usecase.ts` (Story 9.2) ainda espera o formato antigo
> (`vc.proof.signatureValue`) e **não consegue nem fazer parse** de uma VC-JWT nova — não é uma falha
> de segurança silenciosa como no par 5.7/5.8, é uma **quebra total** do fluxo `/api/presentations/verify`
> para qualquer credencial emitida após esta story. **Decisão consciente do usuário:** implementar 9.1
> isoladamente mesmo assim, sem shim dual-format — 9.2 deve ser entregue em seguida antes de qualquer
> uso real do fluxo de verificação. Não implementar suporte transitório a ambos os formatos.
>
> **Decisões já tomadas para fechar o TBD do epics.md** (não reabrir):
> 1. **Biblioteca JWS/EdDSA:** hand-roll com `@noble/ed25519` (já usado em todo o módulo `credential`/`presentation`) — nenhuma dependência nova.
> 2. **Formato da resposta de `POST /api/credentials/issue`:** a string JWT crua no corpo (via `NextResponse.json(vcJwt)`, que serializa como uma string JSON simples) — não um envelope `{ vcJwt: "..." }`.
> 3. **Coordenação com o app mobile YaID Wallet:** fora do escopo desta story (não há acesso ao repositório do wallet); registrar o contrato JWT nas Dev Notes para handoff externo.

## Story

Como app mobile do holder,
Quero receber a Verifiable Credential como um JWT assinado,
Para que eu a armazene em formato compacto e verificável, alinhado ao que o app espera.

## Acceptance Criteria

1. **Given** o `IssueCredentialUseCase` (`src/modules/credential/app/issue_credential_usecase.ts`)
   **When** uma VC é emitida
   **Then** ela é construída como VC-JWT compacto com header `{alg:"EdDSA", typ:"JWT", kid:"<issuerDid>#key-1"}`
   e payload `{iss:<issuerDid>, sub:<holderDid>, jti, iat, nbf, vc:{personhood: true, ageOver18: <boolean>}}`
   **And** é assinada (JWS compacto: `base64url(header).base64url(payload).base64url(signature)`) com
   `ISSUER_PRIVATE_KEY` (EdDSA, via `@noble/ed25519`)
   **And** os claims permanecem **apenas booleanos** — nenhuma PII entra no payload
   **And** o bloco `vc` carrega **ambas** as claims consolidadas pela Story 5.7:
   `{ personhood: true, ageOver18: <boolean> }` — nunca uma claim isolada

2. **Given** o `IssueCredentialController`/`IssueCredentialUseCase` e a rota `POST /api/credentials/issue`
   **When** a resposta é montada
   **Then** retorna a **string JWT** no corpo — não mais o objeto JSON-LD com `proof.Ed25519Signature2020` embutido
   **And** o status HTTP permanece `201`

3. **Given** o JWT emitido
   **When** verificado com a public key do issuer (derivada de `ISSUER_PRIVATE_KEY` via `ed.getPublicKeyAsync`)
   **Then** a assinatura é válida e o header/payload seguem exatamente o formato do AC #1

4. **Given** o fluxo existente de emissão (Stories 5.4 e 5.7)
   **When** esta story é aplicada
   **Then** a validação de DID e assinatura do holder, o OCR em memória, o descarte de PII e o registro
   on-chain (`registerDID`) permanecem **inalterados** — muda apenas o formato de serialização/assinatura
   da VC (do objeto JSON-LD com `proof` para o JWT compacto)
   **And** a semântica de claims da Story 5.7 é preservada: ambas as claims presentes, menor de 18
   recebe `ageOver18: false` com sucesso, e o body de entrada não aceita `proofType` (`IssueCredentialSchema`
   permanece `{documentImage, bodySignature}`, sem alteração)

## Tasks / Subtasks

- [x] Task 1: Substituir a construção JSON-LD por VC-JWT em `issue_credential_usecase.ts` (AC: #1, #3, #4)
  - [x] Manter inalterados os passos 1-4 do `execute()` (linhas 66-135): validação de DID/assinatura do
    holder, chamada ao `ocrProvider.processDocument`, cálculo de `ageOver18`, montagem de `claims`.
  - [x] Manter inalterado o bloco de resolução da chave (linhas 138-151): `id`/`type` deixam de existir
    como campos top-level da VC (o `id` vira o `jti` do JWT — gerar com `randomUUID()` como hoje), mas
    a lógica de `privateKeyHex`/fallback `test-issuer-private-key` e o cálculo de `issuerPubKeyHex`/`issuerDid`
    permanecem **exatamente como estão** — não tocar (Epic 10 é o único autorizado a mexer nisso).
  - [x] Substituir o bloco de montagem de `vcPayload` + `proof` + `completeVC` (linhas 154-179) por:
    ```ts
    const header = { alg: "EdDSA", typ: "JWT", kid: `${issuerDid}#key-1` };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerDid,
      sub: holderDid,
      jti: id, // reaproveita o randomUUID() já gerado
      iat: now,
      nbf: now,
      vc: claims, // { personhood: true, ageOver18: boolean }
    };
    const signingInput = `${bytesToBase64url(new TextEncoder().encode(JSON.stringify(header)))}.${bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
    const signatureBytes = await ed.signAsync(new TextEncoder().encode(signingInput), privateKeyBytes);
    const vcJwt = `${signingInput}.${bytesToBase64url(signatureBytes)}`;
    ```
  - [x] Remover o campo `type = ["VerifiableCredential"]` (linha 139) — não existe equivalente no payload JWT prescrito pelo AC #1; `type: "JWT"` já está no header.
  - [x] Atualizar a interface `VerifiableCredential` (linhas 14-28): remover por completo (ou renomear/manter só para uso interno se necessário) — o retorno de `execute()` passa a ser `Promise<string>` (a VC-JWT). Não deixar a interface antiga solta sem uso — se nada mais a referenciar após esta task, apagar.
  - [x] `registerDID` (linhas 181-186) permanece **exatamente como está**, chamado depois da assinatura, antes do `return`.
  - [x] `return completeVC;` (linha 188) vira `return vcJwt;`.
  - [x] Os helpers `base64urlToBytes`/`bytesToBase64url`/`hexToBytes`/`bytesToHex` (linhas 30-55) já existem e cobrem tudo que esta story precisa — não recriar, não adicionar biblioteca nova.

- [x] Task 2: Propagar o novo tipo de retorno pela camada de controller/rota (AC: #2)
  - [x] Em `issue_credential_controller.ts`: trocar o import/uso de `VerifiableCredential` por `string`
    (ou remover o import se a interface for apagada na Task 1); `handle()` passa a retornar `Promise<string>`.
  - [x] Em `app/api/credentials/issue/route.ts`: `const verifiableCredential = await controller.handle(...)`
    passa a ser a string JWT; `NextResponse.json(verifiableCredential, { status: 201 })` já serializa uma
    string como JSON válido (`"eyJhbGci..."`) — **não precisa de mudança na chamada**, só renomear a
    variável para algo como `vcJwt` por clareza. Confirmar que nenhum outro lugar da rota depende de campos
    do objeto antigo (`.proof`, `.claims` etc.) — não depende, conferido no código atual.
  - [x] `issue_credential_presenter.ts` e `issue_credential_viewmodel.ts` **não mudam** — a entrada
    (`{documentImage, bodySignature}`) e a injeção de dependências continuam idênticas.

- [x] Task 3: Atualizar teste estrutural pré-existente que quebra com esta mudança (AC: #1, #2)
  - [x] `tests/unit/story-5-4/credential-issuance.test.mjs:118-122` ("Story 5.4 IssueCredentialUseCase
    signs VC and appends proof") afirma `assert.match(src, /Ed25519Signature2020/)` — essa string deixa de
    existir no código após esta story. Reescrever esse teste para afirmar o novo comportamento (assinatura
    via `ed.signAsync` sobre o `signingInput` JWS, presença de `alg.*EdDSA`/`typ.*JWT` no header
    construído) em vez de `Ed25519Signature2020`. Não deletar o teste — adaptar, seguindo o mesmo padrão
    usado pela Story 5.8/Task 4 ao reescrever asserções de stories anteriores que ficaram obsoletas.
  - [x] Confirmar que nenhum outro teste em `tests/unit/story-5-4/` ou `tests/unit/story-5-7/` depende
    de campos do objeto JSON-LD antigo (`proof`, `type`, `id` top-level) — rodar as duas suítes após a
    mudança e conferir.

- [x] Task 4: Criar testes unitários novos em `tests/unit/story-9-1/` (AC: #1, #2, #3, #4)
  - [x] Seguir o padrão estrutural do projeto: existência de arquivo, verificação estática de conteúdo
    via regex sobre o source, `tsc --noEmit` como último teste (ver `tests/unit/story-5-4/credential-issuance.test.mjs`
    como referência direta do mesmo arquivo).
  - [x] Cobrir estaticamente: ausência de `Ed25519Signature2020`/`proof.signatureValue`/`type: \[.?VerifiableCredential`
    no `issue_credential_usecase.ts`; presença de `alg.*EdDSA`, `typ.*JWT`, `kid`, `iss`, `sub`, `jti`,
    `iat`, `nbf`, `vc:` na construção do payload/header; retorno de `execute()` tipado como `string`
    (ou ausência de `Promise<VerifiableCredential>`); rota e controller propagando `string`.
  - [x] **Recomendado (não obrigatório):** um teste dinâmico/comportamental (`.dynamic.test.ts` via `tsx`,
    seguindo o precedente de `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`) que
    instancia `IssueCredentialUseCase` com `BlockchainClient`/`OcrProvider` fake, chama `execute()`, faz
    split do JWT retornado em 3 partes por `.`, decodifica header/payload em base64url e confere: 3 partes
    presentes, header e payload no formato exato do AC #1, assinatura válida via `ed.verifyAsync` contra a
    public key derivada de `ISSUER_PRIVATE_KEY`. Esta é exatamente a categoria de lógica (serialização +
    assinatura) que se beneficia de teste real em vez de só regex — decisão do desenvolvedor se o tempo
    permitir, mas fortemente recomendado dado que é lógica nova e crítica (contrato externo com o app mobile).
  - [x] Adicionar script `test:story:9.1` ao `package.json` seguindo o padrão de `test:story:5.8` (estático
    + dinâmico via `tsx --test`, se o teste dinâmico for criado).

### Escopo explicitamente fora desta story

- `verify_presentation_usecase.ts` (Story 9.2, `backlog`) — não tocar. Continuará esperando o formato
  JSON-LD antigo até a 9.2 ser implementada; **este é o break documentado no aviso do topo desta story**.
- `revoke_credential_usecase.ts` — consome `vcId` (hoje o campo `id` top-level da VC). Com a migração
  para JWT, o conceito equivalente é o `jti` do payload — **nenhuma AC desta ou da Story 9.2 cobre esse
  arquivo**. Não alterar; registrar como gap conhecido (ver Dev Notes) para tratamento futuro.
- `ISSUER_PRIVATE_KEY`/fallback `test-issuer-private-key` em `src/shared/environments.ts` e o hardcode
  local em `issue_credential_usecase.ts` (linhas 143-146) — escopo exclusivo do Epic 10 (`backlog`). Não tocar.
- Coordenação com o repositório do app mobile YaID Wallet — fora do alcance desta story (sem acesso ao
  código do wallet). Documentar o contrato JWT nas Dev Notes para handoff.
- `docs/e2e-happy-path-postman.md` — não há AC exigindo atualização do guia Postman nesta story; se o
  desenvolvedor notar que o guia ficou desatualizado (resposta de `/api/credentials/issue` documentada
  como JSON-LD), registrar como item de code-review defer, não corrigir aqui sem AC explícita.

### Review Findings

**Defer (6, pré-existentes ou fora do escopo desta story):**
- [x] [Review][Defer] Payload do JWT não carrega claim `exp` (expiração) — apenas `iat`/`nbf`; uma VC-JWT emitida não tem prazo de validade explícito no próprio JWT, só a revogação on-chain como controle de ciclo de vida. Não é exigido pelo AC #1/Dev Notes ("Formato exato do JWT" — não inventar variações) desta story; considerar em story futura se o produto precisar de expiração automática [src/modules/credential/app/issue_credential_usecase.ts:139-146] — deferred, fora do formato prescrito por esta story
- [x] [Review][Defer] Payload do JWT não carrega claim `aud` (amarração a um verificador/apresentação específica) — mesma razão do achado anterior: não faz parte do formato exato prescrito pelo AC #1 [src/modules/credential/app/issue_credential_usecase.ts:139-146] — deferred, fora do formato prescrito por esta story
- [x] [Review][Defer] `ed.signAsync` na emissão da VC-JWT não tem try/catch dedicado (diferente do try/catch em torno de `blockchainClient.registerDID`) — uma falha de assinatura vira erro genérico não classificado em vez de um `AppError` tipado. Padrão pré-existente: a assinatura JSON-LD anterior (`ed.signAsync` sobre `vcPayloadBytes`) também não tinha tratamento dedicado — não introduzido por este diff [src/modules/credential/app/issue_credential_usecase.ts:151] — deferred, pré-existente
- [x] [Review][Defer] Nenhum teste dinâmico cobre `bodySignature` base64url malformado (caracteres inválidos, comprimento ímpar) além do caso "64 bytes zerados" (assinatura bem formada mas errada) — o trecho de validação da assinatura do holder não foi tocado por esta story (é reaproveitado sem alteração da Story 5.4); gap de cobertura pré-existente, não introduzido aqui [tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts] — deferred, pré-existente, fora do diff desta story
- [x] [Review][Defer] Nenhum teste dinâmico cobre `ISSUER_PRIVATE_KEY` vazio/malformado no caminho de emissão — mesma razão do achado anterior; a resolução da chave do issuer é escopo do Epic 10 (`backlog`), não tocado por esta story [src/modules/credential/app/issue_credential_usecase.ts:126-129] — deferred, escopo do Epic 10
- [x] [Review][Defer] Verificação EdDSA (allow-list de algoritmo, proteção contra confusão de tipo/alg no lado que consome o JWT) pertence à Story 9.2 (`backlog`, verificação) — esta story só cobre emissão; nenhuma AC desta story exige código de verificação [src/modules/presentation/app/verify_presentation_usecase.ts] — deferred, escopo da Story 9.2

**Dismissed (12):** corpo da resposta de `POST /api/credentials/issue` ser uma string JSON "citada" em vez de um corpo bruto/envelope nomeado (decisão consciente do usuário já registrada no topo da story — item 2 das "Decisões já tomadas"); bloco `vc` conter só os claims booleanos em vez de uma estrutura VC completa (`@context`/`type`/`credentialSubject`) — é exatamente o formato prescrito pelo AC #1/Dev Notes, não um desvio; remoção do campo `type: ["VerifiableCredential"]` sem substituto — exigida explicitamente pela Task 1; `typ: "JWT"` em vez de `"vc+jwt"` — contradiz o formato exato prescrito, que não deve ser reinventado; `sub` no nível superior do JWT em vez de `credentialSubject.id` dentro de `vc` — decisão de design do próprio formato prescrito pelo AC #1, não um desvio introduzido pelo dev; assinatura JWS hand-rolled sem biblioteca `jose` — decisão do usuário, perguntada e registrada explicitamente no topo da story; hardcode `test-issuer-private-key` não corrigido — escopo exclusivo do Epic 10, a story instrui explicitamente não tocar; teste estático da Story 5.4 "degradado para regex" — falso positivo, o teste sempre foi regex-estático por convenção do projeto, e a cobertura comportamental real está no novo teste dinâmico da 9.1; mutação do teste da 5.4 em vez de criar um novo arquivo (nome contém "superseded by Story 9.1") — segue exatamente a instrução da Task 3 e o precedente da Story 5.8; quebra de `verify_presentation_usecase.ts` ao consumir uma VC-JWT nova — já documentada e conscientemente aceita no aviso do topo desta story (acoplamento 9.1/9.2); ausência de teste cobrindo a interação com `verify_presentation_usecase.ts` — mesma razão, fora de escopo desta story; ausência de teste para claims vazios/muito grandes — nenhuma AC exige essa cobertura e o comportamento de `claims` não muda em relação ao já existente.

## Dev Notes

### Divergência de nomenclatura: módulo `identity` não existe

O `epics.md` e o `architecture.md` referem-se ao "módulo `identity`" para a emissão de credenciais. **Esse
diretório não existe no código** — o módulo real, criado pela Story 5.4, é `src/modules/credential`. Não
perder tempo procurando `src/modules/identity`; todo o trabalho desta story acontece em
`src/modules/credential/app/`.

### Arquivo principal a modificar

`src/modules/credential/app/issue_credential_usecase.ts` (lido por completo durante o planejamento desta
story — 191 linhas). Estado atual relevante (ver Task 1 para os pontos exatos):

- Linhas 1-6: imports — `@noble/ed25519 as ed`, `randomUUID`, `AppError`, `BlockchainClient`, `OcrProvider`,
  `PROOF_TYPE_CLAIM_KEY`/`ProofType`. Todos permanecem; nenhum import novo é necessário (decisão: hand-roll
  com `@noble/ed25519`, sem `jose`).
- Linhas 14-28: interface `VerifiableCredential` (JSON-LD) — será removida/substituída (Task 1).
- Linhas 30-55: helpers `base64urlToBytes`/`bytesToBase64url`/`hexToBytes`/`bytesToHex` — **reaproveitar
  sem alteração**, são exatamente o que uma implementação JWS manual precisa.
- Linhas 66-135: passos 1-4 (validação de DID/assinatura do holder, OCR, cálculo de claims) — **não mudam**.
- Linhas 137-151: resolução da chave do issuer (`privateKeyHex`, fallback de teste, `issuerPubKeyHex`,
  `issuerDid`) — **não mudam**.
- Linhas 154-179: construção do `vcPayload`/`proof`/`completeVC` — **este é o bloco substituído** pela
  construção do JWS compacto (Task 1).
- Linhas 181-186: `registerDID` — **não muda**, continua chamado após a assinatura.
- Linha 188: `return completeVC` → `return vcJwt` (string).

### Formato exato do JWT (contrato externo com o app mobile — não inventar variações)

Header:
```json
{ "alg": "EdDSA", "typ": "JWT", "kid": "<issuerDid>#key-1" }
```
Payload:
```json
{
  "iss": "<issuerDid>",
  "sub": "<holderDid>",
  "jti": "<uuid>",
  "iat": <unix seconds>,
  "nbf": <unix seconds>,
  "vc": { "personhood": true, "ageOver18": <boolean> }
}
```
Serialização: `base64url(JSON.stringify(header))` + `"."` + `base64url(JSON.stringify(payload))`, assinado
com `ed.signAsync` sobre os bytes UTF-8 dessa string concatenada, resultando em
`<header>.<payload>.<base64url(signature)>` — um JWS compacto padrão. `kid` reaproveita literalmente o
mesmo valor que hoje é `verificationMethod` na Story 5.4 (`${issuerDid}#key-1`) — não é um formato novo,
é o mesmo identificador em outro campo.

`iat`/`nbf` são **segundos** (padrão JWT — `NumericDate`), diferente de `issuedAt`/`created` na versão
JSON-LD antiga que eram `new Date().toISOString()`. Não confundir os dois formatos de timestamp.

### Por que hand-roll com `@noble/ed25519` em vez de adicionar `jose`

Decisão do usuário (perguntada explicitamente por ser o TBD que o `epics.md` marca para o agente
implementador). `@noble/ed25519` já é a única dependência de criptografia do projeto e já é usada de forma
hand-rolled em `issue_credential_usecase.ts`, `verify_presentation_usecase.ts` e `revoke_credential_usecase.ts`
— manter o mesmo estilo evita introduzir uma segunda forma de assinar coisas no código. Não adicionar `jose`
nem qualquer outra lib JWT/JOSE ao `package.json`.

### O que muda vs. o que NÃO muda

**Muda:** o retorno de `IssueCredentialUseCase.execute()` (de objeto JSON-LD para `string` JWT); a interface
`VerifiableCredential` é removida/substituída; o tipo de retorno do `IssueCredentialController.handle()`;
o corpo da resposta de `POST /api/credentials/issue` (mesma serialização `NextResponse.json`, conteúdo
diferente); um teste pré-existente (`story-5-4`) precisa de ajuste de asserção (Task 3).

**Não muda:** validação de DID/assinatura do holder (passos 1-2 do `execute()`); chamada ao `OcrProvider`
e descarte de PII; cálculo de `ageOver18`/consolidação de claims (Story 5.7); resolução de
`ISSUER_PRIVATE_KEY` e seu fallback de teste (Epic 10, não tocar); chamada a `blockchainClient.registerDID`;
`IssueCredentialSchema` (entrada `{documentImage, bodySignature}`); `issue_credential_presenter.ts`;
status HTTP `201`; mapeamento de erros 401/422/502 na rota.

### Testes — padrão do projeto

`node:test` + `node:assert/strict` em `.test.mjs`, três categorias (existência de arquivo, regex estático
sobre o source, `tsc --noEmit` final com `STAGE: "TEST"`) — ver `tests/unit/story-5-4/credential-issuance.test.mjs`
como referência direta (é o teste estrutural do mesmo arquivo que esta story modifica). Se um teste dinâmico
for adicionado, seguir o precedente de `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`
(via `tsx --test`, já configurado no projeto desde a Story 5.8 — `tsx@^4.23.1` já é devDependency, não
precisa reinstalar). Rodar `npm test` completo ao final e confirmar que o total sobe sem regressões (suíte
atual: 610 testes passando após a Story 5.8).

### Project Structure Notes

Nenhum arquivo novo em `src/` além do necessário para os testes — apenas modificação de
`issue_credential_usecase.ts` e `issue_credential_controller.ts` (mudança de tipo de retorno). Novo
diretório de teste `tests/unit/story-9-1/`. Modificação pontual em `tests/unit/story-5-4/credential-issuance.test.mjs`
(Task 3). Nenhuma migration, nenhuma mudança de schema de banco, nenhuma mudança de rota (`app/api/credentials/issue/route.ts`
só muda o nome de uma variável local, se tanto).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.1] — AC originais e o TBD de biblioteca JWS
- [Source: _bmad-output/planning-artifacts/architecture.md — seção "Credenciais & Formato da VC"] — formato de header/payload prescrito, motivação da migração
- [Source: _bmad-output/implementation-artifacts/stories/5-4-emissao-de-verifiable-credential.md] — implementação JSON-LD original sendo substituída
- [Source: _bmad-output/implementation-artifacts/stories/5-7-consolidacao-de-claims-na-emissao.md] — Dev Notes já apontavam que a migração VC-JWT é escopo do Epic 9, não implementar antes
- [Source: _bmad-output/implementation-artifacts/stories/5-8-correspondencia-entre-claim-e-proof-type.md] — padrão de Task/Dev Notes/Review Findings a seguir; precedente de acoplamento de entrega entre stories
- [Source: src/modules/credential/app/issue_credential_usecase.ts] — arquivo principal, lido por completo
- [Source: src/modules/credential/app/issue_credential_controller.ts, issue_credential_presenter.ts, issue_credential_viewmodel.ts] — camadas adjacentes, lidas por completo
- [Source: app/api/credentials/issue/route.ts] — rota, lida por completo
- [Source: src/shared/domain/enums/ProofType.ts] — enum/mapa de claims reaproveitado sem alteração
- [Source: tests/unit/story-5-4/credential-issuance.test.mjs] — padrão de teste do arquivo modificado; linha 118-122 precisa de ajuste (Task 3)
- [Source: tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts] — precedente de teste dinâmico via `tsx`, referência para o teste dinâmico recomendado da Task 4

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `node --test tests/unit/story-9-1/vc-jwt-issuance.test.mjs` — 1 falha inicial (red phase: comentário
  do código continha a string `Ed25519Signature2020`, disparando o `doesNotMatch` do teste antes mesmo
  da implementação estar incorreta); corrigido o texto do comentário, 13/13 passando em seguida (inclui `tsc --noEmit`).
- `npx tsx --test tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts` — 3/3 passando: JWT de 3
  segmentos com header/payload no formato exato do AC #1, assinatura EdDSA verificada com `ed.verifyAsync`
  contra a public key derivada de `ISSUER_PRIVATE_KEY`, `ageOver18: false` para holder menor de idade sem
  lançar exceção, e rejeição 401 por assinatura inválida sem registrar DID.
- `npm run test:unit` (suíte estática completa) — 617/617 passando (604 pré-existentes + 13 novos statics
  da 9.1, mais o ajuste de asserção no teste da 5.4 — sem regressões).
- `npm test` (estática + dinâmica) — 617 estáticos + 9 dinâmicos (6 da 5.8 + 3 da 9.1), todos passando.
- `npx eslint src/modules/credential/app/issue_credential_usecase.ts src/modules/credential/app/issue_credential_controller.ts app/api/credentials/issue/route.ts tests/unit/story-9-1/*.ts tests/unit/story-9-1/*.mjs tests/unit/story-5-4/credential-issuance.test.mjs` —
  1 finding pré-existente (`no-explicit-any` em `route.ts:22`, no `catch (error: any)` já presente antes
  desta story, fora do diff) — sem findings novos.

### Completion Notes List

- `IssueCredentialUseCase.execute()` agora retorna uma VC-JWT compacta (`string`) em vez do objeto JSON-LD
  com `proof.Ed25519Signature2020`. A interface `VerifiableCredential` foi removida (não tinha mais uso).
- O JWT é construído manualmente com `@noble/ed25519` (decisão do usuário — sem adicionar `jose` nem
  nenhuma outra lib JWT/JOSE): header `{alg:"EdDSA", typ:"JWT", kid:"<issuerDid>#key-1"}`, payload
  `{iss, sub, jti, iat, nbf, vc:{personhood, ageOver18}}`, assinado sobre
  `base64url(header).base64url(payload)`, resultando em `<header>.<payload>.<signature>`.
- Os passos 1-4 do `execute()` (validação de DID/assinatura do holder, OCR em memória, cálculo de
  `ageOver18`, consolidação de claims da Story 5.7) permanecem linha a linha inalterados; a resolução de
  `ISSUER_PRIVATE_KEY` (incluindo o fallback de teste, escopo do Epic 10) e a chamada a
  `blockchainClient.registerDID` também não foram tocadas.
- `IssueCredentialController.handle()` e a rota `POST /api/credentials/issue` propagam o novo tipo de
  retorno `string`; a rota mantém `NextResponse.json(vcJwt, { status: 201 })` — serializa a string do JWT
  como corpo JSON simples (decisão do usuário: string crua, não um envelope `{ vcJwt: "..." }`).
  `issue_credential_presenter.ts` e `issue_credential_viewmodel.ts` não foram alterados.
- Teste pré-existente `tests/unit/story-5-4/credential-issuance.test.mjs` tinha uma asserção que exigia a
  string `Ed25519Signature2020` no source — reescrita para afirmar o novo header JWT (`alg: "EdDSA"`,
  `typ: "JWT"`) em vez do formato antigo, seguindo o precedente da Story 5.8 de adaptar testes obsoletos
  em vez de deletá-los.
- Criados testes estruturais novos em `tests/unit/story-9-1/vc-jwt-issuance.test.mjs` (13 testes: ausência
  do formato antigo, presença do header/payload prescrito, tipo de retorno `string`, preservação do fluxo
  OCR/claims/blockchain, não-alteração do hardcode de teste do Epic 10, propagação pelo controller/rota,
  compilação limpa) e um teste dinâmico/comportamental em
  `tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts` (3 testes via `tsx`, seguindo o
  precedente da Story 5.8): instancia `IssueCredentialUseCase` real com `BlockchainClient`/`OcrProvider`
  fake e um par de chaves Ed25519 de teste, decodifica o JWT retornado e verifica a assinatura de verdade.
- `npm install` foi necessário para materializar `tsx` em `node_modules` (já declarado como devDependency
  desde a Story 5.8, mas ausente fisicamente no ambiente desta sessão) — nenhuma versão foi alterada em
  `package.json`/`package-lock.json` além da adição do script `test:story:9.1`.
- **Break de acoplamento com a Story 9.2 (documentado, aceito pelo usuário):** a partir desta story,
  `verify_presentation_usecase.ts` (ainda no formato JSON-LD antigo) não consegue mais fazer parse de
  nenhuma VC nova emitida. Nenhuma alteração dual-format foi implementada — a Story 9.2 deve migrar a
  verificação antes de qualquer uso real do fluxo `/api/presentations/verify`.
- **Gap conhecido, fora de escopo (registrar para o futuro):** `revoke_credential_usecase.ts` continua
  recebendo um `vcId` no conceito do antigo campo `id` top-level; com a VC-JWT, o identificador equivalente
  é o `jti` do payload. Nenhuma AC desta ou da Story 9.2 cobre esse arquivo — não foi tocado.
- **QA:** adicionado `tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts` — teste de assinatura
  do holder malformada (não-base64url), fechando o gap de cobertura registrado no code review desta story
  ("nenhum teste dinâmico cobre bodySignature malformado além do caso 64-bytes-zerados").

### File List

**Novos:**
- `tests/unit/story-9-1/vc-jwt-issuance.test.mjs`
- `tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts`

**Modificados:**
- `src/modules/credential/app/issue_credential_usecase.ts` — VC-JWT compacta (EdDSA) substitui o objeto
  JSON-LD com `proof.Ed25519Signature2020`; interface `VerifiableCredential` removida; `execute()` retorna `string`
- `src/modules/credential/app/issue_credential_controller.ts` — `handle()` retorna `Promise<string>`, sem referência à interface removida
- `app/api/credentials/issue/route.ts` — variável renomeada para `vcJwt`, mesma serialização `NextResponse.json(..., { status: 201 })`
- `tests/unit/story-5-4/credential-issuance.test.mjs` — asserção obsoleta (`Ed25519Signature2020`) reescrita para o novo header JWT (`alg: EdDSA`, `typ: JWT`)
- `package.json` — novo script `test:story:9.1` (estático + dinâmico via `tsx --test`)
- `package-lock.json` — sem mudança de versão; apenas o efeito de `npm install` materializando dependências já declaradas

## Change Log

- **2026-08-03** — Story criada via `bmad-create-story`. Decisões fechadas com o usuário antes da escrita:
  biblioteca JWS hand-rolled com `@noble/ed25519` (sem dependência nova), resposta de
  `POST /api/credentials/issue` como string JWT crua no corpo, e aceite explícito do break de acoplamento
  com a Story 9.2 (sem shim dual-format). Status → `ready-for-dev`.
- **2026-08-03** — Implementação completa da Story 9.1: `IssueCredentialUseCase` passa a emitir a VC como
  JWT compacto assinado (EdDSA, hand-rolled com `@noble/ed25519`), substituindo o objeto JSON-LD com
  `proof.Ed25519Signature2020`. Controller e rota propagam o novo tipo de retorno `string`. Teste
  pré-existente da Story 5.4 ajustado para a nova asserção. 16 novos testes (13 estruturais/estáticos + 3
  dinâmicos); suíte completa (626 testes: 617 estáticos + 9 dinâmicos) passando sem regressões. Break de
  acoplamento com a Story 9.2 documentado e aceito conscientemente. Status → `review`.
- **2026-08-03** — Code review (3 camadas: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0
  decision-needed, 0 patch, 6 defer (registrados em `deferred-work.md`), 12 dismissed (formato
  contradiz alegações do Blind Hunter mas segue exatamente o AC #1/Dev Notes; decisões já
  documentadas no topo da story; ruído/falso positivo). Todas as 4 ACs confirmadas satisfeitas pelo
  Acceptance Auditor, sem violações. Status → `test`.
- **2026-08-03** — QA: geração de testes unitários formais. Cobertura já era abrangente (13 estáticos +
  3 dinâmicos criados no dev-story); adicionado 1 teste dinâmico novo para fechar o gap "bodySignature
  malformado" registrado no code review. Suíte completa: 627/627 passando (617 estáticos + 10
  dinâmicos), sem regressões. `test-summary.md` atualizado. Status → `done`.
