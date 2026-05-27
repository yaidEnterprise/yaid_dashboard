# Story 5.1: Middleware de Auth por DID (withDIDAuth)

Status: done

## Story

Como sistema backend,
Quero validar requisições do app mobile via assinatura da chave privada do holder,
Para que apenas o holder legítimo possa emitir, verificar ou revogar suas credenciais.

## Acceptance Criteria

1. **Given** uma requisição com headers `X-YaID-DID`, `X-YaID-Signature` e `X-YaID-Timestamp` válidos
   **When** `withDIDAuth` processa o request
   **Then** a public key é extraída diretamente do DID no formato `did:yaid:user:<holder-public-key-hex>`
   **And** a assinatura é verificada contra o payload canônico `{timestamp}:{method}:{pathname}` usando a public key extraída
   **And** se válida, o DID autenticado é anexado ao contexto do request via header `x-holder-did` para uso pelos controllers

2. **Given** um DID malformado (não segue `did:yaid:user:<pubkey>` ou public key não decodificável como hex de 32 bytes)
   **When** o middleware valida
   **Then** retorna HTTP 401 com `{ error: "Invalid DID" }`

3. **Given** um header `X-YaID-Timestamp` com timestamp fora da janela de ±5 minutos (300 segundos)
   **When** o middleware valida
   **Then** retorna HTTP 401 com `{ error: "Request expired" }` — protege contra replay attacks

4. **Given** uma assinatura inválida (payload adulterado ou chave errada)
   **When** o middleware valida
   **Then** retorna HTTP 401 com `{ error: "Invalid signature" }`

5. **Given** qualquer header ausente entre `X-YaID-DID`, `X-YaID-Signature`, `X-YaID-Timestamp`
   **When** o middleware valida
   **Then** retorna HTTP 401 com `{ error: "Missing auth headers" }`

## Tasks / Subtasks

- [x] Task 1: Instalar `@noble/ed25519` (AC: #1)
  - [x] Executar `npm install @noble/ed25519`
  - [x] Verificar que o build continua passando após instalação

- [x] Task 2: Implementar `withDIDAuth.ts` substituindo o stub (AC: #1–#5)
  - [x] Abrir `src/shared/middlewares/withDIDAuth.ts` — o stub atual retorna `NextResponse.next()` incondicionalmente
  - [x] Verificar presença dos três headers (`X-YaID-DID`, `X-YaID-Signature`, `X-YaID-Timestamp`); retornar 401 `{ error: "Missing auth headers" }` se qualquer um faltar
  - [x] Validar o timestamp: parsear como inteiro Unix segundos; se `Math.abs(Date.now() / 1000 - timestamp) > 300`, retornar 401 `{ error: "Request expired" }`
  - [x] Validar o DID: deve seguir `did:yaid:user:<hex>`; extrair a parte `<hex>` e decodificar para `Uint8Array` de 32 bytes; se inválido, retornar 401 `{ error: "Invalid DID" }`
  - [x] Construir o payload canônico: string UTF-8 `{timestamp}:{method}:{pathname}` onde method é `request.method` e pathname é `request.nextUrl.pathname`
  - [x] Decodificar a assinatura do header `X-YaID-Signature` de base64url para `Uint8Array`
  - [x] Usar `@noble/ed25519` para verificar: `await ed.verifyAsync(signatureBytes, payloadBytes, publicKeyBytes)`; se falhar, retornar 401 `{ error: "Invalid signature" }`
  - [x] Se válido, retornar `NextResponse.next({ request: { headers: newHeaders } })` com header `x-holder-did` adicionado (mesmo padrão de `withSessionAuth` que adiciona `x-company-id`)

- [x] Task 3: Validar build e testes (AC: #1–#5)
  - [x] Executar `npm run build` — build limpo, 21 rotas geradas, sem erros TypeScript
  - [x] Executar `npm test` — 166/166 testes passando, zero regressão

### Review Findings (2026-05-27)

- [x] [Review][Patch] Sem validação de byte-length da assinatura antes da chamada crypto — adicionado `if (signatureBytes.length !== 64) return 401` antes de `ed.verifyAsync` [`src/shared/middlewares/withDIDAuth.ts:~60`]
- [x] [Review][Patch] `parseInt` aceita lixo de sufixo no timestamp e comparação usa float — substituído por `Number(tsHeader)` + `Number.isInteger()` + comparação em ms inteiros `Math.abs(Date.now() - timestamp * 1000) > 300_000` [`src/shared/middlewares/withDIDAuth.ts:~30`]
- [x] [Review][Defer] `@noble/ed25519` v3 requer `crypto.subtle` — disponível no Edge runtime; catch já trata falha como 401; risco apenas se migrado para Node.js runtime — deferred, pre-existing
- [x] [Review][Defer] Cookies de sessão Supabase não propagados no return do `withDIDAuth` — aceitável para rotas DID-only chamadas por app mobile sem sessão Supabase no MVP — deferred, pre-existing
- [x] [Review][Defer] Header `x-holder-did` sem consumer downstream ainda — esperado; stories 5.3–5.6 implementarão os controllers que lêem o header — deferred, pre-existing
- [x] [Review][Defer] Case do method no payload canônico não documentado — `request.method` é sempre uppercase no Next.js; mobile client deve assinar com uppercase — deferred, pre-existing
- [x] [Review][Defer] Sem testes unitários dedicados para `withDIDAuth` — explicitamente excluído pelo spec da story; critério de validação é build + suite existente — deferred, pre-existing

## Dev Notes

### Decisão de Library: @noble/ed25519

A arquitetura marca o algoritmo de verificação como ⚠️ TBD. **Usar `@noble/ed25519` v2.x** pelos seguintes motivos:

- **Edge runtime compatível**: o middleware do Next.js roda em Edge runtime (sem Node.js `crypto`); `@noble/ed25519` usa `globalThis.crypto.subtle` (Web Crypto API, disponível no Edge) sob o capô
- **Zero dependências** de outras libs externas
- **Auditada** (Trail of Bits, uma das poucas libs criptográficas que passou por auditoria independente)
- **API async**: `ed.verify(sig, msg, pubKey)` — retorna `Promise<boolean>`, compatível com o middleware `async`
- Alternativa descartada: Node.js `crypto.verify` — não disponível no Edge runtime

### Formato do DID e Public Key

O DID segue `did:yaid:user:<holder-public-key-hex>`. A public key é um array de 32 bytes Ed25519 codificado em hexadecimal lowercase.

Extração:
```typescript
const parts = did.split(":");
// did:yaid:user:<hex> → parts = ["did", "yaid", "user", "<hex>"]
if (parts.length !== 4 || parts[0] !== "did" || parts[1] !== "yaid" || parts[2] !== "user") {
  // Invalid DID format
}
const hex = parts[3];
if (!/^[0-9a-f]{64}$/.test(hex)) {
  // Not 32-byte hex
}
const publicKeyBytes = hexToBytes(hex); // Uint8Array de 32 bytes
```

Utilitário `hexToBytes` (sem dependências externas):
```typescript
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}
```

### Formato da Assinatura

O header `X-YaID-Signature` carrega a assinatura Ed25519 (64 bytes) codificada em **base64url** (sem padding `=`).

Decodificação:
```typescript
function base64urlToBytes(b64: string): Uint8Array {
  // Adicionar padding se necessário
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const bin = atob(base64); // atob está disponível no Edge runtime
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
```

### Payload Canônico Assinado

O app mobile assina o payload canônico:
```
{timestamp}:{method}:{pathname}
```

Exemplo: `1748384400:POST:/api/credentials/issue`

O timestamp é Unix time em segundos (inteiro). No backend:
```typescript
const timestamp = request.headers.get("X-YaID-Timestamp")!;
const method = request.method;
const pathname = request.nextUrl.pathname;
const payload = `${timestamp}:${method}:${pathname}`;
const payloadBytes = new TextEncoder().encode(payload);
```

### Implementação completa de `withDIDAuth.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import * as ed from "@noble/ed25519";

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function base64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function withDIDAuth(request: NextRequest): Promise<NextResponse> {
  const did = request.headers.get("X-YaID-DID");
  const sigHeader = request.headers.get("X-YaID-Signature");
  const tsHeader = request.headers.get("X-YaID-Timestamp");

  if (!did || !sigHeader || !tsHeader) {
    return NextResponse.json({ error: "Missing auth headers" }, { status: 401 });
  }

  // Validate timestamp (±5 minutes = 300 seconds)
  const timestamp = parseInt(tsHeader, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return NextResponse.json({ error: "Request expired" }, { status: 401 });
  }

  // Extract public key from DID
  const parts = did.split(":");
  const hexPubKey = parts.length === 4 ? parts[3] : null;
  if (
    parts.length !== 4 ||
    parts[0] !== "did" ||
    parts[1] !== "yaid" ||
    parts[2] !== "user" ||
    !hexPubKey ||
    !/^[0-9a-f]{64}$/.test(hexPubKey)
  ) {
    return NextResponse.json({ error: "Invalid DID" }, { status: 401 });
  }

  const publicKeyBytes = hexToBytes(hexPubKey);

  // Build canonical payload
  const pathname = request.nextUrl.pathname;
  const payload = `${tsHeader}:${request.method}:${pathname}`;
  const payloadBytes = new TextEncoder().encode(payload);

  // Verify signature
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64urlToBytes(sigHeader);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let valid: boolean;
  try {
    valid = await ed.verify(signatureBytes, payloadBytes, publicKeyBytes);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Attach authenticated DID to request context (same pattern as withSessionAuth → x-company-id)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-holder-did", did);

  return NextResponse.next({ request: { headers: requestHeaders } });
}
```

### Estrutura de Arquivos

```
src/shared/
  middlewares/
    withDIDAuth.ts    ← ATUALIZAR (substituir stub, tornar async)
```

Nenhum novo arquivo é necessário — apenas substituir o stub.

### Padrão de Middleware do Projeto

Todos os middlewares em `src/shared/middlewares/` seguem o padrão:
- Recebem `NextRequest` como parâmetro
- Retornam `NextResponse`
- Não acessam `process.env` diretamente (regra do projeto — mas esta story não precisa de env vars)

O middleware principal em `src/shared/middleware.ts:76` já chama `withDIDAuth(request)` e aguarda o resultado. Como o stub era síncrono e o novo será `async`, a assinatura muda de `function` para `async function`. O caller já usa `return withDIDAuth(request)` sem `await` explícito, mas como retorna uma `Promise<NextResponse>`, o TypeScript/runtime resolve corretamente pois `middleware` em `middleware.ts` é `async`.

**Verificar**: o caller em `src/shared/middleware.ts:77` é `return withDIDAuth(request)` — como `middleware` já é `async`, retornar uma Promise funciona. Mas para garantir type-checking correto, é recomendável adicionar `await`:

```typescript
// src/shared/middleware.ts linha 76-78 (verificar e ajustar se necessário)
if (isDIDAuthRoute(pathname)) {
  return await withDIDAuth(request);  // adicionar await se não tiver
}
```

### Testes

Esta story **não requer novos arquivos de teste** — o `withDIDAuth` é pura lógica de middleware sem dependências de DB. Os testes de contrato existentes cobrem que o middleware é chamado nas rotas certas.

O critério de validação desta story é:
- `npm run build` sem erros de tipo
- `npm test` sem regressão (todos os testes existentes passando)

### Referências

- [Epics — Story 5.1](../../_bmad-output/planning-artifacts/epics.md#story-51-middleware-de-auth-por-did-withdidauth)
- [Architecture — middleware proxy pattern](../../_bmad-output/planning-artifacts/architecture.md) — "Proxy de auth: proxy.ts global"
- [Architecture — headers customizados](../../_bmad-output/planning-artifacts/architecture.md) — "Headers customizados: X-YaID-*"
- [Architecture — withDIDAuth TBD](../../_bmad-output/planning-artifacts/architecture.md:548) — `withDIDAuth.ts ⚠️ TBD: algoritmo de criptografia`
- [withSessionAuth.ts](../../src/shared/middlewares/withSessionAuth.ts) — padrão de adicionar header ao contexto (`x-company-id`)
- [withApiKeyAuth.ts](../../src/shared/middlewares/withApiKeyAuth.ts) — padrão de retorno 401
- [Story 5.2 Dev Notes](../../_bmad-output/implementation-artifacts/stories/5-2-wrapper-blockchainclient.md) — contexto do ecossistema blockchain/ethers.js já instalado

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Instalado `@noble/ed25519` v3.x — API async usa `verifyAsync` (diferente do v2 que usava `verify`); atualizado em relação ao Dev Notes original.
- `withDIDAuth.ts` substituído: stub síncrono → implementação async completa com validação de headers, timestamp, DID, assinatura Ed25519.
- `src/shared/middleware.ts` atualizado: `return withDIDAuth(request)` → `return await withDIDAuth(request)` para manter type-checking correto com função async.
- Build: ✅ limpo, sem erros TypeScript. Testes: ✅ 166/166 passando, zero regressão.

### File List

### Arquivos Modificados
- `src/shared/middlewares/withDIDAuth.ts` — stub substituído pela implementação completa de DID auth
- `src/shared/middleware.ts` — adicionado `await` na chamada a `withDIDAuth`
- `package.json` — adicionada dependência `@noble/ed25519@^3.1.0`
- `package-lock.json` — atualizado pelo npm

## Change Log

- **2026-05-27** — Implementação completa da Story 5.1: `withDIDAuth` com validação de headers, replay protection (±5min), extração de public key do DID, verificação Ed25519 via `@noble/ed25519` v3. Build limpo, 166/166 testes passando.
