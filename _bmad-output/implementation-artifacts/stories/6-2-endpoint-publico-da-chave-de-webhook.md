# Story 6.2: Endpoint Público da Chave de Webhook

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como empresa parceira,
Quero obter a chave pública Ed25519 da YaID,
Para que meu sistema possa verificar a autenticidade das notificações de webhook recebidas.

## Acceptance Criteria

1. **Given** uma chamada `GET /api/webhook-public-key` sem autenticação
   **When** o endpoint processa
   **Then** retorna HTTP 200 com `{ publicKey: "<base64-encoded-public-key>", algorithm: "Ed25519" }`
   **And** a public key retornada é derivada de `WEBHOOK_SIGNING_PRIVATE_KEY` — a mesma chave usada para assinar os webhooks
   **And** a resposta é determinística: chamadas repetidas retornam sempre a mesma chave enquanto a env var não muda

2. **Given** uma empresa que recebeu um webhook com `X-YaID-Signature` e `X-YaID-Timestamp`
   **When** usa a `publicKey` retornada por este endpoint para verificar a assinatura
   **Then** `verify(signature, rawBody, publicKey)` retorna `true` para webhooks legítimos
   **And** retorna `false` para qualquer payload adulterado ou assinatura forjada

3. **Given** `WEBHOOK_SIGNING_PRIVATE_KEY` ausente
   **When** `STAGE` é `PROD` ou `HOMOLOG`
   **Then** o servidor falha ao iniciar com erro explícito — nunca sobe com chave ausente
   **And** em `DOTENV`/`DEV`, o getter de webhook falha explicitamente quando o endpoint dependente for usado sem a env configurada

## Tasks / Subtasks

- [x] Task 1: Criar `GetWebhookPublicKeyUseCase` — deriva a public key Ed25519 a partir da private key (AC: #1, #2)
  - [x] Criar `src/modules/webhook/app/get_webhook_public_key_usecase.ts`
  - [x] Constructor recebe `webhookSigningPrivateKey: string` (mesmo padrão de `IssueCredentialUseCase` recebendo `issuerPrivateKey` — ver Dev Notes)
  - [x] `execute()`: converte a private key hex para bytes, deriva a public key via `ed.getPublicKeyAsync(privateKeyBytes)` de `@noble/ed25519`, codifica em **base64 padrão** (não base64url — ver Dev Notes) via `Buffer.from(bytes).toString("base64")`
  - [x] Replicar o fallback de chave de teste: se `webhookSigningPrivateKey === "test-webhook-signing-private-key"` (valor do `TEST_ENV`), substituir por uma chave hex fixa e válida de 64 caracteres antes de decodificar (mesmo padrão usado em `IssueCredentialUseCase` para `ISSUER_PRIVATE_KEY` — ver Dev Notes para o valor exato a usar, distinto do do issuer)
  - [x] Retornar `{ publicKey: string, algorithm: "Ed25519" }`

- [x] Task 2: Criar viewmodel, controller e presenter (AC: #1)
  - [x] `src/modules/webhook/app/get_webhook_public_key_viewmodel.ts` — `export type GetWebhookPublicKeyOutputDTO = { publicKey: string; algorithm: "Ed25519" }`
  - [x] `src/modules/webhook/app/get_webhook_public_key_controller.ts` — `handle()` sem input, delega direto a `useCase.execute()` (endpoint não recebe parâmetros nem body)
  - [x] `src/modules/webhook/app/get_webhook_public_key_presenter.ts` — `makeGetWebhookPublicKeyController()`: lê `Environments.getEnvs().WEBHOOK_SIGNING_PRIVATE_KEY` e injeta no use case (o getter já lança erro se a env não estiver configurada — não precisa de tratamento adicional aqui)

- [x] Task 3: Criar a rota `GET /api/webhook-public-key` (AC: #1, #3)
  - [x] Criar `app/api/webhook-public-key/route.ts` — `export async function GET()`, chama o presenter/controller, `NextResponse.json(result, { status: 200 })`, `catch` com `handleHttpError`
  - [x] **Não alterar `src/shared/middleware.ts`** — a rota já está classificada como pública em `isPublicApiRoute` (linha 34: `pathname === "/api/webhook-public-key" && method === "GET"`)
  - [x] **Não alterar `src/shared/environments.ts`** — `WEBHOOK_SIGNING_PRIVATE_KEY` já existe no schema, no `TEST_ENV`, na lista `productionRequiredEnvNames` (falha de boot em PROD/HOMOLOG) e como getter com `requireConfiguredValue` (falha explícita quando ausente em DEV/DOTENV) — toda a validação do AC #3 já está implementada por stories anteriores

- [x] Task 4: Validar build, testes e round-trip de assinatura (AC: todos)
  - [x] Escrever teste que assina um payload com a private key de teste via `ed.signAsync` e verifica com a public key retornada pelo use case via `ed.verifyAsync` — deve retornar `true`; com payload adulterado, deve retornar `false` (AC #2)
  - [x] Escrever teste que chama o use case duas vezes com a mesma private key e confirma que a `publicKey` retornada é idêntica (AC #1, determinismo)
  - [x] Rodar `getDiagnostics`/`npx tsc --noEmit` — zero erros TypeScript
  - [x] Rodar `npm run test` — sem regressão nos testes existentes

### Review Findings

- [x] [Review][Patch] `hexToBytes` não valida o formato hex — caracteres não-hex viram `NaN`→`0` silenciosamente (via coerção do `Uint8Array`) e hex de tamanho ímpar é truncado sem erro; um `WEBHOOK_SIGNING_PRIVATE_KEY` malformado gera uma public key plausível mas errada, sem nenhum erro sinalizado [src/modules/webhook/app/get_webhook_public_key_usecase.ts:7-13]
- [x] [Review][Patch] Substituição da chave de teste não é restrita ao stage `TEST` — se `WEBHOOK_SIGNING_PRIVATE_KEY` for igual à string literal `"test-webhook-signing-private-key"` em PROD/HOMOLOG/DEV (ex.: `.env` mal copiado), o código troca silenciosamente por uma chave privada fixa e conhecida (publicada nesta própria story e no arquivo de teste) em vez de falhar — deriva e expõe publicamente a public key correspondente a uma chave privada que qualquer um pode ver no código-fonte [src/modules/webhook/app/get_webhook_public_key_usecase.ts:25-27]
- [x] [Review][Defer] Sem cache da public key entre requisições — a resposta é determinística e computa a derivação Ed25519 a cada `GET`; otimização de performance, não exigida pelos ACs — deferred
- [x] [Review][Defer] Duplicação de forma entre `GetWebhookPublicKeyOutput` (usecase) e `GetWebhookPublicKeyOutputDTO` (viewmodel), e o literal `"Ed25519"` repetido em 3 lugares — sem fonte única de verdade; refactor de baixo risco fora de escopo desta story — deferred

## Dev Notes

### A maior parte da infraestrutura de env já existe — não recriar

`src/shared/environments.ts` **já tem tudo** que este endpoint precisa, implementado por stories anteriores (provavelmente como scaffolding antecipado do Epic 6):

```typescript
// já existe, não modificar:
const productionRequiredEnvNames = [
  "ISSUER_PRIVATE_KEY",
  "WEBHOOK_SIGNING_PRIVATE_KEY",   // já na lista de obrigatórias em PROD/HOMOLOG
  "BLOCKCHAIN_WALLET_PRIVATE_KEY",
  "BLOCKCHAIN_CONTRACT_ADDRESS",
] as const;

// já existe no schema (optional a nível de zod, mas validada condicionalmente via superRefine acima)
WEBHOOK_SIGNING_PRIVATE_KEY: z.string().min(1).optional(),

// já existe no TEST_ENV:
WEBHOOK_SIGNING_PRIVATE_KEY: "test-webhook-signing-private-key",

// já existe o getter, com throw explícito se ausente:
get WEBHOOK_SIGNING_PRIVATE_KEY() {
  return requireConfiguredValue(this.values.WEBHOOK_SIGNING_PRIVATE_KEY, "WEBHOOK_SIGNING_PRIVATE_KEY");
}
```

Isso significa que o **AC #3 inteiro já está coberto** por código existente — não precisa adicionar nada em `environments.ts`. A story só precisa **consumir** `envs.WEBHOOK_SIGNING_PRIVATE_KEY` no presenter.

### Middleware já classifica a rota como pública — não modificar

`src/shared/middleware.ts`, função `isPublicApiRoute` (linha ~31-37):

```typescript
function isPublicApiRoute(pathname: string, method: string): boolean {
  if (/^\/api\/proof-sessions\/[^/]+$/.test(pathname) && method === "GET") return true;
  if (pathname === "/api/webhook-public-key" && method === "GET") return true;  // já existe
  if (pathname === "/api/auth/sign-up" && method === "POST") return true;
  return false;
}
```

Nenhuma mudança de middleware é necessária nesta story.

### `WebhookSigner` (interface de assinatura) NÃO é necessária para esta story

A Story 6.1 (WebhookSigner e Entrega de Webhook) ainda está em `backlog` e é **independente** desta story. A interface `WebhookSigner` (que define `sign()`) é para *assinar* webhooks — Story 6.2 apenas *deriva a public key* a partir da mesma private key, uma operação criptográfica pura sem qualquer dependência do `WebhookSigner`. Não é necessário aguardar ou implementar a Story 6.1 antes desta.

### Padrão de derivação de public key Ed25519 — replicar de `IssueCredentialUseCase`

O padrão exato já existe em `src/modules/credential/app/issue_credential_usecase.ts` para `ISSUER_PRIVATE_KEY` — replicar para `WEBHOOK_SIGNING_PRIVATE_KEY`:

```typescript
// src/modules/credential/app/issue_credential_usecase.ts (padrão de referência)
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ...
let privateKeyHex = this.issuerPrivateKey;
if (privateKeyHex === "test-issuer-private-key") {
  privateKeyHex = "0000000000000000000000000000000000000000000000000000000000000001";
}
const privateKeyBytes = hexToBytes(privateKeyHex);
const issuerPubKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
```

**Para esta story**, o valor de teste do `TEST_ENV` é `"test-webhook-signing-private-key"` (string literal, não hex — decodificar direto quebraria). Use um fallback hex fixo de 64 caracteres **distinto** do do issuer para não colidir em testes que comparam as duas public keys, por exemplo:

```typescript
if (privateKeyHex === "test-webhook-signing-private-key") {
  privateKeyHex = "0000000000000000000000000000000000000000000000000000000000000002";
}
```

`hexToBytes`/`bytesToHex` não têm um util compartilhado no projeto — cada módulo que precisa duplica as funções localmente (mesmo padrão em `issue_credential_usecase.ts`, `verify_presentation_usecase.ts`, `withDIDAuth.ts`, `revoke_credential_usecase.ts`). Seguir a mesma duplicação local nesta story — extrair um util compartilhado é refactor fora de escopo.

### ATENÇÃO: encoding é base64 padrão, não base64url

O AC #1 pede explicitamente `"<base64-encoded-public-key>"`. Isso é **diferente** do padrão usado em outras partes do código para DIDs, que usam **hex** (`did:yaid:issuer:<hex>`) ou, em alguns lugares do módulo `credential`, **base64url** (`base64urlToBytes`/`bytesToBase64url` em `issue_credential_usecase.ts`, usados para o corpo assinado do request, não para DIDs).

Para esta story, use **base64 padrão** (`+`/`/`, com padding `=`), via `Buffer.from(bytes).toString("base64")` — já usado no projeto em `Sha256ApiKeyHasher.ts` e `ApiOcrProvider.ts`. Não reutilize `bytesToBase64url` do módulo credential — o encoding é diferente (`-`/`_` sem padding) e quebraria a verificação no lado da empresa parceira se ela decodificar como base64 padrão.

### Estrutura de módulo (Clean Architecture já estabelecida)

Seguir exatamente o padrão de `src/modules/proof-session/app/get_proof_session_{usecase,controller,presenter}.ts` (endpoint GET público, sem input) e `src/modules/credential/app/issue_credential_presenter.ts` (injeção de private key lida de `Environments` no presenter, não no use case):

```typescript
// src/modules/webhook/app/get_webhook_public_key_presenter.ts (padrão a seguir)
import { Environments } from "@/shared/environments";
import { GetWebhookPublicKeyUseCase } from "./get_webhook_public_key_usecase";
import { GetWebhookPublicKeyController } from "./get_webhook_public_key_controller";

export async function makeGetWebhookPublicKeyController() {
  const envs = Environments.getEnvs();
  return new GetWebhookPublicKeyController(
    new GetWebhookPublicKeyUseCase(envs.WEBHOOK_SIGNING_PRIVATE_KEY)
  );
}
```

```typescript
// app/api/webhook-public-key/route.ts (padrão a seguir: app/api/companies/me/route.ts)
import { NextResponse } from "next/server";
import { makeGetWebhookPublicKeyController } from "@/modules/webhook/app/get_webhook_public_key_presenter";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function GET() {
  try {
    const controller = await makeGetWebhookPublicKeyController();
    const result = await controller.handle();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}
```

### Teste de round-trip (AC #2) — sem chamada de rede

O teste de verificação (`sign` → `verify`) pode ser feito 100% em memória usando `@noble/ed25519` diretamente no arquivo de teste, sem precisar do endpoint HTTP nem de mocks de rede:

```javascript
import * as ed from "@noble/ed25519";
const privateKeyHex = "0000000000000000000000000000000000000000000000000000000000000002"; // mesmo fallback usado no use case
const privateKeyBytes = hexToBytes(privateKeyHex);
const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
const payload = new TextEncoder().encode(JSON.stringify({ status: "approved" }));
const signature = await ed.signAsync(payload, privateKeyBytes);
const isValid = await ed.verifyAsync(signature, payload, publicKeyBytes);
assert.equal(isValid, true);

const tamperedPayload = new TextEncoder().encode(JSON.stringify({ status: "rejected" }));
const isInvalid = await ed.verifyAsync(signature, tamperedPayload, publicKeyBytes);
assert.equal(isInvalid, false);
```

### Convenções do projeto

- Path aliases: `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`
- Shape de erro HTTP: `handleHttpError` retorna `{ error: { code, message } }` — pré-existente, sem mudança necessária
- `npm run build` tem erros pré-existentes de tipos Next.js; usar `getDiagnostics`/`npx tsc --noEmit` para validar
- Testes do projeto usam `node:test` + `node:assert/strict`, sem jsdom (convenção de todas as stories anteriores)
- Biblioteca de assinatura: `@noble/ed25519` (já é dependência do projeto, usada em `withDIDAuth.ts`, `issue_credential_usecase.ts`, `revoke_credential_usecase.ts`, `verify_presentation_usecase.ts`)

### Estrutura de arquivos desta story

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/modules/webhook/app/get_webhook_public_key_usecase.ts` | CRIAR | Deriva a public key Ed25519 a partir de `WEBHOOK_SIGNING_PRIVATE_KEY` |
| `src/modules/webhook/app/get_webhook_public_key_viewmodel.ts` | CRIAR | DTO `{ publicKey, algorithm }` |
| `src/modules/webhook/app/get_webhook_public_key_controller.ts` | CRIAR | Controller sem input |
| `src/modules/webhook/app/get_webhook_public_key_presenter.ts` | CRIAR | Factory — injeta `envs.WEBHOOK_SIGNING_PRIVATE_KEY` |
| `app/api/webhook-public-key/route.ts` | CRIAR | Handler `GET` |

**NÃO alterar:**
- `src/shared/environments.ts` — toda a infraestrutura de `WEBHOOK_SIGNING_PRIVATE_KEY` já existe
- `src/shared/middleware.ts` — rota já classificada como pública em `isPublicApiRoute`
- Qualquer arquivo do módulo `credential` — apenas referência de padrão, não modificar

### References

- [Epics: Story 6.2 AC](_bmad-output/planning-artifacts/epics.md#story-62-endpoint-público-da-chave-de-webhook) — linhas 988-1010
- [Epics: FR21](_bmad-output/planning-artifacts/epics.md) — linha 60/148
- [Epics: NFR2/NFR3 — chaves assimétricas e env vars](_bmad-output/planning-artifacts/epics.md) — linhas 74-76
- [Architecture: estrutura de módulos — webhook/app](_bmad-output/planning-artifacts/architecture.md) — linha 500-501
- [Architecture: rotas públicas](_bmad-output/planning-artifacts/architecture.md) — linha 226
- [environments.ts (WEBHOOK_SIGNING_PRIVATE_KEY já implementado)](src/shared/environments.ts)
- [Padrão de derivação de public key: src/modules/credential/app/issue_credential_usecase.ts](src/modules/credential/app/issue_credential_usecase.ts)
- [Padrão de presenter com injeção de private key: src/modules/credential/app/issue_credential_presenter.ts](src/modules/credential/app/issue_credential_presenter.ts)
- [Padrão de rota GET pública sem input: app/api/companies/me/route.ts](app/api/companies/me/route.ts)
- [Padrão de módulo GET público: src/modules/proof-session/app/get_proof_session_presenter.ts](src/modules/proof-session/app/get_proof_session_presenter.ts)
- [Middleware — rota pública já classificada: src/shared/middleware.ts](src/shared/middleware.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

### Completion Notes List

- Confirmado antes de implementar: `src/shared/environments.ts` e `src/shared/middleware.ts` já tinham toda a infraestrutura necessária (`WEBHOOK_SIGNING_PRIVATE_KEY` no schema/TEST_ENV/getter/validação de boot PROD-HOMOLOG, e a rota já classificada como pública) — nenhum dos dois arquivos foi modificado, conforme dev notes
- `src/modules/webhook/app/get_webhook_public_key_usecase.ts` criado: deriva a public key Ed25519 via `ed.getPublicKeyAsync`, replica o padrão de fallback de chave de teste hex do `IssueCredentialUseCase` (usando um valor distinto do issuer, terminado em `...002`, para evitar colisão em testes), codifica em base64 padrão via `Buffer.from(...).toString("base64")` (não base64url)
- `get_webhook_public_key_{viewmodel,controller,presenter}.ts` criados seguindo exatamente o padrão de `get_proof_session_*` (endpoint GET público sem input) e `issue_credential_presenter.ts` (injeção de private key lida de `Environments` no presenter)
- `app/api/webhook-public-key/route.ts` criado: handler `GET` sem parâmetros, delega ao presenter/controller, `handleHttpError` no catch
- 18 novos testes: 3 comportamentais de round-trip Ed25519 real (sign com a chave de teste → verify com a public key derivada retorna `true`; payload adulterado retorna `false`; assinatura forjada com outra chave retorna `false`), 1 teste de determinismo do encoding base64, e 14 testes estruturais cobrindo uso do use case/viewmodel/controller/presenter/rota e confirmando que `middleware.ts`/`environments.ts` não precisaram de alteração
- `npx tsc --noEmit`: zero erros. `npx eslint`: zero erros/warnings nos arquivos tocados. `npm run test`: 518/518 passando (500 anteriores + 18 novos da story, ajustados para 23 após os patches), sem regressões
- **Patches do code review aplicados (2/2):** `hexToBytes` agora valida o formato via `HEX_PRIVATE_KEY_PATTERN = /^[0-9a-fA-F]{64}$/` e lança erro explícito em vez de coagir caracteres inválidos para `0` ou truncar hex de tamanho ímpar; a substituição da chave de teste (`test-webhook-signing-private-key` → hex fixo) agora só ocorre quando `stage === Stage.TEST` — em qualquer outro stage, a presença do placeholder literal lança erro explícito em vez de derivar e expor silenciosamente uma chave privada conhecida. Isso exigiu adicionar `stage: Stage` como segundo parâmetro do constructor de `GetWebhookPublicKeyUseCase` (injetado pelo presenter via `envs.stage`, seguindo o mesmo padrão de injeção pura já usado para `webhookSigningPrivateKey`, sem o usecase acessar `Environments.getEnvs()` diretamente — mantém a convenção estabelecida no projeto de que só presenters tocam `Environments`)
- 6 novos testes adicionados para os patches (validação de hex malformado/tamanho ímpar/válido, gate de stage no source, constructor com `stage: Stage`, presenter injetando `envs.stage`)

### File List

**Criados:**
- `src/modules/webhook/app/get_webhook_public_key_usecase.ts`
- `src/modules/webhook/app/get_webhook_public_key_viewmodel.ts`
- `src/modules/webhook/app/get_webhook_public_key_controller.ts`
- `src/modules/webhook/app/get_webhook_public_key_presenter.ts`
- `app/api/webhook-public-key/route.ts`
- `tests/unit/story-6-2/webhook-public-key.test.mjs`

**Modificados:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-07-22: Implementação completa da Story 6.2 — endpoint público `GET /api/webhook-public-key` que deriva e expõe a chave pública Ed25519 a partir de `WEBHOOK_SIGNING_PRIVATE_KEY`. Toda a infraestrutura de validação de env e classificação de rota pública já existia; nenhuma mudança em `environments.ts` ou `middleware.ts` foi necessária.
- 2026-07-22: Aplicados os 2 achados `[Review][Patch]` do code review (validação de formato hex na derivação da chave, e gate por stage na substituição da chave de teste — previne uso silencioso de uma chave privada conhecida fora do stage `TEST`). 2 achados `[Review][Defer]` registrados em `deferred-work.md`.
