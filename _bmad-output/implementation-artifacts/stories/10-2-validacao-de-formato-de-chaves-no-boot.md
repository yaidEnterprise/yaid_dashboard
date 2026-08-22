# Story 10.2: Validação de Formato de Chaves no Boot

Status: done

> **Depende da Story 10.1 (`done`).** `TEST_ENV.ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY` já
> carregam os valores hex prontos (`...0001`/`...0002`) desde a Story 10.1 — validar formato antes disso
> teria quebrado o stage `TEST` inteiro. Essa dependência já está satisfeita; não é um bloqueio.

## Story

Como operador deste backend,
Quero que uma chave malformada derrube o boot em vez de falhar na primeira requisição,
Para que nunca seja possível subir produção assinando com uma chave inválida ou publicamente conhecida.

**Contexto:** `envSchema` em `src/shared/environments.ts` declara `ISSUER_PRIVATE_KEY`,
`WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY` e `BLOCKCHAIN_CONTRACT_ADDRESS` como
`z.string().min(1).optional()` — só checa **presença** (e só em `PROD`/`HOMOLOG`, via `superRefine`), nunca
**formato**. Uma chave com typo, tamanho errado ou igual a um valor hex conhecido do `TEST_ENV` passa
silenciosamente na validação do schema e só quebra depois, na primeira operação real de assinatura/leitura
on-chain. No caso mais grave, se o valor hex do `TEST_ENV` (publicamente conhecido neste repositório) vazar
para uma variável de ambiente real em `PROD`/`HOMOLOG`, o backend passaria a assinar VCs/webhooks com uma
chave privada que qualquer pessoa pode usar para forjar credenciais aceitas por
`verify_presentation_usecase.ts`.

**Nota sobre a redação do epics.md:** o parágrafo de contexto original do epics.md menciona que "apenas
`get_webhook_public_key_usecase` fazia esse guard" contra o placeholder fora do stage `TEST`. **Esse guard
não existe mais** — a Story 10.1 o removeu deliberadamente (Task 5), porque `environments.ts` deixou de
expor a string-placeholder em qualquer stage (o valor agora é hex pronto). Não procure esse guard antigo
para "generalizar" — ele já foi apagado. Esta story constrói a proteção equivalente **do zero**, dentro do
`envSchema`/`superRefine`, cobrindo os 4 valores de uma vez.

## Acceptance Criteria

1. **Given** `ISSUER_PRIVATE_KEY` e `WEBHOOK_SIGNING_PRIVATE_KEY` no `envSchema`
   **When** o schema é avaliado no boot (qualquer stage que chegue a `envSchema.parse()` — todos exceto
   `TEST`, que usa `TEST_ENV` diretamente sem passar pelo schema)
   **Then** ambas exigem exatamente 64 caracteres hexadecimais (32 bytes)
   **And** um valor com typo, tamanho incorreto ou caracteres não-hex **falha no boot** com mensagem
   acionável nomeando a variável

2. **Given** `BLOCKCHAIN_WALLET_PRIVATE_KEY` e `BLOCKCHAIN_CONTRACT_ADDRESS`
   **When** o schema é avaliado no boot
   **Then** `BLOCKCHAIN_WALLET_PRIVATE_KEY` segue a mesma regra de 64 hex chars das outras chaves privadas
   **And** `BLOCKCHAIN_CONTRACT_ADDRESS` tem seu formato validado via `ethers.isAddress` — o mesmo validador
   já usado em `EthersBlockchainClient` (linha 33, comentário *"para gerar erro acionável no boot, não em
   tempo de requisição"*) — reaproveitado, não reimplementado

3. **Given** o stage `PROD` ou `HOMOLOG`
   **When** qualquer uma das 4 chaves acima recebe o valor exato que `TEST_ENV` usa para essa mesma chave
   **Then** o boot falha explicitamente — o valor de teste é publicamente conhecido neste repositório e
   nunca pode ser usado fora do stage `TEST`
   **And** o mesmo vale para `DOTENV` e `DEV` — a rejeição de valor-placeholder **não** é condicionada a
   `PROD`/`HOMOLOG` como a checagem de presença é; ela roda sempre que `envSchema.parse()` executa

4. **Given** o stage `TEST`
   **When** o boot ocorre
   **Then** as chaves de teste do `TEST_ENV` são aceitas normalmente — `loadEnvs()` atribui `TEST_ENV`
   direto a `this.values` e **nunca chama `envSchema.parse()`** nesse stage, então nenhuma validação nova
   desta story pode ou deve rodar contra `TEST_ENV`

5. **Given** o stage `DOTENV` ou `DEV` sem as 4 chaves definidas
   **When** o boot ocorre
   **Then** o comportamento atual é preservado: a ausência é tolerada (os 4 campos continuam `.optional()`)
   **And** a checagem de presença por stage (`productionRequiredEnvNames`, só `PROD`/`HOMOLOG`) não muda

6. **Given** a suíte de testes completa
   **When** executada após a mudança
   **Then** passa integralmente — inclui reescrever `tests/unit/story-1-1/restructure.test.mjs:124`, que
   hoje afirma `${envName}: z.string().min(1)` para as 3 chaves privadas e quebra assim que o schema passa
   a usar `.regex(...)` no lugar de `.min(1)`

## Tasks / Subtasks

- [x] Task 1: Adicionar os padrões de validação de formato em `environments.ts` (AC: #1, #2)
  - [x] Adicionar após `productionRequiredEnvNames` (linha 23):
    ```ts
    const HEX_PRIVATE_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
    ```
  - [x] Adicionar `import { ethers } from "ethers";` no topo do arquivo (já é dependência do projeto — usada
    em `EthersBlockchainClient.ts` — não reinstalar nada)

- [x] Task 2: Trocar `.min(1)` por validação de formato nos 4 campos do `envSchema` (AC: #1, #2)
  - [x] Linhas 34-37 atuais:
    ```ts
    ISSUER_PRIVATE_KEY: z.string().min(1).optional(),
    WEBHOOK_SIGNING_PRIVATE_KEY: z.string().min(1).optional(),
    BLOCKCHAIN_WALLET_PRIVATE_KEY: z.string().min(1).optional(),
    BLOCKCHAIN_CONTRACT_ADDRESS: z.string().min(1).optional(),
    ```
    Manter como `z.string().optional()` simples (sem `.min(1)`, sem `.regex()`/`.refine()` no field level) —
    **toda a validação de formato desta story vive no `superRefine`, não no field schema** (Task 3). Isso
    mantém o estilo já usado no arquivo (a checagem de presença existente também vive em `superRefine`, via
    `ctx.addIssue`) e evita misturar dois estilos de erro Zod (mensagem de `.regex()` vs. `ctx.addIssue`
    customizada) para o mesmo grupo de variáveis.
    ```ts
    ISSUER_PRIVATE_KEY: z.string().optional(),
    WEBHOOK_SIGNING_PRIVATE_KEY: z.string().optional(),
    BLOCKCHAIN_WALLET_PRIVATE_KEY: z.string().optional(),
    BLOCKCHAIN_CONTRACT_ADDRESS: z.string().optional(),
    ```

- [x] Task 3: Reestruturar o `superRefine` — **ordem importa** (AC: #1, #2, #3, #4, #5)
  - [x] **Achado crítico do planejamento:** o `superRefine` atual (linhas 42-56) começa com
    `if (values.STAGE !== Stage.PROD && values.STAGE !== Stage.HOMOLOG) { return; }` — um **early return que
    sai da função inteira** para qualquer stage que não seja `PROD`/`HOMOLOG`. Se as checagens novas forem
    só *acrescentadas depois* dessa linha, elas nunca rodariam em `DOTENV`/`DEV` — violando a AC #3
    ("o mesmo vale para DOTENV e DEV") e o espírito da AC #1 ("quando o schema é avaliado no boot", sem
    condicionar a stage). **As checagens novas devem vir ANTES desse early return**; só a checagem de
    presença original (`productionRequiredEnvNames`/`is required for`) permanece depois dele, exatamente
    como está.
  - [x] Reescrever o `superRefine` completo (linhas 42-56) para:
    ```ts
    .superRefine((values, ctx) => {
      const hexKeyEnvNames = [
        "ISSUER_PRIVATE_KEY",
        "WEBHOOK_SIGNING_PRIVATE_KEY",
        "BLOCKCHAIN_WALLET_PRIVATE_KEY",
      ] as const;

      // Formato — roda sempre que o schema é avaliado (todo stage exceto TEST, que
      // nunca chama envSchema.parse(); ver loadEnvs()). Não gated por stage.
      for (const envName of hexKeyEnvNames) {
        const value = values[envName];
        if (value && !HEX_PRIVATE_KEY_PATTERN.test(value)) {
          ctx.addIssue({
            code: "custom",
            path: [envName],
            message: `${envName} must be exactly 64 hexadecimal characters (32 bytes)`,
          });
        }
      }

      if (
        values.BLOCKCHAIN_CONTRACT_ADDRESS &&
        !ethers.isAddress(values.BLOCKCHAIN_CONTRACT_ADDRESS)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["BLOCKCHAIN_CONTRACT_ADDRESS"],
          message: "BLOCKCHAIN_CONTRACT_ADDRESS must be a valid Ethereum address",
        });
      }

      // Placeholder de TEST_ENV nunca pode vazar para fora do stage TEST — também
      // não gated por stage (roda em DOTENV/DEV/PROD/HOMOLOG igualmente).
      for (const envName of productionRequiredEnvNames) {
        if (values[envName] && values[envName] === TEST_ENV[envName]) {
          ctx.addIssue({
            code: "custom",
            path: [envName],
            message: `${envName} is set to the known TEST_ENV placeholder value, which must never be used outside the TEST stage`,
          });
        }
      }

      // Presença — só obrigatório em PROD/HOMOLOG (inalterado desta story em diante).
      if (values.STAGE !== Stage.PROD && values.STAGE !== Stage.HOMOLOG) {
        return;
      }

      for (const envName of productionRequiredEnvNames) {
        if (!values[envName]) {
          ctx.addIssue({
            code: "custom",
            path: [envName],
            message: `${envName} is required for ${values.STAGE}`,
          });
        }
      }
    });
    ```
  - [x] `productionRequiredEnvNames` já é exatamente os 4 nomes (`ISSUER_PRIVATE_KEY`,
    `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`) — reaproveitado
    para o loop de placeholder (AC #3 cobre "qualquer chave", e as 4 já são o conjunto certo). Não criar uma
    segunda constante com os mesmos 4 nomes.
  - [x] `TEST_ENV[envName]` referenciado dentro do callback do `superRefine` é seguro mesmo `TEST_ENV` sendo
    declarado *depois* de `envSchema` no arquivo (linha 60 vs. 25): o callback só executa em tempo de
    chamada de `.parse()`, quando o módulo inteiro já terminou de carregar. Não precisa reordenar as
    declarações do arquivo.

- [x] Task 4: Reescrever o teste pré-existente que quebra com a Task 2 (AC: #6)
  - [x] `tests/unit/story-1-1/restructure.test.mjs:119-126` hoje:
    ```js
    [
      "ISSUER_PRIVATE_KEY",
      "WEBHOOK_SIGNING_PRIVATE_KEY",
      "BLOCKCHAIN_WALLET_PRIVATE_KEY",
    ].forEach((envName) => {
      assert.match(environmentSource, new RegExp(`${envName}: z\\.string\\(\\)\\.min\\(1\\)`));
    });
    ```
    Reescrever para afirmar o novo formato do field schema (`z.string().optional()`, sem `.min(1)`) **e**
    a presença da validação de formato correspondente no `superRefine` (regex/`ethers.isAddress` +
    mensagens `ctx.addIssue`), em vez de deletar a asserção. Seguir o precedente já usado 3x neste mesmo
    arquivo/bloco pelas Stories 1.1→10.1 de adaptar asserções obsoletas em vez de removê-las.
  - [x] Não tocar nas asserções logo abaixo (linhas 127-133, adicionadas pela Story 10.1) sobre os valores
    hex exatos de `TEST_ENV` — continuam válidas e inalteradas.
  - [x] Rodar `npm test` completo ao final e confirmar 0 regressões.

- [x] Task 5: Criar testes novos em `tests/unit/story-10-2/` (AC: #1-#6)
  - [x] Seguir o padrão do projeto: um `.test.mjs` estrutural (existência de arquivo, regex sobre o source,
    `tsc --noEmit` final) — ver `tests/unit/story-10-1/key-centralization.test.mjs` como referência direta.
  - [x] **Obrigatório (não "recomendado"), diferente da Story 10.1:** um `.dynamic.test.ts` via `tsx --test`
    que exercita `envSchema.parse()` de verdade, chamando `new Environments().loadEnvs()` — a lógica desta
    story é validação de runtime (Zod), e regex sobre o source não prova que o schema realmente rejeita
    input malformado. Ver `tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts` para o padrão
    `tsx --test` já estabelecido.
  - [x] **Como testar sem o cache do singleton atrapalhar:** `Environments.getEnvs()` cacheia a instância no
    módulo (`cachedEnvironments`) — chamar esse método repetidas vezes com stages/valores diferentes no
    mesmo processo de teste **não re-parseia nada** depois da primeira chamada. Em vez disso, instancie
    diretamente: `new Environments()` (a classe já é exportada) e chame `.loadEnvs()` nessa instância — esse
    método é público, lê `process.env` a cada chamada e não usa o cache estático. Não é necessário exportar
    `envSchema` nem nenhum outro símbolo novo.
  - [x] **Isolamento de `process.env` entre casos:** cada caso muda `process.env.STAGE` e as 4 variáveis de
    chave, então salve/restaure `process.env` a cada teste para não vazar estado entre casos. Esqueleto
    sugerido:
    ```ts
    const BASE_ENV = {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      SUPABASE_SECRET_KEY: "test-secret-key",
    };

    function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
      const snapshot = { ...process.env };
      try {
        for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        fn();
      } finally {
        for (const key of Object.keys(process.env)) {
          if (!(key in snapshot)) delete process.env[key];
        }
        Object.assign(process.env, snapshot);
      }
    }
    ```
  - [x] Casos obrigatórios (cada um via `withEnv` + `new Environments().loadEnvs()`):
    - AC #1: `STAGE=PROD` + `ISSUER_PRIVATE_KEY` com typo/tamanho errado/caractere não-hex (3 sub-casos) →
      `assert.throws`, mensagem contém `"ISSUER_PRIVATE_KEY"`. Repetir para `WEBHOOK_SIGNING_PRIVATE_KEY`.
    - AC #1 (positivo): `STAGE=PROD` + as 4 chaves com valores hex/endereço válidos (mas **diferentes** dos
      valores de `TEST_ENV` — ver AC #3) → não lança.
    - AC #2: `STAGE=PROD` + `BLOCKCHAIN_WALLET_PRIVATE_KEY` malformada → lança nomeando a variável;
      `BLOCKCHAIN_CONTRACT_ADDRESS` inválido (ex.: `"not-an-address"`) → lança nomeando a variável.
    - AC #3: `STAGE=PROD` com `ISSUER_PRIVATE_KEY` igual ao valor exato de `TEST_ENV.ISSUER_PRIVATE_KEY`
      → lança; repetir com `STAGE=DEV` (não só `PROD`/`HOMOLOG`) para provar que não é gated por stage;
      repetir para `WEBHOOK_SIGNING_PRIVATE_KEY`/`BLOCKCHAIN_CONTRACT_ADDRESS` com os respectivos valores de
      `TEST_ENV`.
    - AC #4: `STAGE=TEST` (sem nenhuma das 4 chaves setadas em `process.env`) → `loadEnvs()` não lança, e
      `envs.ISSUER_PRIVATE_KEY`/`envs.WEBHOOK_SIGNING_PRIVATE_KEY` retornam os valores de `TEST_ENV` —
      prova que a validação nova não roda contra `TEST_ENV`.
    - AC #5: `STAGE=DEV` sem nenhuma das 4 chaves em `process.env` → não lança (ausência tolerada,
      comportamento pré-existente preservado).
    - Regressão (pré-existente, não uma AC nova, mas deve continuar passando): `STAGE=PROD` sem
      `ISSUER_PRIVATE_KEY` nenhum → lança `"ISSUER_PRIVATE_KEY is required for PROD"` — prova que a
      reestruturação do `superRefine` (Task 3) não quebrou a checagem de presença original.
  - [x] Adicionar script `test:story:10.2` ao `package.json`:
    `"test:story:10.2": "node --test \"tests/unit/story-10-2/*.test.mjs\" && tsx --test \"tests/unit/story-10-2/*.dynamic.test.ts\""`
    (padrão idêntico ao `test:story:10.1`).

### Review Findings

**Patch (5, aplicados e verificados — suíte completa re-executada após cada correção):**
- [x] [Review][Patch] Valores `""` (string vazia) definidos explicitamente escapavam de toda validação
  nova em `DOTENV`/`DEV` — os 3 blocos novos usavam `if (value && ...)` (guard truthy), que trata `""`
  como "ausente" e pula a checagem; como os campos deixaram de ter `.min(1)`, isso é uma regressão real
  (antes, `.min(1)` rejeitava `""` incondicionalmente, em qualquer stage). Corrigido trocando o guard para
  `value !== undefined` nos 3 blocos (formato hex, `ethers.isAddress`, placeholder). Teste novo adicionado
  (`ISSUER_PRIVATE_KEY` = `""` em `DEV` agora lança). [`src/shared/environments.ts`]
- [x] [Review][Patch] A checagem de placeholder só comparava cada campo contra **seu próprio** valor de
  `TEST_ENV` (`values[envName] === TEST_ENV[envName]`) — um valor de teste vazado sob o **nome errado**
  (ex.: a chave hex do issuer copiada para `WEBHOOK_SIGNING_PRIVATE_KEY`) passava despercebido. A própria
  AC #3 do epics.md diz "qualquer chave recebe **um dos** valores de placeholder do TEST_ENV" — o conjunto
  inteiro, não só o par de mesmo nome. Corrigido: `knownTestValues = new Set(productionRequiredEnvNames.map(n
  => TEST_ENV[n]))`, comparação via `.has(value)`. 2 testes novos (cross-field para `WEBHOOK_SIGNING_PRIVATE_KEY`
  recebendo o valor do issuer, e para `BLOCKCHAIN_WALLET_PRIVATE_KEY` recebendo o valor do webhook).
  [`src/shared/environments.ts`]
- [x] [Review][Patch] `BLOCKCHAIN_WALLET_PRIVATE_KEY` não tinha nenhum teste cobrindo a rejeição de
  placeholder (AC #3) — as outras 3 variáveis tinham teste dedicado, essa não. Adicionado.
  [`tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts`]
- [x] [Review][Patch] Comentário/valor do caso "65 chars (wrong length)" no teste dinâmico estava incorreto
  — a string tinha na verdade 62 caracteres, não 65; o teste "passava" mas não exercitava o limite que
  alegava cobrir. Corrigido para uma string genuinamente de 65 chars.
  [`tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts`]
- [x] [Review][Patch] Várias asserções `assert.throws(..., /NOME_DA_VAR/)` só confirmavam que o nome do
  campo aparecia em algum lugar da mensagem de erro, não que a mensagem de validação de formato específica
  disparou — um teste desses continuaria "passando" mesmo se a checagem de formato fosse substituída por
  outra falha não relacionada que citasse o mesmo nome. Reescritas para casar com a mensagem específica
  (`"... must be exactly 64 hexadecimal characters"` / `"... must be a valid Ethereum address"`).
  [`tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts`]

**Defer (10, pré-existentes, fora do escopo desta story, ou decisões já documentadas nas Dev Notes):**
- [x] [Review][Defer] A exclusão do stage `TEST` das checagens novas depende inteiramente de `loadEnvs()`
  nunca chamar `envSchema.parse()` nesse stage (comportamento pré-existente, não tocado) — não há um guard
  redundante `if (values.STAGE === Stage.TEST) return` dentro do próprio `superRefine` que tornaria essa
  invariante auto-protegida no arquivo. Comportamento correto hoje (provado por teste), mas depende de um
  código fora deste bloco nunca mudar. [`src/shared/environments.ts`] — deferred, hardening opcional, sem
  risco atual
- [x] [Review][Defer] `BLOCKCHAIN_WALLET_PRIVATE_KEY` exige hex sem prefixo `0x`, mas ferramentas padrão do
  ecossistema Ethereum (MetaMask, listas de contas do Hardhat) costumam exportar chaves **com** `0x` —
  `ethers.Wallet` aceita ambos os formatos (confirmado nas Dev Notes desta story), mas o boot rejeitaria um
  valor operacionalmente válido só pelo prefixo. Decisão já documentada e deliberada nas Dev Notes ("mesma
  regra das outras duas chaves, não inventar um segundo formato") — falha segura (bloqueia o boot em vez de
  aceitar silenciosamente), fricção operacional, não brecha de segurança. [`src/shared/environments.ts`] —
  deferred, decisão de design já registrada
- [x] [Review][Defer] `HEX_PRIVATE_KEY_PATTERN` não tolera espaços/quebra de linha ao redor do valor (sem
  `.trim()`) — mesmo padrão já presente em `get_webhook_public_key_usecase.ts` desde a Story 6.2/10.1, não
  introduzido por esta story. [`src/shared/environments.ts`] — deferred, padrão pré-existente
- [x] [Review][Defer] `ethers.isAddress` (confirmado empiricamente nesta sessão, ethers 6.16.0) aceita
  formatos além de `0x` + 40 hex (ex.: endereço ICAP, hex de 40 chars sem `0x`) que só falhariam depois, de
  forma assíncrona, quando `ethers.Contract`/`resolveName` tentassem usá-los — exatamente a classe de bug
  que esta story existe para eliminar. Porém a AC #2 pede explicitamente para **reaproveitar** o validador
  já usado em `EthersBlockchainClient.ts:33` ("não reimplementar") — essa fraqueza já existe lá, pré-
  existente a esta story. Corrigir só em `environments.ts` criaria inconsistência entre os dois pontos de
  validação. Recomenda-se uma story futura para endurecer os dois juntos (ex.: exigir também
  `/^0x[0-9a-fA-F]{40}$/` além de `ethers.isAddress`). [`src/shared/environments.ts`,
  `src/shared/clients/blockchain/EthersBlockchainClient.ts:33`] — deferred, fraqueza herdada do precedente
  que a própria AC manda reaproveitar
- [x] [Review][Defer] `.env.local.example` define valores placeholder não-vazios (`YOUR_WALLET_PRIVATE_KEY`,
  `YOUR_ISSUER_PRIVATE_KEY`, `YOUR_WEBHOOK_SIGNING_PRIVATE_KEY`, `YOUR_BLOCKCHAIN_CONTRACT_ADDRESS`) para os
  4 campos — um `cp .env.local.example .env.local` sem preencher essas linhas agora quebra o boot em
  `DOTENV`/`DEV` (antes desta story isso era tolerado, pois `superRefine` retornava antes de qualquer
  checagem fora de `PROD`/`HOMOLOG`), rompendo a conveniência de "rodar signup/dashboard local sem
  blockchain nem issuer" documentada desde a Story 1.1. Resolver isso é mais complexo do que parece: a
  Story 11.8 faz o sync autoritativo dos nomes de env vars para o Amplify **derivando os nomes das linhas
  não-comentadas** deste mesmo arquivo — simplesmente comentar essas 4 linhas removeria esses nomes do sync
  de produção, o que provavelmente não é desejado (são secrets reais exigidos em `PROD`/`HOMOLOG`).
  Necessita tratamento dedicado (possivelmente um sprint change) que resolva as duas necessidades
  (nomes ainda sincronizados + valor de exemplo que não quebre o boot local) sem conflito.
  [`.env.local.example`] — deferred, acoplado à Story 11.8, precisa de análise própria
- [x] [Review][Defer] `productionRequiredEnvNames` agora serve duas responsabilidades (quais campos são
  obrigatórios em `PROD`/`HOMOLOG`, e quais campos devem rejeitar o valor de `TEST_ENV`) sob um nome que só
  sugere a primeira — um campo futuro adicionado a uma responsabilidade sem lembrar da outra passaria batido
  em silêncio. [`src/shared/environments.ts`] — deferred, nomenclatura/manutenibilidade, sem bug atual
- [x] [Review][Defer] Comparação de placeholder (`knownTestValues.has(value)`) é case-sensitive, sem
  normalização — hoje inofensivo, porque nenhum valor de `TEST_ENV` (chaves em `0`/`1`/`2`, endereço em
  dígitos) contém letras hex `a`-`f`/`A`-`F` para variar. Gap latente na comparação em si, não um exploit
  disponível hoje. [`src/shared/environments.ts`] — deferred, latente, sem exploit atual
- [x] [Review][Defer] Teste `tsc --noEmit` do arquivo estrutural novo compila o projeto inteiro e filtra
  linhas contendo `"lucide-react"` por substring — padrão idêntico já usado em dezenas de suítes de teste
  pré-existentes do projeto (`story-6-1`, `story-9-1`, `story-10-1` etc.), não uma fragilidade introduzida
  por esta story; redesenhar esse padrão sistêmico é fora do escopo. [`tests/unit/story-10-2/key-format-validation.test.mjs`]
  — deferred, padrão sistêmico pré-existente
- [x] [Review][Defer] Mutação de `process.env` (global compartilhado) entre os testes dinâmicos via
  `withEnv` — seguro apenas enquanto o test runner do Node executar os testes deste arquivo
  sequencialmente (comportamento padrão hoje); é exatamente o padrão que as próprias Dev Notes desta story
  instruíam usar. [`tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts`] — deferred, padrão
  instruído pela story, sem risco sob o comportamento padrão do test runner
- [x] [Review][Defer] Comentários do código em português, mensagens de erro/testes em inglês — inconsistência
  de estilo, mas é exatamente a convenção já estabelecida em todo o restante do projeto (não específica
  desta story). [`src/shared/environments.ts`] — deferred, convenção pré-existente do projeto

**Dismissed (4):** `ethers.isAddress` aceitar endereços "formalmente válidos mas semanticamente errados"
(ex.: endereço de burn) além do valor de placeholder conhecido — inerente ao que validação de *formato*
pode provar; a AC só pede rejeição de formato + do valor de placeholder específico, não correção semântica
do valor; dependência `ethers` "não verificável" no diff — confirmado que já é dependência direta do
projeto, já usada em `EthersBlockchainClient.ts` desde a Story 5.2; dúvida sobre o branch de placeholder de
`BLOCKCHAIN_WALLET_PRIVATE_KEY` ser "código morto" (já que seu placeholder é sempre não-hex e falharia
antes no check de formato) — confirmado por reprodução que o branch dispara normalmente para valores
vazados de *outros* campos (ver patch de detecção cross-field acima), não é código morto; preocupação
hipotética sobre concorrência futura no test runner quebrar o isolamento de `process.env` — não é o
comportamento padrão hoje, e não há indicação de mudança planejada.

## Dev Notes

### Onde mexer

Um único arquivo de produção: `src/shared/environments.ts` (lido por completo durante o planejamento desta
story — 311 linhas antes desta mudança). Mais um teste pré-existente a ajustar
(`tests/unit/story-1-1/restructure.test.mjs`) e um diretório de teste novo (`tests/unit/story-10-2/`).
Nenhuma rota, use case, presenter ou controller muda — os getters de `Environments`
(`ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, etc.) não mudam, porque por definição só retornam um
valor **já validado** pelo `envSchema.parse()` — a validação acontece antes, não no getter.

### O achado mais importante: o early-return do `superRefine` atual

Releia a Task 3. O `superRefine` de hoje devolve cedo (`return`) para qualquer stage que não seja
`PROD`/`HOMOLOG`, encerrando a função inteira. Se o desenvolvedor simplesmente *acrescentar* as checagens
novas no fim da função (depois desse `return`), elas silenciosamente nunca rodariam em `DOTENV`/`DEV` —
um bug sutil que passaria despercebido em qualquer teste que só cobrisse `PROD`/`HOMOLOG`. É por isso que a
Task 5 exige explicitamente um caso `STAGE=DEV` para a checagem de placeholder (AC #3) — esse é o teste que
pegaria esse erro de ordenação se ele acontecer.

### Por que a validação de formato fica em `ctx.addIssue`/`superRefine`, não em `.regex()`/`.refine()` no field

O arquivo já estabelece um estilo (a checagem de presença usa `ctx.addIssue` com `code: "custom"` e uma
mensagem `${envName} is required for ${stage}`). Usar `.regex(pattern, msg)` diretamente no field schema
funcionaria tecnicamente, mas criaria dois estilos de erro diferentes para o mesmo grupo de 4 variáveis
(mensagem de field-level regex vs. mensagem de `superRefine` customizada) sem nenhum ganho — pior para
quem for ler o arquivo depois. Manter tudo no `superRefine` unifica o estilo e deixa as 3 categorias de
checagem (formato, placeholder, presença) lado a lado, na mesma função, na ordem certa.

### `ethers.isAddress` — reaproveitar, não duplicar

`EthersBlockchainClient.ts:33` já valida `BLOCKCHAIN_CONTRACT_ADDRESS` com `ethers.isAddress` no construtor,
com o comentário explícito *"para gerar erro acionável no boot, não em tempo de requisição"* — a AC #2 cita
esse precedente literalmente. Isso significa que, após esta story, o endereço é validado **duas vezes**
(uma no boot via `envSchema`, outra no construtor de `EthersBlockchainClient` quando
`getBlockchainClient()` é chamado) — isso é **esperado e correto**, não uma duplicação a remover: a
validação em `EthersBlockchainClient` é uma defesa em profundidade independente (protege contra qualquer
outro caminho de instanciação futuro), e o comentário do review patch ali já documenta essa intenção. Não
remover a validação de `EthersBlockchainClient.ts` "porque agora é redundante" — não há AC pedindo isso, e
seria um item de scope creep.

### `BLOCKCHAIN_WALLET_PRIVATE_KEY` — mesmo padrão hex das outras duas chaves privadas

Confirmado por teste manual nesta sessão de planejamento: `new ethers.Wallet(hex)` (ethers v6.16.0, já
instalado) aceita a chave privada **com ou sem** prefixo `0x` — ambos os formatos funcionam. Para manter
consistência com `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY` (que usam 64 hex chars sem `0x`, sem
nenhum uso de `ethers` — são consumidas via `hexToBytes` custom para `@noble/ed25519`), valide
`BLOCKCHAIN_WALLET_PRIVATE_KEY` com o **mesmo** `HEX_PRIVATE_KEY_PATTERN` (64 hex chars, sem `0x`) — não
invente um segundo formato só porque essa chave em particular é consumida por `ethers` em vez de
`@noble/ed25519`.

### O que "qualquer chave" na AC #3 cobre

A AC #3 do epics.md diz "qualquer chave recebe um dos valores de placeholder do TEST_ENV" — interpretação
adotada nesta story: as 4 variáveis de `productionRequiredEnvNames` (as 3 chaves privadas + o endereço do
contrato), não só as 2 chaves de assinatura mencionadas no parágrafo de Contexto. Justificativa: mesmo o
endereço do contrato de teste (`0x0000...0001`) sendo público/não-secreto, deixá-lo vazar para `PROD` faria
o backend tentar operar contra um contrato que não existe naquela rede — um erro tão silencioso e
"funciona no meu stage mas quebra em prod" quanto os das chaves privadas. Tratar os 4 uniformemente também
simplifica a implementação (reaproveita `productionRequiredEnvNames` para o loop, Task 3).

### O que NÃO muda

`Environments` getters (`ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY`,
`BLOCKCHAIN_CONTRACT_ADDRESS`) — continuam chamando `requireConfiguredValue`, inalterados.
`Environments.loadEnvs()` — a lógica de detecção de stage e o bypass total do `envSchema.parse()` para
`Stage.TEST` não mudam (é exatamente esse bypass que garante a AC #4). `productionRequiredEnvNames` — o
array em si não muda, só ganha um segundo uso (loop de placeholder). Nenhuma mudança em
`get_webhook_public_key_usecase.ts` ou qualquer outro consumidor — o `HEX_PRIVATE_KEY_PATTERN` que já existe
lá (Story 10.1, mantido de propósito) passa a ser redundante com a validação nova do boot, mas removê-lo
**não é uma AC desta story** — é defesa em profundidade inofensiva, deixar como está.

### Testes — padrão do projeto

`node:test` + `node:assert/strict` para o `.test.mjs` estrutural; `tsx --test` para o `.dynamic.test.ts`
comportamental (`tsx` já é devDependency desde a Story 5.8). Diferente da Story 10.1 (refactor
preservador de comportamento, onde o teste dinâmico era só "recomendado"), esta story É a lógica de
validação em si — o teste dinâmico é obrigatório, porque só ele prova que `envSchema.parse()` realmente
lança/aceita nos casos certos. Rodar `npm test` completo ao final.

### Project Structure Notes

Um arquivo de produção modificado (`environments.ts`). Um teste pré-existente ajustado
(`tests/unit/story-1-1/restructure.test.mjs`, terceira vez que esse mesmo bloco precisa de ajuste desde a
Story 10.1 — bloco historicamente instável a mudanças em `environments.ts`, nada de errado nisso, é o teste
certo para checar essas propriedades). Novo diretório `tests/unit/story-10-2/`. Novo script
`test:story:10.2` em `package.json`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2] — AC originais, nota sobre o guard antigo
  removido pela Story 10.1
- [Source: _bmad-output/planning-artifacts/architecture.md#L539-544] — regras "environments.ts entrega
  valores prontos" e "process.env somente em environments.ts"
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from code review de
  story-10-1-centralizacao-de-chaves-de-teste-no-environments] — os 3 itens explicitamente atribuídos a
  esta story (validação de formato ausente nos 3 consumidores, `envSchema` só checando presença, vazamento
  do valor hex real do TEST_ENV para PROD/HOMOLOG sem guarda)
- [Source: _bmad-output/implementation-artifacts/stories/10-1-centralizacao-de-chaves-de-teste-no-environments.md] —
  story anterior, contexto completo dos 4 pontos de substituição removidos e por que `BLOCKCHAIN_WALLET_PRIVATE_KEY`
  não foi tocado ali
- [Source: src/shared/environments.ts] — arquivo principal, lido por completo
- [Source: src/shared/clients/blockchain/EthersBlockchainClient.ts:26-40] — precedente de `ethers.isAddress`
  citado pela AC #2; confirmado nesta sessão que `ethers.Wallet` aceita chave privada com ou sem `0x`
- [Source: tests/unit/story-1-1/restructure.test.mjs:116-147] — teste a reescrever (Task 4)
- [Source: tests/unit/story-5-2/blockchain-client.test.mjs] — confirmado (grep) que nenhuma asserção ali
  trava a cadeia exata `.min(1)` de `BLOCKCHAIN_CONTRACT_ADDRESS`, só checagens soltas de presença de texto
- [Source: tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts] — precedente de teste dinâmico
  via `tsx --test`

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `node --test tests/unit/story-1-1/restructure.test.mjs` — 1 falha esperada na 1ª rodada (asserção antiga
  `${envName}: z.string().min(1)`, que a Task 2 substitui por `.optional()`); reescrita conforme Task 4,
  6/6 passando na 2ª rodada.
- `node --test tests/unit/story-10-2/key-format-validation.test.mjs` — 9/9 passando (inclui o teste de
  ordenação crítica: hex/placeholder checks aparecem no source ANTES do early-return de presença).
- `npx tsx --test tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts` — 12/12 passando:
  formato malformado nas 3 chaves privadas + endereço do contrato (nomeando a variável em cada caso),
  valores válidos não lançam, placeholder exato do `TEST_ENV` rejeitado em `PROD`/`HOMOLOG`/`DEV`/`DOTENV`
  (prova direta de que a checagem não é gated por stage), `STAGE=TEST` aceita `TEST_ENV` sem rodar a
  validação nova, `DEV` sem nenhuma das 4 chaves continua tolerado, e a checagem de presença pré-existente
  em `PROD` continua funcionando após a reestruturação do `superRefine`.
- `npm run test:story:10.2` — 9 estáticos + 12 dinâmicos, todos passando.
- `npm run test:unit` (suíte estática completa, 984 testes): 975/984 passando; as 9 falhas restantes são as
  mesmas pré-existentes de `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` (bash real do
  pipeline Amplify), já confirmadas não relacionadas via `git stash` durante a Story 10.1 — sem relação com
  `environments.ts`.
- `npm run test:dynamic` (suíte dinâmica completa): 91/91 passando (79 pré-existentes + 12 novos desta
  story), 0 regressões.
- `npx eslint src/shared/environments.ts tests/unit/story-10-2/*.mjs tests/unit/story-10-2/*.ts
  tests/unit/story-1-1/restructure.test.mjs` — 0 findings.
- `STAGE=TEST npx tsc --noEmit` — limpo, sem erros novos.

### Completion Notes List

- `src/shared/environments.ts`: os 4 campos de chave (`ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`,
  `BLOCKCHAIN_WALLET_PRIVATE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`) trocaram `z.string().min(1).optional()`
  por `z.string().optional()` simples — toda a validação de formato migrou para dentro do `superRefine`,
  mantendo o mesmo estilo de erro (`ctx.addIssue` com `code: "custom"`) já usado pela checagem de presença
  pré-existente.
- `superRefine` ganhou 3 blocos novos, todos posicionados **antes** do early-return gated por
  `PROD`/`HOMOLOG`: (1) formato hex de 64 chars para as 3 chaves privadas via `HEX_PRIVATE_KEY_PATTERN`;
  (2) `ethers.isAddress` para `BLOCKCHAIN_CONTRACT_ADDRESS` (reaproveitado de `EthersBlockchainClient.ts`,
  não reimplementado); (3) rejeição do valor exato de `TEST_ENV` para qualquer uma das 4 variáveis, em
  qualquer stage que chegue a `envSchema.parse()` (ou seja, todos exceto `TEST`). A checagem de presença
  original permanece depois do early-return, inalterada.
- Esse posicionamento (antes do early-return) era o ponto crítico do planejamento: colocar as checagens
  novas depois dele as tornaria `PROD`/`HOMOLOG`-only silenciosamente, quebrando a AC #3 ("o mesmo vale para
  DOTENV e DEV"). O teste dinâmico cobre exatamente esse cenário (`STAGE=DEV` + placeholder → lança).
- `Stage.TEST` continua bypassando `envSchema.parse()` inteiramente em `loadEnvs()` (inalterado) — por isso
  nenhuma validação nova desta story roda contra `TEST_ENV`, satisfazendo a AC #4 sem nenhum código
  condicional extra.
- Teste pré-existente `tests/unit/story-1-1/restructure.test.mjs` ajustado (terceira vez desde a Story
  10.1) para refletir `.optional()` sem `.min(1)` e a presença dos novos blocos de validação no
  `superRefine`.
- Nenhuma mudança em `get_webhook_public_key_usecase.ts` — o `HEX_PRIVATE_KEY_PATTERN` local ali (Story
  10.1) fica redundante com a validação nova do boot, mas removê-lo está fora do escopo desta story
  (defesa em profundidade inofensiva, não uma AC).
- Suíte completa: 975/984 estáticos (9 falhas pré-existentes não relacionadas) + 91/91 dinâmicos, sem
  regressões introduzidas por esta story.

### File List

**Novos:**
- `tests/unit/story-10-2/key-format-validation.test.mjs`
- `tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts`

**Modificados:**
- `src/shared/environments.ts` — import de `ethers`, `HEX_PRIVATE_KEY_PATTERN`, os 4 campos de chave
  simplificados para `z.string().optional()`, `superRefine` reestruturado com validação de formato +
  rejeição de placeholder (antes do early-return de presença)
- `tests/unit/story-1-1/restructure.test.mjs` — asserção de schema ajustada para `.optional()` sem
  `.min(1)`, novas asserções sobre os blocos de validação do `superRefine`
- `package.json` — novo script `test:story:10.2`

## Change Log

- **2026-08-21** — Story criada via `bmad-create-story`. Achado crítico do planejamento: o early-return do
  `superRefine` atual sai da função inteira para qualquer stage que não seja `PROD`/`HOMOLOG` — as
  checagens novas precisam vir antes dele, não depois, para satisfazer a AC #3 em `DOTENV`/`DEV`. Status →
  `ready-for-dev`.
- **2026-08-21** — Implementação completa da Story 10.2: `envSchema` valida formato hex (64 chars) para
  `ISSUER_PRIVATE_KEY`/`WEBHOOK_SIGNING_PRIVATE_KEY`/`BLOCKCHAIN_WALLET_PRIVATE_KEY`, `ethers.isAddress`
  para `BLOCKCHAIN_CONTRACT_ADDRESS`, e rejeita o valor exato de `TEST_ENV` para as 4 variáveis em qualquer
  stage não-`TEST` — tudo dentro do `superRefine`, reposicionado antes do early-return de presença. Teste
  pré-existente da Story 1.1 ajustado (3ª vez desde a Story 10.1). 21 novos testes (9 estáticos + 12
  dinâmicos, este último obrigatório por ser lógica de validação de runtime). Suíte completa sem
  regressões (975/984 estáticos, 9 falhas pré-existentes não relacionadas + 91/91 dinâmicos). Status →
  `review`.
- **2026-08-21** — Code review (3 camadas: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0
  decision-needed, 5 patch (aplicados e verificados), 10 defer (registrados em `deferred-work.md`), 4
  dismissed. Os 5 patches corrigiram bugs reais introduzidos por esta story: (1) string vazia definida
  explicitamente escapava de toda validação nova em DOTENV/DEV (guard truthy → `!== undefined`); (2) a
  checagem de placeholder só comparava cada campo contra seu próprio valor de `TEST_ENV`, deixando passar
  um valor de teste vazado sob o nome errado de outro campo (corrigido para checar contra o conjunto
  inteiro de valores conhecidos, conforme o próprio texto da AC #3 — "um dos valores"); (3-5) lacunas e
  imprecisões nos testes novos (cobertura faltante para `BLOCKCHAIN_WALLET_PRIVATE_KEY`, comprimento errado
  no comentário de um caso de teste, asserções fracas que só checavam o nome do campo). Suíte completa
  re-executada após os patches: 976/985 estáticos (9 falhas pré-existentes não relacionadas) + 94/94
  dinâmicos, `eslint` 0 findings. Acceptance Auditor confirmou as 6 ACs satisfeitas e a disciplina de
  escopo (nenhum arquivo fora do File List tocado). Status → `test`.
- **2026-08-21** — QA: cobertura do dev-story mais os 5 patches do code review (cada um já com teste de
  regressão dedicado) já satisfazem integralmente as 6 ACs — nenhum teste novo de QA foi necessário (mesmo
  padrão da Story 7.5). `test-summary.md` atualizado. Suíte completa: 976/985 estáticos (9 falhas
  pré-existentes não relacionadas) + 94/94 dinâmicos, sem regressões. Status → `done`.
