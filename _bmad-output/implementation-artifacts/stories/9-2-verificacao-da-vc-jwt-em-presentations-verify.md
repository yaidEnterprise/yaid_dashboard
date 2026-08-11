# Story 9.2: Verificação da VC-JWT em `presentations/verify`

Status: done

> **Decisões herdadas da Story 9.1 — não reabrir:** o JWS é implementado manualmente com
> `@noble/ed25519`, sem `jose` ou nova dependência; o formato aceito é exclusivamente a VC-JWT compacta
> emitida pela 9.1; não haverá shim nem suporte transitório ao JSON-LD antigo. A VP continua sendo um
> objeto assinado pelo holder e `verifiableCredential` continua sendo um array com exatamente um item,
> agora uma string JWT.

## Story

Como sistema backend,
Quero validar a VC no formato JWT durante a verificação da apresentação,
Para que apenas apresentações com credencial íntegra e não-revogada sejam aprovadas.

## Acceptance Criteria

1. **Given** uma `POST /api/presentations/verify` cuja VP carrega uma VC-JWT inteira em
   `verifiableCredential: [vcJwt]`
   **When** o `VerifyPresentationUseCase` executa
   **Then** exige um JWS compacto com exatamente três segmentos base64url não vazios
   **And** decodifica header e payload sem reserializá-los para a verificação da assinatura
   **And** valida a assinatura Ed25519 do issuer sobre os bytes UTF-8 exatos de
   `<headerSegment>.<payloadSegment>`, usando a public key derivada da configuração confiável do issuer.

2. **Given** o header protegido da VC-JWT
   **When** ele é validado
   **Then** exige exatamente `alg === "EdDSA"`, `typ === "JWT"` e
   `kid === "<issuerDid>#key-1"`
   **And** o token nunca escolhe algoritmo ou chave a partir de valores não confiáveis de `alg`, `kid`
   ou `iss`.

3. **Given** o payload da VC-JWT
   **When** ele é validado
   **Then** exige `{ iss, sub, jti, iat, nbf, vc }` no formato emitido pela Story 9.1
   **And** `iss` corresponde ao issuer configurado; `sub` e `jti` são strings não vazias; `iat` e `nbf`
   são `NumericDate` inteiros; `vc` é objeto não-nulo e não-array
   **And** todos os valores de `vc` são estritamente booleanos, sem PII.

4. **Given** as 11 regras da Story 5.5
   **When** a verificação roda sobre a VC-JWT
   **Then** todas permanecem em vigor: estrutura da VP, assinatura do holder, exatamente uma VC,
   assinatura do issuer, claims booleanas, holder autenticado, nonce/challenge, janela de validade,
   DID registrado, VC não revogada e sessão `opened`
   **And** `payload.sub` substitui o antigo `vc.holder`, `payload.jti` substitui o antigo `vc.id`, e
   `payload.vc` substitui o antigo `vc.claims`.

5. **Given** a `proof_request` associada à sessão
   **When** a Regra 5 corrigida pela Story 5.8 é aplicada
   **Then** `PROOF_TYPE_CLAIM_KEY` continua sendo a única fonte do mapeamento
   `proof_type` → claim
   **And** a claim mapeada precisa existir em `payload.vc` e valer exatamente `true`
   **And** claim ausente ou `false` rejeita; claims booleanas não solicitadas não alteram o resultado.

6. **Given** todas as validações aprovadas
   **When** o use case conclui
   **Then** retorna `{ valid: true }`, transiciona a `proof_session` para `approved_by_user`, atualiza a
   `proof_request` para `approved` pelo repositório existente e dispara o webhook com o `proofType` real.

7. **Given** qualquer validação falha, incluindo VC-JWT malformada, JSON inválido, header inesperado,
   assinatura inválida, issuer/holder incompatível ou revogação on-chain
   **When** o use case conclui
   **Then** retorna `{ valid: false }` sem revelar a regra que falhou, atualiza a `proof_request` para
   `rejected` e dispara o webhook existente
   **And** entradas malformadas são tratadas como rejeição normal, nunca escapam como HTTP 500.

8. **Given** uma VP que ainda contém a credencial JSON-LD antiga
   **When** a verificação executa
   **Then** retorna `{ valid: false }`; somente a VC-JWT compacta da Story 9.1 é aceita.

## Tasks / Subtasks

- [x] Task 1: Migrar a Regra 4 do `VerifyPresentationUseCase` para JWS compacto (AC: #1, #2, #3, #7, #8)
  - [x] Em `VerifiablePresentation`, alterar `verifiableCredential` para `string[]`; manter o envelope da VP,
    `holder`, `challenge` e `proof` sem mudança.
  - [x] Depois da regra de exatamente uma VC, exigir que o item seja `string` e tenha três segmentos
    base64url estritos, não vazios.
  - [x] Decodificar header/payload e executar `JSON.parse` dentro de caminho protegido; qualquer erro chama
    `reject()`.
  - [x] Derivar a chave pública e o `issuerDid` da configuração já injetada, preservando temporariamente o
    fallback de `test-issuer-private-key` (escopo exclusivo do Epic 10).
  - [x] Validar allow-list de `alg`, `typ`, `kid` e binding de `iss` antes de aceitar o token.
  - [x] Verificar a assinatura Ed25519 contra `${headerSegment}.${payloadSegment}` original; não assinar nem
    verificar JSON reconstruído.
  - [x] Validar assinatura de 64 bytes, tipos de `sub`, `jti`, `iat`, `nbf` e objeto `vc`.
  - [x] Não adicionar `exp`, `aud`, `vc+jwt`, `@context`, `credentialSubject` ou qualquer campo não prescrito.

- [x] Task 2: Adaptar as regras existentes ao payload JWT sem alterar os efeitos do fluxo (AC: #4, #5, #6, #7)
  - [x] Normalizar o payload validado para um objeto interno mínimo `{ id: jti, holder: sub, claims: vc }`
    ou atualizar as regras diretamente, preservando a ordem e comportamento das 11 regras.
  - [x] Preservar a validação da assinatura externa da VP sobre
    `JSON.stringify({ holder, challenge, verifiableCredential })`, agora contendo a string JWT.
  - [x] Preservar `PROOF_TYPE_CLAIM_KEY` e a exigência `claims[claimKey] === true`.
  - [x] Consultar `blockchainClient.isVCRevoked(jti)`, não o antigo `vc.id`.
  - [x] Preservar transições, resposta opaca e webhook fire-and-forget.
  - [x] Não alterar controller, presenter, viewmodel, rota, middleware, repositórios ou schema.

- [x] Task 3: Migrar os testes regressivos das Stories 5.5/5.8 (AC: #4, #5, #6)
  - [x] Em `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`, substituir a fixture JSON-LD por
    VC-JWT real assinada e manter os seis cenários comportamentais existentes.
  - [x] Ajustar somente as asserções estáticas obsoletas de 5.5/5.8 se a normalização interna não preservar
    seus nomes atuais; não remover cobertura das regras anteriores.
  - [x] Confirmar que a assinatura da VP inclui a string JWT exatamente como recebida.

- [x] Task 4: Criar cobertura própria da Story 9.2 (AC: #1–#8)
  - [x] Criar `tests/unit/story-9-2/vc-jwt-verification.test.mjs` com verificações estruturais do formato novo,
    ausência do parse JSON-LD antigo, preservação das 11 regras e `tsc --noEmit`.
  - [x] Criar `tests/unit/story-9-2/verify-presentation-vc-jwt.dynamic.test.ts` com JWS/VP reais e fakes de
    repositório, blockchain e webhook.
  - [x] Cobrir happy path; `jti` enviado à revogação; JSON-LD legado; quantidade/segmentos/base64url/JSON
    inválidos; assinatura adulterada ou com tamanho inválido; `alg`, `typ`, `kid` e `iss` inválidos;
    `sub`, `jti`, `iat`, `nbf` e `vc` inválidos; claim não booleana; claim solicitada ausente/false.
  - [x] Cobrir falhas preservadas: assinatura da VP, nonce, challenge expirado, sessão não aberta, DID não
    registrado, VC revogada e erro do client blockchain.
  - [x] Em falhas após sessão/request válidas, afirmar `{ valid: false }`, status `rejected`, webhook sem
    detalhe; no sucesso, afirmar sessão/request aprovadas e webhook com `proofType` real.
  - [x] Adicionar `test:story:9.2` ao `package.json` usando `node:test` + `tsx --test`, sem dependência nova.

- [x] Task 5: Verificar regressões e registrar conclusão (AC: #1–#8)
  - [x] Rodar testes focados 5.5, 5.8, 9.1 e 9.2.
  - [x] Rodar typecheck, lint nos arquivos alterados e a suíte completa `npm test`.
  - [x] Atualizar este arquivo: tasks, Dev Agent Record, File List, Completion Notes e Change Log.

### Review Findings

- [x] [Review][Patch] Rejeitar parâmetros JOSE críticos não suportados (`crit`/`b64`) [src/modules/presentation/app/verify_presentation_usecase.ts:223]
- [x] [Review][Patch] Fazer o teste de assinatura curta alcançar a validação de 64 bytes [tests/unit/story-9-2/verify-presentation-vc-jwt.dynamic.test.ts:333]
- [x] [Review][Patch] Permitir que a fixture represente credencial `null` sem cair no valor padrão [tests/unit/story-9-2/verify-presentation-vc-jwt.dynamic.test.ts:188]
- [x] [Review][Defer] Challenge com timestamp futuro pode contornar a janela de dez minutos [src/modules/presentation/app/verify_presentation_usecase.ts:299] — deferred, pre-existing
- [x] [Review][Defer] Chamadas blockchain não têm timeout explícito [src/modules/presentation/app/verify_presentation_usecase.ts:309] — deferred, pre-existing
- [x] [Review][Defer] Request terminal pode ser reaprovada se a sessão continuar `OPENED` [src/modules/presentation/app/verify_presentation_usecase.ts:107] — deferred, pre-existing
- [x] [Review][Defer] Submissões concorrentes podem emitir decisões/webhooks contraditórios [src/modules/presentation/app/verify_presentation_usecase.ts:113] — deferred, pre-existing
- [x] [Review][Defer] Aprovação de sessão e request não é persistida atomicamente [src/modules/presentation/app/verify_presentation_usecase.ts:332] — deferred, pre-existing

## Dev Notes

### Contexto atual do código

O único arquivo de produção que precisa mudar é
`src/modules/presentation/app/verify_presentation_usecase.ts`. Hoje ele:

- valida a VP externa e sua assinatura Ed25519;
- exige uma única VC;
- espera a VC como objeto JSON-LD e verifica `vc.proof.signatureValue` sobre JSON reserializado;
- usa `vc.claims`, `vc.holder` e `vc.id` nas regras posteriores;
- já carrega a `proof_request`, preserva a correspondência claim ↔ `proof_type`, transiciona status e
  dispara o webhook.

A menor mudança correta é trocar apenas o bloco JSON-LD por parse/validação JWS e normalizar os campos
validados para os nomes internos consumidos pelas regras seguintes.

### Contrato exato herdado da Story 9.1

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
  "iat": 1786400000,
  "nbf": 1786400000,
  "vc": { "personhood": true, "ageOver18": false }
}
```

O signing input é literalmente `ASCII(base64url(header) + "." + base64url(payload))`. Header e payload
devem ser decodificados para validar shape, mas a assinatura é verificada sobre os segmentos originais.

### Segurança e escopo

- A chave confiável vem da configuração injetada. `alg`, `kid` e `iss` apenas precisam corresponder ao
  esperado; nunca selecionam chave nem algoritmo.
- Validar explicitamente o alfabeto base64url antes de `atob`, pois o helper atual é permissivo.
- `typeof value === "object"` também aceita arrays e `null`; rejeitar ambos para header, payload e `vc`.
- Não persistir nem registrar em log a VP, a VC-JWT, claims ou DID do holder.
- `updated_at` é citado pelo AC do épico, mas a implementação física da coluna/migration é da Story 7.2,
  ainda em backlog. Esta story preserva `requestRepo.updateStatus()` e não absorve migration/repositório.
- `revoke_credential_usecase.ts` ainda recebe o conceito antigo `vcId`; esse gap separado permanece fora do
  escopo. Dentro da verificação da 9.2, entretanto, o lookup de revogação precisa usar `jti`.
- `CONTEXT.md` contém um shape aproximado anterior no verbete VC; para o formato de serialização, PRD,
  arquitetura, Epic 9 e Story 9.1 têm precedência.

### Arquitetura e bibliotecas

- Manter `route → presenter → controller → use case`; toda lógica JWS fica no use case.
- Reutilizar `@noble/ed25519@^3.1.0`; seus métodos assíncronos aceitam `Uint8Array` e a API oficial expõe
  `verifyAsync(signature, message, publicKey)`.
- Não criar provider/interface/factory nova para um único uso e não adicionar dependência JOSE.
- O RFC 7515 define JWS compacto como `BASE64URL(header).BASE64URL(payload).BASE64URL(signature)` e o
  signing input como os dois primeiros segmentos; o RFC 8037 registra EdDSA para JOSE.

### Testes e baseline

- Padrão do projeto: `node:test` + `node:assert/strict`; testes dinâmicos TypeScript por `tsx --test`;
  fakes em memória; comportamento externo antes de regex estrutural.
- Baseline observado durante a criação: 19 testes estáticos da Story 5.8 passaram. A etapa dinâmica não
  iniciou porque `tsx` está declarado, mas não materializado em `node_modules` nesta sessão.
- A suíte registrada ao final da Story 9.1 tinha 627 testes passando. Materializar dependências antes da
  validação dinâmica, sem alterar versões do lockfile.

### Latest Tech Information

- `@noble/ed25519` v3 documenta `signAsync`/`verifyAsync` e uso de `Uint8Array`:
  https://github.com/paulmillr/noble-ed25519
- JWS Compact Serialization e validation steps:
  https://www.rfc-editor.org/rfc/rfc7515.html
- EdDSA em JOSE:
  https://www.rfc-editor.org/rfc/rfc8037.html

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.2]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8]
- [Source: _bmad-output/planning-artifacts/architecture.md#Credenciais & Formato da VC]
- [Source: _bmad-output/planning-artifacts/prd.md#Identidade descentralizada e criptografia]
- [Source: _bmad-output/implementation-artifacts/stories/9-1-emissao-da-vc-como-vc-jwt-eddsa.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]
- [Source: src/modules/presentation/app/verify_presentation_usecase.ts]
- [Source: tests/unit/story-5-5/presentation-verification.test.mjs]
- [Source: tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs]
- [Source: tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `npm run test:story:5.8`, `npm run test:story:9.1`, `npm run test:story:9.2`
- `npm run test:dynamic`
- `tsc --noEmit`
- `npm run lint -- <arquivos alterados>`
- `npm test` (baseline global: duas falhas preexistentes e fora do escopo nas Stories 1.5/1.6, cujos testes
  esperam `window.location.href` mas as páginas atuais usam `router.push`)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Migração do parser/verificador de VC JSON-LD para JWS compacto EdDSA concluída sem alterar a rota ou as
  demais camadas do fluxo.
- Header e payload são validados contra o issuer configurado; a assinatura usa os segmentos compactos
  originais; payload normalizado mantém as 11 regras e a correspondência claim ↔ `proof_type`.
- JSON-LD legado e entradas JWS malformadas são rejeitados de forma opaca com os efeitos de status/webhook
  existentes; revogação usa `jti`.
- Story 9.2: 41/41 testes focados passando (6 estáticos + 35 dinâmicos); matriz dinâmica global: 45/45;
  regressões focadas 5.5, 5.8 e 9.1 passando; typecheck e lint passando.
- `npm test` foi executado: somente duas falhas preexistentes de redirecionamento nas Stories 1.5/1.6,
  sem relação com os arquivos desta story; a etapa dinâmica global passou separadamente.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/stories/9-2-verificacao-da-vc-jwt-em-presentations-verify.md`
- `package.json`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `src/modules/presentation/app/verify_presentation_usecase.ts`
- `tests/unit/story-5-5/presentation-verification.test.mjs`
- `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`
- `tests/unit/story-9-2/vc-jwt-verification.test.mjs`
- `tests/unit/story-9-2/verify-presentation-vc-jwt.dynamic.test.ts`

## Change Log

- **2026-08-11** — Story criada via `bmad-create-story`; análise paralela de arquitetura, histórico da 9.1,
  fluxo de código e testes; decisões herdadas e guardrails de segurança consolidados. Status →
  `ready-for-dev`.
- **2026-08-11** — Implementação e testes concluídos: verificação VC-JWT EdDSA, rejeição do formato legado,
  regressões 5.5/5.8 migradas e cobertura dinâmica de segurança adicionada. Status → `review`.
- **2026-08-11** — Code review adversarial concluída: 3 patches aplicados, 5 achados preexistentes
  registrados em deferred work e 9 descartados por conflito com o contrato fechado da 9.1 ou falta de
  evidência. Status → `test`.
- **2026-08-11** — QA concluído: cobertura 8/8 ACs, teste adicional provando uso dos segmentos JWS originais,
  41/41 testes focados e 45/45 dinâmicos globais passando. Status → `done`.
