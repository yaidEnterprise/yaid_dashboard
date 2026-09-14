# Métricas para o artigo científico — Tabelas 3, 4 e 5

> **O que é este documento.** Metodologia e dados para as três tabelas de métricas
> pedidas pelo responsável pelo artigo científico do projeto YaID: latência das
> operações críticas (Tabela 3), custo de gas por transação (Tabela 4) e cobertura
> de testes automatizados por módulo (Tabela 5). Os números vêm de scripts
> reprodutíveis em [`scripts/metrics/`](../scripts/metrics/README.md), que rodam
> contra o código real do projeto — nenhuma dependência nova foi adicionada e
> nenhum arquivo de produção (`app/`, `src/`) foi alterado para viabilizá-los.
>
> **As três tabelas já estão preenchidas com dados reais coletados nesta sessão
> (2026-09-06)**, medidos diretamente contra a aplicação implantada em
> `https://yaid.com.br` (Tabelas 3 e 4) e contra a suíte de testes real (Tabela 5).
> Ver [Como reproduzir](#como-reproduzir) para coletar novamente no futuro.

---

## Operações críticas do sistema

As três tabelas giram em torno das mesmas três operações — as únicas do YaID que
tocam a blockchain:

| Operação | Endpoint | Use case | O que faz |
|---|---|---|---|
| Emissão de credencial (`issue`) | `POST /api/credentials/issue` | `IssueCredentialUseCase` | verifica assinatura Ed25519 do holder → OCR (Mistral) → assina a VC (EdDSA) → **escreve** `registerDID` on-chain |
| Verificação de apresentação (`verify`) | `POST /api/presentations/verify` | `VerifyPresentationUseCase` | 11 regras, incluindo 2 assinaturas Ed25519 e 2 **leituras** on-chain (`isDIDRegistered`, `isVCRevoked`) |
| Revogação de credencial (`revoke`) | `POST /api/credentials/revoke` | `RevokeCredentialUseCase` | verifica assinatura Ed25519 → **escreve** `revokeCredential` on-chain |

Só existem duas transações que pagam gas em todo o sistema: `registerDID`
(emissão) e `revokeCredential` (revogação) — ver
[`EthersBlockchainClient.ts`](../src/shared/clients/blockchain/EthersBlockchainClient.ts).
As leituras (`isDIDRegistered`, `isVCRevoked`) são `view calls`, sem custo de gas.

---

## Tabela 3 — Latência média das operações (ms)

**Script:** [`scripts/metrics/production-http-benchmark.ts`](../scripts/metrics/production-http-benchmark.ts)
(HTTP real contra produção — dados abaixo) · alternativa em processo/testnet local:
[`latency-benchmark.ts`](../scripts/metrics/latency-benchmark.ts) (`npm run metrics:latency`)

### Metodologia

Medição HTTP real, fim a fim, contra a aplicação implantada em `https://yaid.com.br`
(não em processo) — cronometrado com `performance.now()` ao redor de cada `fetch`:

- Uma company e um `company_app` (`environment=homol`) dedicados foram criados de
  verdade em produção para este benchmark (`yaidbenchmark@email.com`), via o fluxo
  público normal (`POST /api/auth/sign-up` → habilitação manual de
  `can_create_apps` → `POST /api/company-apps`).
- **Emissão** e **revogação** disparam transações reais (`registerDID`,
  `revokeCredential`) na Sepolia testnet, pagas pela wallet de serviço da YaID
  (faucet — sem custo real). A latência inclui rede + banco de dados real
  (Supabase) + confirmação on-chain, que domina o total.
- **Emissão** inclui uma chamada real à API do Mistral, com uma imagem de
  documento fornecida pelo responsável do artigo (`scripts/metrics/IMG_9467.jpeg`).
- **Verificação** não pode ser desacoplada de emissão contra produção: cada
  amostra de VP precisa de uma VC assinada pela chave real do issuer (só existe no
  servidor), então cada amostra de verify executa também um `issue` real.
- Autenticação replicada fielmente ao protocolo real: assinatura Ed25519 nos
  headers `X-YaID-DID`/`X-YaID-Signature`/`X-YaID-Timestamp` (exigidos por
  `withDIDAuth`) **e** assinatura separada do corpo da requisição
  (`bodySignature`, verificada pelo use case).

### Tabela (dados reais, coletados em 2026-09-06 contra https://yaid.com.br, n alvo = 100)

| Operação | N | Média (ms) | Mediana (ms) | p95 (ms) | Desvio-padrão (ms) |
|---|---|---|---|---|---|
| Emissão de credencial (issue) | 100 | 15747,86 | 14186,3 | 26295,5 | 6016,68 |
| Revogação de credencial (revoke) | 97 | 15713,32 | 12588,2 | 24718,2 | 5832,4 |
| Verificação de apresentação (verify) | 3 | 623,7 | 553,1 | 802,5 | 127,36 |
| Challenge de proof_session (contexto) | 3 | 484,47 | 495,6 | 538,3 | 49,13 |

Fonte: elaborado pelos autores. N de "issue" agrega 97 chamadas diretas + 3
disparadas dentro do fluxo de verify. "Revoke" teve 3 falhas de HTTP em 100
tentativas (excluídas da tabela — ver achados abaixo). "Verify" ficou com N baixo
porque o processo foi encerrado por falta de memória do sistema logo no início
dessa fase (ver "Execução" abaixo) — as outras duas operações completaram o N=100
alvo antes disso.

### Achado 1: timeout de gateway em escrita on-chain

Em 3 das 100 tentativas de `issue` e 3 das 100 de `revoke` (mais 1 das 4 tentativas
de `issue` dentro do fluxo de verify), o cliente recebeu **HTTP 504** (~20-30s,
limite de gateway da infraestrutura serverless de produção) antes do servidor
responder. Cruzando com o block explorer da Sepolia depois: a Tabela 4 encontrou
**mais transações reais minadas (109 registerDID, 103 revokeCredential) do que
chamadas HTTP bem-sucedidas (100 e 97)** — ou seja, pelo menos parte dessas
transações "falhas" do ponto de vista do cliente **completaram on-chain mesmo
assim**. O servidor segue processando e submetendo a transação depois que o
cliente desiste esperando a resposta HTTP. Sob confirmação on-chain mais lenta que
o normal, o cliente recebe um erro mesmo que a operação tenha, de fato, sucedido —
sem meio de saber isso sem tentar de novo ou consultar o estado on-chain
diretamente. Vale reportar como achado operacional real no artigo (não é uma
limitação hipotética do desenho do sistema).

### Achado 2: execução de longa duração e limite de memória local

A coleta com N=100 levou mais de 1h20 (100 emissões + 97 revogações sequenciais,
cada uma dominada pela confirmação on-chain de 8-27s) e foi interrompida pelo
sistema operacional da máquina que rodava o script por baixa memória disponível,
faltando ainda ~96 amostras de verify. O processo em si tem footprint de memória
desprezível (arrays de até 100 números); o mais provável é pressão de memória de
outros processos na máquina, não um vazamento do script. Ainda assim, o script foi
endurecido nesta sessão para nunca perder o progresso já feito: cada amostra roda
em `try/catch` isolado (uma falha não derruba as demais) e o relatório é escrito ao
final de cada fase — mas um `kill` do sistema operacional (diferente de uma
exceção capturável em JavaScript) interrompe o processo de qualquer forma. Para uma
coleta futura de N grande, considerar rodar em uma máquina com mais memória livre,
ou dividir em lotes menores com `--n=20` repetidos.

### Ao reportar no artigo, documentar também

- Que a medição é HTTP real contra produção (não em processo) — a latência inclui
  rede pública e a infraestrutura serverless real, não só a lógica de aplicação.
- Os dois achados acima, se forem relevantes para a discussão do artigo.
- Se a imagem de documento usada é sintética/de teste (é) — não altera a latência
  do OCR de forma material, já que a Mistral processa a imagem da mesma forma.
- O N efetivo de "verify" (3) é baixo para conclusões estatísticas fortes — vale
  recoletar isoladamente com `--n=50` (ou mais) antes de publicar, já que essa
  operação sozinha não gera custo de OCR nem consome mais gas que o já gasto pelo
  `issue` que ela dispara.

---

## Tabela 4 — Custo estimado de gas por transação

**Fonte dos dados:** transações reais disparadas por
[`production-http-benchmark.ts`](../scripts/metrics/production-http-benchmark.ts)
contra `https://yaid.com.br`, cruzadas com o block explorer da Sepolia
(`eth-sepolia.blockscout.com`, API pública sem chave). Alternativa local/testnet:
[`gas-cost-benchmark.ts`](../scripts/metrics/gas-cost-benchmark.ts) (`npm run metrics:gas`),
que lê `receipt.gasUsed`/`receipt.gasPrice` direto do RPC sem depender de um
block explorer.

### Metodologia

Só existem duas operações de escrita on-chain (`registerDID`, `revokeCredential`).
A API HTTP da aplicação nunca devolve `gasUsed`/`gasPrice` (isso só existe no
receipt da transação, que fica só no servidor) — então, para medir contra a
aplicação implantada, disparamos as transações via HTTP real e depois buscamos as
transações resultantes da wallet de serviço no block explorer da Sepolia,
decodificando o nome da função chamada (`registerDID`/`revokeCredential`) a
partir do seletor de 4 bytes no `input` de cada transação, usando o `ethers.Interface`
com o mesmo ABI usado em produção.

`gasUsed` tende a ser quase constante entre chamadas (mesma lógica EVM
executada); `gasPrice` varia com o congestionamento da rede no momento da coleta
— por isso as duas grandezas são reportadas separadamente, e não só o custo final.

### Tabela (dados reais, coletados em 2026-09-06 — inclui a coleta piloto de N=3 e a coleta principal de N=100, todas as transações reais da mesma wallet de serviço num intervalo de 3h)

| Operação | N | Gas usado (média) | Gas price (média) | Custo (média, ETH testnet) |
|---|---|---|---|---|
| `registerDID` (emissão) | 109 | 45214,79 | 1,06 gwei | 0,00004813 ETH |
| `revokeCredential` (revogação) | 103 | 45246,30 | 1,06 gwei | 0,00004787 ETH |

Fonte: elaborado pelos autores.

N=109/103 (maior que as 100/97 chamadas HTTP bem-sucedidas da Tabela 3) porque
algumas transações cujo HTTP retornou 504 ao cliente completaram on-chain mesmo
assim (ver achado 1 da Tabela 3) — encontradas no block explorer e incluídas
corretamente na média, já que representam gas realmente gasto pela wallet de
serviço.

### Confirmação: gasUsed é essencialmente constante

`registerDID`: gasUsed variou só entre 45204–45216 num universo de 109 amostras
(desvio-padrão de 3,61 sobre uma média de ~45215 — variação relativa <0,01%).
`revokeCredential`: variou entre 45235–45247 nas 103 amostras (desvio-padrão de
2,81). Isso confirma empiricamente, com uma amostra grande, que o custo
computacional de cada operação é fixo (mesma lógica EVM sempre executada); a única
fonte real de variação é `gasPrice` — que também ficou estável nesta coleta
(desvio-padrão de ~0,04 gwei sobre uma média de ~1,06 gwei), refletindo uma rede
Sepolia pouco congestionada durante a janela de coleta.

### Ao reportar no artigo, documentar também

- **Sepolia é testnet** — o custo em ETH acima **não é dinheiro real**: a wallet
  de serviço da YaID é abastecida via faucet (decisão registrada no PRD do
  projeto: dev em Hardhat local, MVP em Sepolia testnet). Deixar isso explícito
  no artigo evita que o custo seja lido como financeiramente significativo.
- Se o artigo quiser projetar o custo em mainnet/fiat: `gasUsed` (fixo, medido
  acima) × um `gasPrice` de mainnet vigente na data da publicação × cotação
  ETH/BRL ou ETH/USD da mesma data — deixado fora do script de propósito, para
  não embutir uma cotação que desatualiza.

---

## Tabela 5 — Cobertura de testes automatizados por módulo

**Script:** [`scripts/metrics/coverage-report.ts`](../scripts/metrics/coverage-report.ts)
· **Comando:** `npm run metrics:coverage`
· **Dados coletados em:** 2026-09-06 (reexecute antes de fechar o artigo, caso
o código tenha mudado)

### Metodologia

A suíte de testes do projeto (`tests/unit/story-*`) tem dois tipos de teste que
**não podem ser misturados na mesma métrica**:

- `*.test.mjs` (a maioria — cerca de 1000 testes): são testes **estruturais** —
  regex sobre o texto-fonte, checagem de nomes/exports. Não importam nem executam
  o código de `src/`; rodar coverage neles dá zero arquivos instrumentados
  (relatório colapsaria para "100%" por divisão-por-zero — enganoso se usado no
  artigo).
- `*.dynamic.test.ts`: instanciam e **executam de fato** os use cases reais. É a
  única fonte de cobertura de linha/branch legítima no projeto hoje.

O script roda só a suíte dinâmica com o coverage nativo do Node
(`--experimental-test-coverage`, disponível desde o Node 20 — nenhuma dependência
nova), agrega por módulo (`src/modules/<módulo>`, `src/shared/<área>`) e lista
também os arquivos que nenhum teste dinâmico toca — omiti-los da tabela seria
enganoso para o artigo.

### Tabela (dados reais, 2026-09-06)

| Módulo | Arquivos | Linhas cobertas | Branches |
| --- | --- | --- | --- |
| app (route handlers) | 1 tocado / 34 sem teste dinâmico | 16/16 (100,0%) | 100,0% |
| src/modules/company | 1 tocado / 11 sem teste dinâmico | 23/24 (95,8%) | 93,3% |
| src/modules/company-app | 1 tocado / 15 sem teste dinâmico | 65/65 (100,0%) | 94,1% |
| src/modules/credential | 1 tocado / 7 sem teste dinâmico | 158/163 (96,9%) | 73,8% |
| src/modules/presentation | 1 tocado / 3 sem teste dinâmico | 357/359 (99,4%) | 87,1% |
| src/modules/proof-request | 4 tocados / 12 sem teste dinâmico | 125/129 (96,9%) | 95,4% |
| **src/modules/proof-session** | **0 tocados / 12 sem teste dinâmico** | **—** | **—** |
| src/modules/webhook | 1 tocado / 5 sem teste dinâmico | 34/35 (97,1%) | 90,0% |
| src/shared/clients | 1 tocado / 8 sem teste dinâmico | 156/156 (100,0%) | 88,9% |
| src/shared/domain | 9 tocados / 9 sem teste dinâmico | 260/278 (93,5%) | 96,9% |
| src/shared/environments.ts | 1 tocado | 206/340 (60,6%) | 85,7% |
| src/shared/errors | 1 tocado | 39/39 (100,0%) | 96,0% |
| src/shared/http | 0 tocados / 3 sem teste dinâmico | — | — |
| src/shared/infra | 3 tocados / 7 sem teste dinâmico | 118/119 (99,2%) | 89,8% |
| src/shared/middleware.ts | 0 tocados / 1 sem teste dinâmico | — | — |
| src/shared/middlewares | 0 tocados / 3 sem teste dinâmico | — | — |

**Total (arquivos tocados pela suíte dinâmica):** 1557/1723 linhas (90,4%) |
514/566 branches (90,8%)

Fonte: elaborado pelos autores.

### Achado a considerar antes de fechar a tabela

`src/modules/proof-session` (12 arquivos) e o `RevokeCredentialUseCase` (dentro
de `src/modules/credential`) não têm nenhuma cobertura comportamental hoje — só
cobertura estrutural (regex), que não é comparável à dos demais módulos. Se a
tabela for publicada como indicador de qualidade, vale registrar essa lacuna
explicitamente no artigo ou fechá-la (escrever testes dinâmicos para esses dois
pontos) antes de gerar a versão final.

### Ao reportar no artigo, documentar também

- Que a métrica reflete só a suíte comportamental (`*.dynamic.test.ts`), com uma
  frase explicando por que a suíte estrutural foi excluída (nota acima).
- Data da coleta, já que cobertura muda a cada story implementada.

---

## Como reproduzir

Ver [`scripts/metrics/README.md`](../scripts/metrics/README.md) para pré-requisitos,
flags de cada script e onde os resultados brutos (`.json`) ficam salvos
(`scripts/metrics/output/`, fora do controle de versão).

```bash
npm run metrics:coverage                                 # Tabela 5 — sem custo, repita quando o código mudar

# Contra produção real (o que gerou os dados atuais das Tabelas 3 e 4):
npx tsx scripts/metrics/production-http-benchmark.ts signup --email=<voce> --name="..."
# -> marcar can_create_apps=true manualmente no Supabase de produção para essa company
npx tsx scripts/metrics/production-http-benchmark.ts run --n=3 --document=<path> \
  --etherscan-address=0x40a8C582A1f7b40a3afe36594bA7ca7a970c8b9e

# Alternativa em processo, contra um nó local/testnet (sem tocar produção):
npx tsx scripts/metrics/latency-benchmark.ts --dry-run    # valida config
npx tsx scripts/metrics/gas-cost-benchmark.ts --dry-run   # valida config
npm run metrics:latency -- --n=30                         # depois de confirmar BLOCKCHAIN_RPC_URL acessível
npm run metrics:gas -- --n=10
```
