# Story 10.1: Centralização de Chaves de Teste no `environments.ts`

Status: done

> **Independente das Stories 5.7/5.8.** Não tem dependência de código com nenhuma story de outro epic —
> pode rodar em paralelo. **Story 10.2 (`backlog`) depende desta.** Validar formato de chave enquanto
> `TEST_ENV` ainda carrega placeholders não-hex quebraria o stage `TEST` inteiro — por isso a ordem
> 10.1 → 10.2 é obrigatória e não deve ser invertida.

## Story

Como desenvolvedor deste backend,
Quero que as chaves do stage de teste saiam prontas do `environments.ts`,
Para que nenhum use case precise conhecer ou remendar valores de configuração.

**Contexto:** `TEST_ENV` atribui strings-placeholder não-hexadecimais (`"test-issuer-private-key"`,
`"test-webhook-signing-private-key"`) a variáveis que o código consome como chaves hex de 32 bytes.
Como o valor não serve para `hexToBytes`, **quatro consumidores remendam o valor no ponto de uso**, cada
um redeclarando o par placeholder/valor real — violando a regra de arquitetura *"`environments.ts` entrega
valores prontos para uso — nenhum use case, provider ou client pode inspecionar, comparar contra
placeholder ou substituir valor de configuração no ponto de uso"* [Source: architecture.md#L540].

## Acceptance Criteria

1. **Given** o `TEST_ENV` em `src/shared/environments.ts`
   **When** revisado
   **Then** `ISSUER_PRIVATE_KEY` e `WEBHOOK_SIGNING_PRIVATE_KEY` carregam diretamente os valores hex de 32
   bytes hoje produzidos pela substituição (`0000...0001` e `0000...0002`, respectivamente — 64 chars hex)
   **And** as chaves derivadas (public keys, assinaturas, DIDs) permanecem **idênticas** às atuais — nenhuma
   assinatura muda

2. **Given** os quatro pontos de substituição de placeholder
   **When** esta story é aplicada
   **Then** todos são removidos:
   1. `src/modules/credential/app/issue_credential_usecase.ts` (linhas 124-129)
   2. `src/modules/presentation/app/verify_presentation_usecase.ts` (linhas 197-200)
   3. `src/shared/infra/providers/Ed25519WebhookSigner.ts` (linhas 20-30)
   4. `src/modules/webhook/app/get_webhook_public_key_usecase.ts` (linhas 2, 4-6, 30, 34-41) e seu
      presenter `get_webhook_public_key_presenter.ts` (linha 8)
   **And** cada consumidor passa a usar o valor recebido sem inspecioná-lo ou reescrevê-lo

3. **Given** os testes estruturais que hoje exigem a presença do remendo
   **When** esta story é aplicada
   **Then** `tests/unit/story-6-1/webhook-delivery.test.mjs` (teste "has test key fallback", linha ~83) e
   `tests/unit/story-6-2/webhook-public-key.test.mjs` (testes "substitutes the non-hex TEST_ENV placeholder",
   "constructor receives the private key and stage as plain values" e "gates the test-key placeholder
   substitution to the TEST stage", linhas ~117-143) são reescritos para afirmar o comportamento novo — a
   chave vem pronta do `environments.ts` — em vez da presença do remendo
   **And** as asserções sobre o valor derivado `...0002` (`story-6-2`, linhas 43, 91, 162) permanecem
   **inalteradas e passando**

4. **Given** a suíte de testes completa
   **When** executada após a mudança
   **Then** passa integralmente — a mudança é preservadora de comportamento por construção. Inclui um teste
   pré-existente descoberto durante o planejamento desta story que não constava na AC original do epics.md:
   `tests/unit/story-9-1/vc-jwt-issuance.test.mjs` (linha 90-93) afirma explicitamente que
   `issue_credential_usecase.ts` **mantém** a string `test-issuer-private-key` ("Epic 10 scope" no próprio
   nome do teste) — precisa ser reescrito para afirmar a ausência do remendo, senão quebra com esta story.

5. **Given** um novo consumidor de chave criado no futuro
   **When** ele lê a chave via `environments.ts`
   **Then** recebe um valor pronto para uso em qualquer stage, sem precisar conhecer placeholders

## Tasks / Subtasks

- [x] Task 1: Centralizar os valores hex prontos em `TEST_ENV` (AC: #1)
  - [x] Em `src/shared/environments.ts`, trocar as linhas 66-67:
    ```ts
    ISSUER_PRIVATE_KEY: "test-issuer-private-key",
    WEBHOOK_SIGNING_PRIVATE_KEY: "test-webhook-signing-private-key",
    ```
    por:
    ```ts
    ISSUER_PRIVATE_KEY:
      "0000000000000000000000000000000000000000000000000000000000000001",
    WEBHOOK_SIGNING_PRIVATE_KEY:
      "0000000000000000000000000000000000000000000000000000000000000002",
    ```
    Copiar os valores **exatamente** dos remendos atuais (Task 2/4 abaixo) — são os mesmos 64 caracteres
    hex já usados hoje, garantindo que nenhuma assinatura/DID derivado mude.
  - [x] **Não tocar** em `BLOCKCHAIN_WALLET_PRIVATE_KEY` (linha 68, permanece
    `"test-blockchain-wallet-private-key"`). Não é um dos quatro pontos de substituição desta story:
    `getBlockchainClient()` lança erro para `Stage.TEST` antes de qualquer consumidor tentar
    `hexToBytes` nesse valor (`src/shared/environments.ts:252-254`) — não há remendo a remover porque
    nenhum código faz parse hex dele em TEST. Fora de escopo; não inventar tratamento novo aqui.
  - [x] Não alterar `envSchema`/`superRefine` — o formato continua `z.string().min(1).optional()`. Validar
    o formato (64 hex chars) é escopo exclusivo da Story 10.2 (`backlog`, depende desta). Não adiantar
    esse trabalho aqui.

- [x] Task 2: Remover o remendo em `issue_credential_usecase.ts` (AC: #2.1)
  - [x] Linhas 124-129 atuais:
    ```ts
    // CORRIGIR ISSO! variaveis de ambiente de teste devem ser definidas no environments.ts
    // Mapear isso e descobrir onde mais existem hardcode de variavel de ambiente por falta de retorno do environments.ts
    let privateKeyHex = this.issuerPrivateKey;
    if (privateKeyHex === "test-issuer-private-key") {
      privateKeyHex = "0000000000000000000000000000000000000000000000000000000000000001";
    }

    const privateKeyBytes = hexToBytes(privateKeyHex);
    ```
    Substituir (linhas 124-131) por uma única linha:
    ```ts
    const privateKeyBytes = hexToBytes(this.issuerPrivateKey);
    ```
  - [x] Nada mais no arquivo muda: `issuerPubKeyBytes`/`issuerDid`/construção do JWT/`registerDID`
    permanecem linha a linha idênticos.

- [x] Task 3: Remover o remendo em `verify_presentation_usecase.ts` (AC: #2.2)
  - [x] Linhas 197-201 atuais:
    ```ts
    let issuerPrivKeyHex = this.issuerPrivateKey;
    if (issuerPrivKeyHex === "test-issuer-private-key") {
      issuerPrivKeyHex = "0000000000000000000000000000000000000000000000000000000000000001";
    }
    const issuerPrivKeyBytes = hexToBytes(issuerPrivKeyHex);
    ```
    Substituir por:
    ```ts
    const issuerPrivKeyBytes = hexToBytes(this.issuerPrivateKey);
    ```
  - [x] Comentários adjacentes ("Derive issuer public key from ISSUER_PRIVATE_KEY", linha 196) permanecem.

- [x] Task 4: Remover o remendo em `Ed25519WebhookSigner.ts` (AC: #2.3)
  - [x] Remover as constantes de módulo (linhas 20-22):
    ```ts
    const TEST_KEY_PLACEHOLDER = "test-webhook-signing-private-key";
    const TEST_KEY_HEX =
      "0000000000000000000000000000000000000000000000000000000000000002";
    ```
  - [x] Simplificar o construtor (linhas 27-31):
    ```ts
    constructor(privateKeyHex: string) {
      const hex =
        privateKeyHex === TEST_KEY_PLACEHOLDER ? TEST_KEY_HEX : privateKeyHex;
      this.privateKeyBytes = hexToBytes(hex);
    }
    ```
    para:
    ```ts
    constructor(privateKeyHex: string) {
      this.privateKeyBytes = hexToBytes(privateKeyHex);
    }
    ```
  - [x] Resto do arquivo (`hexToBytes`, `bytesToBase64`, `sign()`) não muda.

- [x] Task 5: Remover o remendo e o gate de stage em `get_webhook_public_key_usecase.ts` + presenter (AC: #2.4)
  - [x] Remover o import não mais usado (linha 2): `import { Stage } from "@/shared/environments";`
  - [x] Remover as constantes de placeholder (linhas 4-6):
    ```ts
    const TEST_PRIVATE_KEY_PLACEHOLDER = "test-webhook-signing-private-key";
    const TEST_PRIVATE_KEY_HEX =
      "0000000000000000000000000000000000000000000000000000000000000002";
    ```
    **Manter** `HEX_PRIVATE_KEY_PATTERN` (linha 7) e a função `hexToBytes` (linhas 9-20) exatamente como
    estão — não fazem parte dos "quatro pontos de substituição": são o guard de formato hex do próprio
    arquivo, independente de `environments.ts`, e continuam sendo a única validação de formato em runtime
    até a Story 10.2 mover isso para o boot. Removê-los seria além do escopo desta AC.
  - [x] Simplificar o construtor (linhas 27-31): remover o segundo parâmetro `stage: Stage`, ficando
    ```ts
    constructor(private readonly webhookSigningPrivateKey: string) {}
    ```
  - [x] Simplificar `execute()` (linhas 33-44): trocar
    ```ts
    async execute(): Promise<GetWebhookPublicKeyOutput> {
      let privateKeyHex = this.webhookSigningPrivateKey;
      if (privateKeyHex === TEST_PRIVATE_KEY_PLACEHOLDER) {
        if (this.stage !== Stage.TEST) {
          throw new Error(
            "WEBHOOK_SIGNING_PRIVATE_KEY is set to the TEST_ENV placeholder outside the TEST stage"
          );
        }
        privateKeyHex = TEST_PRIVATE_KEY_HEX;
      }

      const privateKeyBytes = hexToBytes(privateKeyHex);
    ```
    por:
    ```ts
    async execute(): Promise<GetWebhookPublicKeyOutput> {
      const privateKeyBytes = hexToBytes(this.webhookSigningPrivateKey);
    ```
    Resto do método (`getPublicKeyAsync`, `return { publicKey, algorithm }`) não muda.
  - [x] Em `get_webhook_public_key_presenter.ts` linha 8, trocar
    `new GetWebhookPublicKeyUseCase(envs.WEBHOOK_SIGNING_PRIVATE_KEY, envs.stage)` por
    `new GetWebhookPublicKeyUseCase(envs.WEBHOOK_SIGNING_PRIVATE_KEY)`.
  - [x] `get_webhook_public_key_controller.ts` e `get_webhook_public_key_viewmodel.ts` não mudam.

- [x] Task 6: Reescrever os testes estruturais que dependiam do remendo (AC: #3)
  - [x] `tests/unit/story-6-1/webhook-delivery.test.mjs`, teste "Story 6.1 Ed25519WebhookSigner has test key
    fallback" (linhas 83-86, hoje `assert.match(src, /test-webhook-signing-private-key/)`): reescrever para
    afirmar a ausência do remendo e o construtor direto, ex.:
    ```js
    test("Story 6.1 Ed25519WebhookSigner uses the received private key directly (no placeholder substitution — Epic 10)", () => {
      const src = readText("src/shared/infra/providers/Ed25519WebhookSigner.ts");
      assert.doesNotMatch(src, /test-webhook-signing-private-key/, "Placeholder substitution must be removed");
      assert.match(src, /this\.privateKeyBytes = hexToBytes\(privateKeyHex\)/, "Constructor must use the received value directly");
    });
    ```
  - [x] `tests/unit/story-6-2/webhook-public-key.test.mjs`:
    - Teste "substitutes the non-hex TEST_ENV placeholder with a valid hex fallback key" (linhas 117-121):
      renomear e reescrever para afirmar ausência de `test-webhook-signing-private-key`/
      `TEST_PRIVATE_KEY_PLACEHOLDER`/`TEST_PRIVATE_KEY_HEX` no source do use case.
    - Teste "constructor receives the private key and stage as plain values" (linhas 128-132): remover a
      asserção `/private readonly stage: Stage/` e trocar por `assert.doesNotMatch(src, /stage: Stage/)`;
      manter a asserção de `webhookSigningPrivateKey: string`.
    - Teste "gates the test-key placeholder substitution to the TEST stage (review patch)" (linhas 140-143):
      **remover** — o gate de stage deixou de existir, não há novo comportamento equivalente para afirmar.
    - Teste "validates hex format and throws on malformed input (review patch)" (linhas 134-138): **manter
      sem alteração** — `HEX_PRIVATE_KEY_PATTERN`/`throw new Error` continuam no arquivo (Task 5).
    - Teste do presenter (linha 181-186): trocar o regex de
      `/new GetWebhookPublicKeyUseCase\(envs\.WEBHOOK_SIGNING_PRIVATE_KEY, envs\.stage\)/` para
      `/new GetWebhookPublicKeyUseCase\(envs\.WEBHOOK_SIGNING_PRIVATE_KEY\)/`.
    - **Não tocar** nos blocos "Ed25519 public key round-trip (AC #2)" (linhas 41-79), "response shape
      mirrors the use case output (AC #1)" (linhas 89-100) e "hex validation behavior" (linhas 146-165) —
      usam o hex `...0002` diretamente, continuam válidos e devem seguir passando sem alteração (AC #3).
  - [x] `tests/unit/story-9-1/vc-jwt-issuance.test.mjs`, teste "Story 9.1 IssueCredentialUseCase does not
    touch the ISSUER_PRIVATE_KEY test-placeholder substitution (Epic 10 scope)" (linhas 90-93): este teste
    fixava deliberadamente o débito que esta story paga (o próprio nome diz "Epic 10 scope"). Reescrever
    para afirmar o novo estado, ex.:
    ```js
    test("Story 9.1/10.1 — IssueCredentialUseCase reads ISSUER_PRIVATE_KEY directly, no placeholder substitution (Epic 10 landed)", () => {
      const src = readText("src/modules/credential/app/issue_credential_usecase.ts");
      assert.doesNotMatch(src, /test-issuer-private-key/, "Placeholder substitution must be removed by Story 10.1");
      assert.match(src, /hexToBytes\(this\.issuerPrivateKey\)/, "Must read the key directly from the constructor value");
    });
    ```
    Não deletar o teste — seguir o precedente já usado pelas Stories 5.8/9.1 de adaptar asserções obsoletas
    em vez de removê-las.
  - [x] Rodar `npm test` completo ao final e confirmar 0 regressões (suíte estática + dinâmica).

- [x] Task 7: Criar testes novos em `tests/unit/story-10-1/` (AC: #1, #2, #5)
  - [x] Seguir o padrão estrutural do projeto: existência de arquivo, regex estático sobre o source,
    `tsc --noEmit` como último teste (ver `tests/unit/story-9-1/vc-jwt-issuance.test.mjs` como referência
    direta mais recente no mesmo domínio de chaves).
  - [x] Cobrir estaticamente: `TEST_ENV` em `environments.ts` define `ISSUER_PRIVATE_KEY`/
    `WEBHOOK_SIGNING_PRIVATE_KEY` com os valores hex exatos (`0000...0001`/`0000...0002`, 64 chars);
    ausência de `test-issuer-private-key`/`test-webhook-signing-private-key` nos quatro arquivos consumidores
    (Tasks 2-5); presença de `hexToBytes(this.issuerPrivateKey)` / `hexToBytes(this.webhookSigningPrivateKey)`
    / `hexToBytes(privateKeyHex)` (sem variável intermediária de remendo) em cada um.
  - [x] **Recomendado (não obrigatório):** um teste dinâmico (`.dynamic.test.ts` via `tsx`, seguindo o
    precedente de `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`) que chama
    `Environments.getEnvs()` sob `STAGE=TEST` e confere que `.ISSUER_PRIVATE_KEY`/`.WEBHOOK_SIGNING_PRIVATE_KEY`
    retornam exatamente os dois valores hex — trava em runtime o AC #1 ("nenhuma assinatura muda"), reforço
    além do regex estático.
  - [x] Adicionar script `test:story:10.1` ao `package.json` seguindo o padrão de `test:story:9.1`.

### Review Findings

**Defer (7, pré-existentes ou fora do escopo desta story):**
- [x] [Review][Defer] Três dos quatro consumidores (`issue_credential_usecase.ts`, `verify_presentation_usecase.ts`, `Ed25519WebhookSigner.ts`) chamam `hexToBytes` sem validar formato/tamanho hex antes — só `get_webhook_public_key_usecase.ts` mantém `HEX_PRIVATE_KEY_PATTERN`. `hexToBytes` nesses três arquivos nunca validou formato, antes ou depois desta story (o remendo removido só trocava o valor, não validava); validação de formato é escopo exclusivo da Story 10.2, já documentado nas Dev Notes desta story [src/modules/credential/app/issue_credential_usecase.ts:124, src/modules/presentation/app/verify_presentation_usecase.ts:197, src/shared/infra/providers/Ed25519WebhookSigner.ts:24] — deferred, escopo da Story 10.2
- [x] [Review][Defer] `envSchema`/`superRefine` continuam validando `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY` apenas como `z.string().min(1)` (presença, não formato hex de 64 chars) — explicitamente fora do escopo desta story, é o objeto da Story 10.2 (`backlog`, depende desta) [src/shared/environments.ts:34-35] — deferred, escopo da Story 10.2
- [x] [Review][Defer] Em `verify_presentation_usecase.ts`, a derivação da chave do issuer (`hexToBytes(this.issuerPrivateKey)`) fica fora do try/catch/`reject()` que protege as outras regras do método — padrão pré-existente, não introduzido por esta story (o remendo removido também estava fora de qualquer try/catch); corrigir isso seria além do escopo desta story, que instrui preservar o comportamento exatamente [src/modules/presentation/app/verify_presentation_usecase.ts:197] — deferred, pré-existente
- [x] [Review][Defer] O teste `tsc --noEmit` novo (`tests/unit/story-10-1/key-centralization.test.mjs`) passaria silenciosamente se `execSync` falhasse ao sequer iniciar o `tsc` (stdout vazio → 0 erros filtrados) — padrão idêntico já usado em várias suítes pré-existentes do projeto (`story-6-1`, `story-9-1` etc.), não uma fragilidade introduzida por esta story; redesenhar esse padrão é fora do escopo [tests/unit/story-10-1/key-centralization.test.mjs] — deferred, padrão sistêmico pré-existente
- [x] [Review][Defer] Os valores hex de teste (`...0001`/`...0002`) ficam duplicados literalmente em `environments.ts` e nos dois arquivos novos de teste, sem nada garantindo sincronia — mesmo padrão já presente no projeto (ex. `tests/unit/story-6-2/webhook-public-key.test.mjs` já duplica o hex `...0002`); severidade baixa [src/shared/environments.ts, tests/unit/story-10-1/*] — deferred, padrão pré-existente, severidade baixa
- [x] [Review][Defer] O regex `/const TEST_ENV[^;]+;/s` no teste novo para extrair o bloco `TEST_ENV` do source para no primeiro `;` — inofensivo hoje (nenhum valor do objeto contém `;`), mas frágil se um valor futuro contiver um `;` (ex. uma URL com query string) [tests/unit/story-10-1/key-centralization.test.mjs] — deferred, fragilidade hipotética de baixa severidade
- [x] [Review][Defer] Vazamento do valor hex de teste em si (não a string placeholder) para `PROD`/`HOMOLOG` continua sem guarda — o gate de stage removido nunca cobriu esse cenário (só detectava a string placeholder), então não é uma proteção perdida por esta story; é exatamente o problema que a Story 10.2 (validação de formato/allowlist de chaves conhecidas no boot) deve resolver [src/shared/environments.ts:66-69] — deferred, escopo da Story 10.2

**Dismissed (7):** remoção do gate `Stage.TEST` em `get_webhook_public_key_usecase.ts` alegada como perda de proteção — a mesma proteção (rejeitar a string placeholder fora de `TEST`) permanece via `HEX_PRIVATE_KEY_PATTERN`, só muda a mensagem de erro, confirmado por inspeção do histórico da Story 6.2; remoção da checagem de prefixo `"test-"` para "todos os env names" em `tests/unit/story-1-1/restructure.test.mjs` — falso positivo da revisão cega (o `forEach` sempre cobriu só 3 nomes, e a cobertura dos 3 foi preservada, 2 viraram checagem hex e 1 manteve o placeholder); alegação de que o "fora de escopo" de `BLOCKCHAIN_WALLET_PRIVATE_KEY` não foi provado — verificado com acesso total ao projeto: nenhum consumidor faz `hexToBytes` desse valor em `TEST` (`getBlockchainClient()` lança erro antes); teste dinâmico novo mutando `process.env.STAGE` sem cleanup/possivelmente vacuous — falso positivo, a ordem no arquivo real é `process.env.STAGE = "TEST"` antes da primeira chamada a `getEnvs()` num processo novo, e a suíte dinâmica completa (77/77) rodou sem interferência; portabilidade do caminho do `tsc` no Windows — refutado empiricamente, o teste rodou com sucesso várias vezes nesta mesma sessão neste mesmo ambiente Windows; regex case-sensitive (só hex minúsculo) no teste ajustado da story-1-1 — inofensivo, sem impacto funcional, o literal no source é sempre minúsculo; `DeliverWebhookUseCase` engolir erros de `signAsync` silenciosamente — comportamento por design da Story 6.1 (AC "nunca lança exceção", fire-and-forget), arquivo nem tocado por esta story.

## Dev Notes

### Onde mexer — visão geral

Cinco arquivos de produção (mais o presenter do webhook-key) e três suítes de teste pré-existentes. Nenhum
arquivo novo em `src/`, nenhuma migration, nenhuma mudança de rota/schema de banco. Diretório de teste novo:
`tests/unit/story-10-1/`.

| Arquivo | Mudança |
|---|---|
| `src/shared/environments.ts` | `TEST_ENV.ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY` passam a ser os valores hex prontos |
| `src/modules/credential/app/issue_credential_usecase.ts` | remove remendo local do issuer key |
| `src/modules/presentation/app/verify_presentation_usecase.ts` | remove remendo local do issuer key |
| `src/shared/infra/providers/Ed25519WebhookSigner.ts` | remove remendo local do webhook key |
| `src/modules/webhook/app/get_webhook_public_key_usecase.ts` | remove remendo + gate de stage; construtor perde o parâmetro `stage` |
| `src/modules/webhook/app/get_webhook_public_key_presenter.ts` | para de passar `envs.stage` ao use case |

### Por que só 4 consumidores (e não `BLOCKCHAIN_WALLET_PRIVATE_KEY`)

`Environments.getBlockchainClient()` lança erro explicitamente para `Stage.TEST`
(`src/shared/environments.ts:252-254`, "No blockchain client configured for TEST stage") — nenhum código
nunca chama `hexToBytes` sobre `BLOCKCHAIN_WALLET_PRIVATE_KEY` durante os testes, então não existe remendo a
remover ali. Confirmado por busca no código: nenhum arquivo em `src/` referencia
`"test-blockchain-wallet-private-key"` fora de `environments.ts`. Não criar tratamento novo para essa
variável — fora do escopo desta story (e da AC).

### Regra de arquitetura sendo restaurada

> "`process.env` somente em `src/shared/environments.ts`" e "`environments.ts` entrega valores prontos para
> uso. Nenhum use case, provider ou client pode inspecionar, comparar contra placeholder ou substituir valor
> de configuração no ponto de uso. Se um valor precisa de tratamento para ser utilizável, o tratamento
> pertence ao `environments.ts` — não ao consumidor."
> [Source: architecture.md#L539-540]

Esta story é a correção do desvio registrado no Sprint Change 2026-07-28: os quatro consumidores passaram a
remendar localmente porque `TEST_ENV` carregava placeholders não-hex. A correção é sempre no lado da fonte
(`environments.ts`), nunca no consumidor.

### Comportamento preservado byte a byte

Os valores hex usados nos remendos atuais (`0000...0001` para issuer, `0000...0002` para webhook) são
copiados **literalmente** para `TEST_ENV` — não gerar chaves novas, não usar `crypto.randomBytes` ou
qualquer valor diferente. Isso garante que public keys derivadas, DIDs (`did:yaid:issuer:<pubkey>`),
assinaturas JWT e assinaturas de webhook permanecem **idênticas** ao comportamento atual — é uma mudança de
"onde o valor mora", não "qual é o valor". As suítes `story-6-2` (round-trip Ed25519 com `...0002`) e
`story-9-1` (dynamic test com chave `"22".repeat(32)`, não afetada) validam isso sem precisar mudar suas
asserções de valor.

### `get_webhook_public_key_usecase.ts` mantém sua própria validação de formato

O `HEX_PRIVATE_KEY_PATTERN`/`hexToBytes` desse arquivo (que lança erro para hex malformado) **não** é um dos
quatro pontos de substituição — é uma validação de formato independente, já presente antes desta story via
"review patch" da Story 6.2, e é a única validação de formato em runtime até a Story 10.2 mover isso para o
boot do `envSchema`. Não remover, não duplicar em outro lugar.

### Gap descoberto durante o planejamento (não estava na AC original do epics.md)

`tests/unit/story-9-1/vc-jwt-issuance.test.mjs:90-93` contém um teste com o nome literal "does not touch the
ISSUER_PRIVATE_KEY test-placeholder substitution (Epic 10 scope)" que **afirma a presença** do remendo. Esse
teste foi escrito propositalmente para congelar o escopo até o Epic 10 chegar — agora que chegou, ele quebra
com a Task 2 se não for atualizado. Task 6 cobre a reescrita. Isso não é uma AC nova sendo inventada — é
necessário para satisfazer a AC #4 ("suíte completa passa integralmente").

### Testes — padrão do projeto

`node:test` + `node:assert/strict` em `.test.mjs`, três categorias (existência de arquivo, regex estático
sobre o source, `tsc --noEmit` final com `STAGE: "TEST"`) — ver `tests/unit/story-9-1/vc-jwt-issuance.test.mjs`
como referência direta mais recente no mesmo domínio (chaves/`environments.ts`). Teste dinâmico opcional via
`tsx --test` segue o precedente de `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts`
(`tsx` já é devDependency). Rodar `npm test` completo ao final — suíte atual soma testes estáticos e
dinâmicos de todas as stories anteriores; confirmar que o total sobe sem nenhuma regressão.

### Project Structure Notes

Nenhum arquivo novo em `src/`. Novo diretório `tests/unit/story-10-1/`. Modificações pontuais em
`tests/unit/story-6-1/webhook-delivery.test.mjs`, `tests/unit/story-6-2/webhook-public-key.test.mjs` e
`tests/unit/story-9-1/vc-jwt-issuance.test.mjs` (Task 6). Novo script `test:story:10.1` em `package.json`,
seguindo o padrão de `test:story:9.1`/`test:story:6.2`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1] — AC originais, contexto do Sprint Change 2026-07-28
- [Source: _bmad-output/planning-artifacts/architecture.md#L539-540] — regra "environments.ts entrega valores prontos", proibição de remendo no ponto de uso
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from code review de story-5-7] — débito mapeado explicitamente como escopo do Epic 10
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from code review de story-9-2-verificacao-da-vc-jwt-em-presentations-verify] — mesmo débito, resolução do ISSUER_PRIVATE_KEY no caminho de verificação
- [Source: src/shared/environments.ts] — arquivo principal, lido por completo
- [Source: src/modules/credential/app/issue_credential_usecase.ts] — consumidor 1, lido por completo
- [Source: src/modules/presentation/app/verify_presentation_usecase.ts] — consumidor 2, trecho relevante lido
- [Source: src/shared/infra/providers/Ed25519WebhookSigner.ts] — consumidor 3, lido por completo
- [Source: src/modules/webhook/app/get_webhook_public_key_usecase.ts, get_webhook_public_key_presenter.ts] — consumidor 4, lidos por completo
- [Source: tests/unit/story-6-1/webhook-delivery.test.mjs] — teste a reescrever (Task 6)
- [Source: tests/unit/story-6-2/webhook-public-key.test.mjs] — testes a reescrever (Task 6), lido por completo
- [Source: tests/unit/story-9-1/vc-jwt-issuance.test.mjs] — teste a reescrever (Task 6), gap descoberto no planejamento
- [Source: _bmad-output/implementation-artifacts/stories/9-1-emissao-da-vc-como-vc-jwt-eddsa.md] — padrão de Tasks/Dev Notes/Review Findings a seguir

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npm run test:story:6.2` — 22/22 passando após a reescrita dos testes do remendo/gate de stage.
- `node --test "tests/unit/story-6-1/*.test.mjs"` — 32/32 passando após a reescrita do teste do
  `Ed25519WebhookSigner`.
- `npm run test:story:9.1` — 4/4 dinâmicos + estáticos passando após a reescrita do teste que fixava
  deliberadamente o remendo ("Epic 10 scope").
- `npm run test:story:10.1` — 10 estáticos + 1 dinâmico, todos passando (testes novos desta story).
- `npm run test:unit` (suíte estática completa, 975 testes): 1ª rodada expôs uma regressão real não
  prevista no planejamento — `tests/unit/story-1-1/restructure.test.mjs` ("Story 1.1 centralizes
  process.env access") assumia via regex construída dinamicamente que **todas** as chaves de TEST_ENV
  começam com `"test-"`, o que deixou de valer para `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY`.
  Corrigido (ver File List). 2ª rodada: 966/975 passando; os 9 restantes são falhas pré-existentes em
  `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` (testes de bash real do pipeline
  Amplify) — confirmado via `git stash` que já falhavam **antes** desta story neste ambiente, sem
  qualquer relação com `environments.ts` ou chaves. Não corrigidos aqui (fora do escopo/diff da Story
  10.1).
- `npm run test:dynamic` (suíte dinâmica completa): 77/77 passando, 0 regressões.
- `npx eslint` nos 6 arquivos de produção e 5 arquivos de teste tocados: 0 findings.

### Completion Notes List

- `TEST_ENV` em `src/shared/environments.ts` passou a carregar `ISSUER_PRIVATE_KEY`/
  `WEBHOOK_SIGNING_PRIVATE_KEY` como os valores hex de 32 bytes prontos (`...0001`/`...0002`) — os
  mesmos valores que os quatro consumidores produziam via remendo local. `BLOCKCHAIN_WALLET_PRIVATE_KEY`
  não foi tocado (fora de escopo: nenhum consumidor faz `hexToBytes` desse valor em `TEST`).
- Os quatro pontos de substituição foram removidos: `issue_credential_usecase.ts`,
  `verify_presentation_usecase.ts`, `Ed25519WebhookSigner.ts` e `get_webhook_public_key_usecase.ts`
  (que também perdeu o gate de stage e o parâmetro `stage` do construtor, propagando a simplificação até
  `get_webhook_public_key_presenter.ts`). `HEX_PRIVATE_KEY_PATTERN`/`hexToBytes` de
  `get_webhook_public_key_usecase.ts` foram mantidos — não são parte do remendo, são o guard de formato
  do próprio arquivo.
- Três suítes de teste pré-existentes foram reescritas para afirmar o novo comportamento em vez da
  presença do remendo: `story-6-1/webhook-delivery.test.mjs`, `story-6-2/webhook-public-key.test.mjs` e
  `story-9-1/vc-jwt-issuance.test.mjs`. As asserções sobre o valor derivado `...0002` em `story-6-2`
  (round-trip Ed25519) permaneceram inalteradas, como exigido pela AC #3.
- **Gap descoberto durante a implementação (fora da AC original do epics.md):**
  `tests/unit/story-1-1/restructure.test.mjs` também fixava o formato antigo (prefixo `"test-"` para
  todas as chaves) e quebrou na primeira rodada da suíte completa — corrigido para diferenciar as duas
  chaves migradas (agora hex) de `BLOCKCHAIN_WALLET_PRIVATE_KEY` (mantém o placeholder).
- Criados 11 testes novos em `tests/unit/story-10-1/` (10 estáticos + 1 dinâmico): confirmam que
  `TEST_ENV` carrega os hex exatos, que os quatro consumidores não têm mais nenhuma referência a
  placeholder, e que `Environments.getEnvs()` sob `STAGE=TEST` retorna em runtime os mesmos valores hex
  que os remendos produziam (trava a garantia "nenhuma assinatura muda" da AC #1). Script
  `test:story:10.1` adicionado ao `package.json`.
- Nenhuma mudança em `envSchema`/`superRefine` — validação de formato é escopo da Story 10.2 (depende
  desta, não implementada aqui).
- Suíte completa: 966/975 estáticos passando (9 falhas pré-existentes não relacionadas, confirmadas via
  `git stash`) + 77/77 dinâmicos passando. Nenhuma regressão introduzida por esta story.

### File List

**Novos:**
- `tests/unit/story-10-1/key-centralization.test.mjs`
- `tests/unit/story-10-1/environments-key-centralization.dynamic.test.ts`
- `tests/unit/story-10-1/key-signing-roundtrip.dynamic.test.ts` (QA — round-trip Ed25519 através das
  classes de produção simplificadas, com o valor hex real de `environments.ts`)

**Modificados:**
- `src/shared/environments.ts` — `TEST_ENV.ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY` passam a
  carregar os valores hex prontos (idênticos aos produzidos pelos remendos removidos)
- `src/modules/credential/app/issue_credential_usecase.ts` — remendo local do issuer key removido, lê
  `this.issuerPrivateKey` diretamente
- `src/modules/presentation/app/verify_presentation_usecase.ts` — remendo local do issuer key removido
- `src/shared/infra/providers/Ed25519WebhookSigner.ts` — remendo local do webhook key removido
- `src/modules/webhook/app/get_webhook_public_key_usecase.ts` — remendo e gate de stage removidos;
  construtor perde o parâmetro `stage`; `HEX_PRIVATE_KEY_PATTERN`/`hexToBytes` mantidos
- `src/modules/webhook/app/get_webhook_public_key_presenter.ts` — para de passar `envs.stage` ao use case
- `tests/unit/story-6-1/webhook-delivery.test.mjs` — teste do `Ed25519WebhookSigner` reescrito
- `tests/unit/story-6-2/webhook-public-key.test.mjs` — 4 testes reescritos/removidos (remendo, gate de
  stage, assinatura do construtor, chamada do presenter)
- `tests/unit/story-9-1/vc-jwt-issuance.test.mjs` — teste que fixava o remendo ("Epic 10 scope")
  reescrito para afirmar sua ausência
- `tests/unit/story-1-1/restructure.test.mjs` — asserção de prefixo `"test-"` ajustada para refletir os
  valores hex de `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY` (gap descoberto na suíte completa)
- `package.json` — novo script `test:story:10.1`

## Change Log

- **2026-08-20** — Story criada via `bmad-create-story`. Análise dos quatro pontos de substituição de
  placeholder e da regra de arquitetura "environments.ts entrega valores prontos". Status →
  `ready-for-dev`.
- **2026-08-20** — Implementação completa da Story 10.1: `TEST_ENV` centraliza os valores hex prontos
  para `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY`; os quatro remendos locais removidos; testes
  pré-existentes reescritos (3 suítes) e 11 testes novos criados em `tests/unit/story-10-1/`. Regressão
  real encontrada e corrigida em `tests/unit/story-1-1/restructure.test.mjs` (gap não previsto no
  planejamento). Suíte completa sem regressões (966/975 estáticos + 77/77 dinâmicos; as 9 falhas
  restantes são pré-existentes em `story-11-8`, confirmadas via `git stash`, sem relação com esta story).
  Status → `review`.
- **2026-08-20** — Code review (3 camadas: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0
  decision-needed, 0 patch, 7 defer (registrados em `deferred-work.md`), 7 dismissed (falsos positivos da
  revisão cega sem contexto do projeto, ou comportamento por design confirmado pelas camadas com acesso
  ao código). Acceptance Auditor confirmou as 5 ACs satisfeitas sem violações, rodando as suítes de teste
  de forma independente. Status → `test`.
- **2026-08-20** — QA: geração de teste unitário formal adicional. Cobertura do dev-story já era
  abrangente (13 estáticos + 2 dinâmicos); adicionado 1 teste dinâmico novo (2 casos) fechando a lacuna
  "nenhum teste anterior exercitava as classes de produção simplificadas — `Ed25519WebhookSigner`/
  `GetWebhookPublicKeyUseCase` de um único argumento — através do round-trip Ed25519 real com o valor hex
  de `environments.ts`". Suíte completa: 966/975 estáticos (9 falhas pré-existentes não relacionadas) +
  79/79 dinâmicos, sem regressões. `test-summary.md` atualizado. Status → `done`.
