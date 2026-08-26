# Testando o happy path ponta-a-ponta pelo Postman

Este guia mostra, passo a passo, como rodar **todo o fluxo de verificação do YaID** sem o app mobile e sem o sistema da empresa parceira — usando só o **navegador** (para as ações do dashboard) e o **Postman** (para simular a empresa e a carteira do holder).

O app mobile normalmente "assina" cada chamada com uma chave secreta para provar que é o dono do DID. Como o app não existe ainda, o Postman vai gerar essas assinaturas sozinho (você só cola os scripts prontos — não precisa entender a criptografia).

## Visão geral do fluxo

| # | Onde | Ação | Auth |
|---|------|------|------|
| 1 | 🌐 Navegador | Cadastro da empresa | — |
| 2 | 🌐 Navegador | Criar o app → copiar a **API key** | cookie (automático no browser) |
| 3 | 📮 Postman | Criar a **proof request** → capturar `sessionToken` + `requestId` | API key |
| 4 | 📮 Postman | Holder emite a **VC** (registra o DID on-chain) | assinatura do holder |
| 5 | 📮 Postman | Holder pega o **desafio** (nonce) | assinatura do holder |
| 6 | 📮 Postman | Holder envia a **VP** → resposta `valid: true` | assinatura do holder |
| 7 | 🌐 Navegador | Ver a proof request como **`approved`** no dashboard | cookie (automático no browser) |

> **Por que dividir entre navegador e Postman?** As duas ações protegidas por cookie de sessão (criar o app e ver o resultado) são feitas no dashboard, que já cuida do login. Assim o **Postman nunca precisa de cookie** — só usa a API key e as assinaturas do holder.

---

## §0 — Pré-requisitos

### 0.1 Blockchain (Hardhat) de pé

- O nó Hardhat deve estar **rodando** e o contrato **YaidRegistry deployado** no endereço que está no seu `.env`.
- A conta usada como wallet (a account #0 do Hardhat) já vem com saldo — nada a fazer.

### 0.2 Ajustar o `.env` (você faz isso)

O código lê variáveis com **nomes diferentes** dos que estão hoje no seu `.env`. Adicione as variáveis abaixo (mantendo as suas atuais, se quiser). Copie os **valores que você já tem** para os nomes novos:

```bash
# --- Blockchain: mesmos valores que você já tem, com os nomes que o app lê ---
BLOCKCHAIN_RPC_URL=            # copie o valor de HARDHAT_RPC_ENDPOINT (ex: http://127.0.0.1:8545)
BLOCKCHAIN_WALLET_PRIVATE_KEY= # copie o valor de YAID_WALLET_PRIVATE_KEY (ex: 0xac0974...)
BLOCKCHAIN_CONTRACT_ADDRESS=   # copie o valor de CONTRACT_ADDRESS (ex: 0x5FbDB2...)

# --- Chaves Ed25519 geradas para este ambiente de teste (32 bytes, hex, sem 0x) ---
ISSUER_PRIVATE_KEY=c0991bc6e8fe3902c7458e918beb9b97ef15009b2e15e40719d4679ff1ad1b0f
WEBHOOK_SIGNING_PRIVATE_KEY=0f3b1b711d80f28142cabce618ada0ae869b5904896fbe1e606eb00d9233ec1c
```

Notas importantes:

- **`STAGE` deve continuar `DOTENV`** (não use `TEST`).
- `ISSUER_PRIVATE_KEY` e `WEBHOOK_SIGNING_PRIVATE_KEY` já foram **geradas** para você acima (chaves de teste — troque em produção). Formato: 64 caracteres hexadecimais, **sem** `0x`.
- `BLOCKCHAIN_WALLET_PRIVATE_KEY` é uma chave **diferente** (a da wallet Ethereum, com `0x`). Não confunda com as de cima.
- **Sem essas variáveis, a emissão da VC quebra** (o app lança erro por não achar a wallet/contrato e por falta da `ISSUER_PRIVATE_KEY`).

### 0.3 Reiniciar o servidor

Depois de editar o `.env`, **pare e reinicie** o dev server (o Next lê o `.env` só na inicialização):

```bash
npm run dev
```

O servidor deve estar em `http://localhost:3000`.

---

## §1 — Setup do Postman (uma vez só)

### 1.1 Variáveis da coleção

Crie uma **Collection** no Postman (ex.: `YaID E2E`) e, em **Variables**, adicione:

| Variável | Valor inicial |
|----------|---------------|
| `baseUrl` | `http://localhost:3000` |
| `holderPriv` | `8cf5a6b6e89cd1667eb72fa79509aefcab6178f9d67e33bb297270a998d96541` |
| `holderDid` | `did:yaid:user:d0a128a82277a5862ab1bbfad3ec629dfe10fd2d973fca9d2f8acee1fdb75699` |
| `apiKey` | *(preencher no §2)* |
| `sessionToken` | *(preenche sozinho no §3)* |
| `requestId` | *(preenche sozinho no §3)* |
| `vc` | *(preenche sozinho no §4)* |
| `nonce` | *(preenche sozinho no §5)* |
| `docImage` | *(obrigatório — cole o base64 puro da imagem do documento — §4)* |
| `bodySignature` | *(preenche sozinho no §4)* |
| `vpJson` | *(preenche sozinho no §6)* |
| `naclSource` | *(preencher no passo 1.2)* |

> `holderPriv` é a chave secreta do holder simulado, e `holderDid` é a identidade dele (o DID já embute a chave pública). Já foram gerados e validados contra o backend — pode usar como estão.

### 1.2 Carregar a biblioteca de assinatura (TweetNaCl)

O Postman não sabe assinar Ed25519 de fábrica. Vamos colar uma biblioteca gratuita (TweetNaCl) numa variável, uma única vez:

1. Abra no navegador: **https://unpkg.com/tweetnacl@1.0.3/nacl-fast.min.js**
2. Selecione **todo** o conteúdo (`Ctrl+A` / `Cmd+A`) e copie.
3. No Postman, cole na variável de coleção **`naclSource`** (campo *Current value*) e salve.

Pronto — os scripts do holder vão usar essa variável automaticamente.

### 1.3 Preâmbulo do holder (usado nos §4, §5 e §6)

Nos **três** requests do holder (emitir VC, desafio, VP), o campo **Pre-request Script** começa com este mesmo bloco. Cole-o no topo de cada um:

```js
// ===== PREÂMBULO HOLDER — cole no topo de cada request do holder =====
function hexToBytes(h){var a=new Uint8Array(h.length/2);for(var i=0;i<a.length;i++){a[i]=parseInt(h.substr(i*2,2),16);}return a;}
function b64url(b){return Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function utf8(s){return new Uint8Array(Buffer.from(s,'utf8'));}
function loadNacl(){
  var m = { exports: {} };
  // require/self/window fajutos: impedem o TweetNaCl de fazer require('crypto')
  // (que não existe no sandbox). Não precisamos de PRNG — fromSeed/detached são determinísticos.
  (function(module, exports, require, self, window){
    eval(pm.collectionVariables.get('naclSource'));
  })(m, m.exports, function(){ return {}; }, undefined, undefined);
  return m.exports;
}
var nacl = loadNacl();
var kp = nacl.sign.keyPair.fromSeed(hexToBytes(pm.collectionVariables.get('holderPriv')));
var holderDid = pm.collectionVariables.get('holderDid');
function edSign(msg){return b64url(nacl.sign.detached(utf8(msg), kp.secretKey));}
// A assinatura cobre {timestamp}:{MÉTODO}:{path} — por isso o método é parâmetro.
function setDidAuth(method, pathname){
  var ts = String(Math.floor(Date.now()/1000));
  pm.request.headers.upsert({key:'X-YaID-DID', value: holderDid});
  pm.request.headers.upsert({key:'X-YaID-Timestamp', value: ts});
  pm.request.headers.upsert({key:'X-YaID-Signature', value: edSign(ts + ':' + method + ':' + pathname)});
}
// ===== FIM DO PREÂMBULO =====
```

> Esse bloco injeta sozinho os headers `X-YaID-DID`, `X-YaID-Timestamp` e `X-YaID-Signature`. **Você não precisa adicionar esses headers manualmente** nos requests do holder.
>
> **Consistência é obrigatória:** a função `setDidAuth` e as chamadas dela precisam usar a **mesma assinatura de argumentos** (`método, path`). Se uma estiver com 1 argumento e a outra com 2, a assinatura sai errada e você toma **401 "Invalid signature"**. Este preâmbulo funciona igual no **Postman** e no **Apidog**.

---

## §2 — Empresa: cadastro e API key (no navegador)

1. Acesse **`http://localhost:3000/sign-up`** e cadastre a empresa:
   - **E-mail** e **senha** (mín. 8 caracteres)
   - **Nome da empresa**
   - **CNPJ**: 14 dígitos, só números (ex.: `12345678000199`)
   - Ao concluir, você já fica **logado**.
2. Vá em **Apps → criar novo app** (`http://localhost:3000/apps/new`), dê um nome e ambiente `dev`, e crie.
3. O dashboard mostra a **API key uma única vez** (formato `‹uuid›.‹segredo›`). **Copie** e cole na variável `apiKey` da coleção no Postman.

> Alternativa 100% Postman (avançada) no [Apêndice A](#apêndice-a--fazer-tudo-no-postman-com-cookie).

---

## §3 — Empresa cria a proof request (Postman → API key)

Cria a solicitação de prova e devolve o link de verificação (de onde extraímos o `sessionToken`).

- **Método / URL**: `POST {{baseUrl}}/api/proof-requests`
- **Headers**:
  - `x-api-key: {{apiKey}}`
  - `Content-Type: application/json`
- **Body** (raw → JSON):

```json
{ "proofType": "personhood" }
```

- **Tests** (aba Scripts → Post-response):

```js
pm.test('proof request criada (201)', function () { pm.response.to.have.status(201); });
var j = pm.response.json();
pm.collectionVariables.set('requestId', j.id);
var url = j.session.verificationUrl;                 // ex: http://localhost:3000/v/<token>
pm.collectionVariables.set('sessionToken', url.substring(url.lastIndexOf('/') + 1));
console.log('sessionToken =', pm.collectionVariables.get('sessionToken'));
```

Depois de enviar, `sessionToken` e `requestId` ficam preenchidos automaticamente.

---

## §4 — Holder emite a VC (Postman → assinatura do holder)

Registra o DID do holder on-chain e devolve a VC assinada pelo issuer.

- **Método / URL**: `POST {{baseUrl}}/api/credentials/issue`
- **Headers**: `Content-Type: application/json` *(os headers `X-YaID-*` são injetados pelo script)*
- **Pre-request Script**: cole o [preâmbulo do holder](#13--preâmbulo-do-holder-usado-nos-4-5-e-6) e, **abaixo dele**, acrescente:

```js
setDidAuth('POST', '/api/credentials/issue');
// `docImage`: base64 puro (sem prefixo data:image/...;base64,) de uma imagem legível do documento
var docImage = pm.collectionVariables.get('docImage');
pm.collectionVariables.set('bodySignature', edSign(docImage));
```

- **Body** (raw → JSON):

```json
{
  "documentImage": "{{docImage}}",
  "bodySignature": "{{bodySignature}}"
}
```

- **Tests**:

```js
pm.test('VC emitida (201)', function () { pm.response.to.have.status(201); });
pm.collectionVariables.set('vc', JSON.stringify(pm.response.json()));
```

> **OCR (obrigatório):** o fluxo de emissão exige `MISTRAL_API_KEY` configurada — **não existe modo
> mockado em ambiente real**. O `MockOcrProvider` só é usado sob `STAGE=TEST` (suíte automatizada),
> nunca em execução local/homol/prod. Sem a chave, a emissão falha ao ler o env (e em PROD/HOMOLOG o
> app nem sobe).
> O `docImage` deve ser **base64 puro** (sem prefixo `data:image/...;base64,`) de uma imagem legível
> do documento. Gere com `base64 -i rg.png | tr -d '\n' | pbcopy`. Dica: reduza a imagem (~1000px).
> A extração é estruturada (Mistral Document AI) — um **422** agora significa que o modelo não
> encontrou nome, CPF ou data de nascimento no documento, não que um regex falhou.

---

## §5 — Holder pega o desafio / nonce (Postman → assinatura do holder)

Move a sessão para `opened` e devolve o `nonce` que a VP precisa carregar.

- **Método / URL**: `GET {{baseUrl}}/api/proof-sessions/{{sessionToken}}/challenge`
- **Body**: *(vazio — é `GET`)*
- **Pre-request Script**: cole o [preâmbulo do holder](#13--preâmbulo-do-holder-usado-nos-4-5-e-6) e, abaixo:

```js
var token = pm.collectionVariables.get('sessionToken');
setDidAuth('GET', '/api/proof-sessions/' + token + '/challenge');
```

> A rota é `GET`, mas essa chamada **muda estado** (gera o nonce e move a sessão para `opened`). A assinatura precisa incluir o token no caminho **e o método `GET`** — por isso montamos o `pathname` com o `sessionToken` e passamos `'GET'`.

- **Tests**:

```js
pm.test('desafio emitido (200)', function () { pm.response.to.have.status(200); });
pm.collectionVariables.set('nonce', pm.response.json().nonce);
```

---

## §6 — Holder envia a VP (Postman → assinatura do holder)

Monta a Verifiable Presentation (VC + desafio), assina como holder e envia. Se tudo estiver certo, a resposta é `{ "valid": true }`.

- **Método / URL**: `POST {{baseUrl}}/api/presentations/verify`
- **Headers**: `Content-Type: application/json`
- **Pre-request Script**: cole o [preâmbulo do holder](#13--preâmbulo-do-holder-usado-nos-4-5-e-6) e, abaixo:

```js
setDidAuth('POST', '/api/presentations/verify');
var vc = JSON.parse(pm.collectionVariables.get('vc'));
var nonce = pm.collectionVariables.get('nonce');

// A ordem das chaves precisa ser exatamente holder, challenge, verifiableCredential
var vp = { holder: holderDid, challenge: nonce, verifiableCredential: [vc] };
var payload = JSON.stringify(vp);          // assina ANTES de adicionar o proof
vp.proof = {
  type: 'Ed25519Signature2020',
  created: new Date().toISOString(),
  verificationMethod: holderDid + '#key-1',
  proofPurpose: 'authentication',
  signatureValue: edSign(payload)
};
pm.collectionVariables.set('vpJson', JSON.stringify(vp));
```

- **Body** (raw → JSON):

```json
{ "vp": {{vpJson}}, "sessionToken": "{{sessionToken}}" }
```

> Repare que `{{vpJson}}` **não** está entre aspas — ele já é um objeto JSON completo.

- **Tests**:

```js
pm.test('verificação aprovada', function () {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().valid).to.eql(true);
});
```

---

## §7 — Ver o resultado no dashboard (navegador)

Volte ao dashboard logado e abra **Proof Requests** (`http://localhost:3000/proof-requests`). A solicitação criada no §3 deve aparecer com status **`approved`**.

É o mesmo resultado que a empresa parceira veria por polling em `GET /api/proof-requests/{id}` ou por webhook.

---

## Resumo da ordem de execução

```
🌐 §2 cadastro + criar app → copiar apiKey
📮 §3 POST /api/proof-requests               (x-api-key)   → sessionToken, requestId
📮 §4 POST /api/credentials/issue            (holder)      → vc, DID on-chain
📮 §5 GET  /api/proof-sessions/{t}/challenge (holder)      → nonce
📮 §6 POST /api/presentations/verify         (holder)      → valid: true
🌐 §7 dashboard → proof request = approved
```

Rode do §3 ao §6 **em ordem** (cada um usa dados do anterior). Uma sessão expira em **30 minutos**, e o desafio (§5) vale por **10 minutos** — se estourar, refaça do §3.

---

## Troubleshooting

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| §4 responde **500 / "not configured"** | `.env` sem `ISSUER_PRIVATE_KEY` / `BLOCKCHAIN_WALLET_PRIVATE_KEY` / `BLOCKCHAIN_CONTRACT_ADDRESS` | Revise o [§0.2](#02--ajustar-o-env-você-faz-isso) e **reinicie** o `npm run dev`. |
| §4 responde **502 "Blockchain registration failed"** | Hardhat parado, contrato não deployado ou `BLOCKCHAIN_RPC_URL`/`CONTRACT_ADDRESS` errados | Confirme o nó Hardhat e o endereço do contrato. |
| §4/§5/§6 responde **401 "Invalid signature"** | `setDidAuth` e a chamada com nº de argumentos diferente, ou método/URL do request divergente do assinado, ou `naclSource` não colado | Garanta que helper **e** chamada usam `('MÉTODO', '/path')`; confira o método e a URL do request (sem barra no fim); veja o [§1.2](#12--carregar-a-biblioteca-de-assinatura-tweetnacl). |
| §4/§5/§6 responde **401 "Request expired"** | Relógio da máquina fora de ±5 min do servidor | Ajuste o relógio do SO. |
| Pre-request quebra com **`Cannot find module 'crypto'`** | `loadNacl` sem o shim de `require` (o TweetNaCl tenta `require('crypto')`) | Use a versão de `loadNacl` do [§1.3](#13--preâmbulo-do-holder-usado-nos-4-5-e-6) (com `require`/`self`/`window` fajutos). |
| §5 responde **405 Method Not Allowed** | Request enviado como `POST` — a rota de challenge é **`GET`** | Troque o método do §5 para `GET` e assine com `setDidAuth('GET', ...)`. |
| §4 responde **422** | Imagem ilegível, ou o modelo não conseguiu extrair nome, CPF ou data de nascimento | Use um base64 legível de um documento real; confirme `MISTRAL_API_KEY` configurada. |
| §5 responde **422 "Session not in waiting_user state"** | O desafio já foi pedido, ou a sessão expirou/foi usada | Recomece do §3 (nova proof request). |
| §6 responde **`{ "valid": false }`** | VC/nonce desatualizados, DID não registrado on-chain, ou ordem dos passos trocada | Rode §3→§6 na ordem, na mesma execução. O §4 **precisa** ter registrado o DID antes do §6. |
| §3 responde **401 "Invalid API key"** | `apiKey` errado ou app desabilitado | Recopie a API key do dashboard (formato `uuid.segredo`). |

---

## Apêndice A — Fazer tudo no Postman (com cookie)

Se você quiser criar o app e/ou consultar o resultado **sem** o navegador, essas rotas exigem o cookie de sessão do Supabase:

1. Faça login em `http://localhost:3000/sign-in` no navegador.
2. Abra o DevTools → **Application → Cookies → `http://localhost:3000`** e copie os cookies que começam com **`sb-`** (`sb-…-auth-token`, podem estar divididos em `.0`, `.1`).
3. No Postman, adicione esses cookies pelo **Cookie Manager** (domínio `localhost`).
4. Aí você pode:
   - `POST {{baseUrl}}/api/company-apps` com body `{ "name": "Meu App", "environment": "dev" }` → resposta traz `apiKey`.
   - `GET {{baseUrl}}/api/proof-requests/{{requestId}}` → status da proof request.

O cookie de acesso expira em ~1h; se der 401, refaça o login e recopie.
