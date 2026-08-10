# Sprint Change Proposal — 2026-07-28

**Projeto:** yaid_dashboard
**Autor:** Victordegasperi
**Gatilho:** Revisão da lógica de emissão de credencial (`issue_credential_usecase`)
**Classificação de escopo:** Moderado (reorganização de backlog + implementação)

---

## 1. Sumário do Problema

### 1.1 Problema central

A emissão de Verifiable Credential produz **uma única claim por credencial**, selecionada pelo
`proofType` recebido na requisição:

- `proofType === "personhood"` → `claims = { personhood: true }`
- `proofType === "ageOver18"` → `claims = { ageOver18: true }`

São mutuamente exclusivos. Para dispor das duas respostas, o holder precisa realizar **duas
emissões distintas**, enviando a foto do documento duas vezes e mantendo duas credenciais
separadas no aparelho.

Isso contradiz a promessa central do produto — *"a pessoa comprova o documento uma vez e reaproveita
essa comprovação"* — e contradiz o que PRD e CONTEXT.md já especificam.

### 1.2 Problema secundário

Um holder **menor de 18 anos** recebe `HTTP 422 "Document processing failed"` no ramo de idade
(`issue_credential_usecase.ts:134-136`). Isso é semanticamente incorreto: nada falhou. O documento
foi lido com sucesso e a resposta para "tem mais de 18 anos?" é simplesmente **não**. Além disso, o
menor fica impedido de obter credencial por esse caminho, mesmo sendo uma pessoa real — o que
deveria lhe render `personhood: true` normalmente.

### 1.3 Problema derivado (bloqueante)

A verificação da apresentação **nunca confere se a claim apresentada corresponde à pergunta feita**.
A Regra 5 (`verify_presentation_usecase.ts:228-236`) valida apenas que as claims são booleanas. O
use case carrega o `proofRequestId` da sessão, mas o utiliza somente para `updateStatus` — jamais
busca a `proof_request` para comparar seu `proof_type` com o conteúdo da credencial.

> ⚠️ **Este item deixa de ser cosmético e passa a ser bloqueante com a mudança proposta.**
> Hoje o efeito é limitado porque quase toda credencial carrega `personhood`. Após a consolidação,
> **toda** credencial carregará `ageOver18` — inclusive com valor `false`. Sem a correção da Regra 5,
> a credencial de um menor de idade **aprovaria** uma `proof_request` de `age_over_18`, porque
> `false` é um booleano válido e nenhuma outra regra examina o conteúdo da claim.
>
> Ou seja: implementar apenas os itens 1.1 e 1.2 **introduz** uma falha de correção que hoje não
> existe. Os três itens são um pacote indivisível.

### 1.4 Achados adjacentes (menores)

| Achado | Evidência |
|---|---|
| Grafia divergente para o mesmo conceito | Emissão aceita `ageOver18` (camelCase, `issue_credential_usecase.ts:121`); proof request aceita `age_over_18` (snake_case, `create_proof_request_viewmodel.ts:5`). Não existe enum `ProofType` compartilhado — são literais soltos. |
| Erro enganoso para enum desconhecido | `proofType` inválido cai no `else` e retorna `422 "Document processing failed"` — reporta problema de documento para o que é erro de contrato. |
| Webhook não informa a pergunta respondida | `verify_presentation_usecase.ts:299` envia `proofType: "verification"` hardcoded. |

### 1.5 Origem da divergência

O código **está fiel ao épico**. O AC da Story 5.4 especifica literalmente
`claims: { personhood: true }` **ou** `{ ageOver18: true }`, e o AC da Story 5.5 lista como Regra 5
apenas *"Claims da VC são booleanos — sem PII"*.

A divergência é entre **épicos** (uma claim, sem checagem de correspondência) e **PRD + CONTEXT.md**
(*"VC carrega claims booleanos derivados: `personhood: true`, `ageOver18: true`"*). O erro está na
camada de especificação, não na execução — o que significa que corrigir apenas o código deixaria os
épicos como fonte de verdade errada para futuras stories.

---

## 2. Análise de Impacto

### 2.1 Impacto em Épicos

| Épico | Status atual | Impacto |
|---|---|---|
| **Epic 5** — Emissão, Verificação e Gestão de Credenciais | in-progress (5.1–5.6 done) | **Alto.** Stories 5.4 e 5.5 entregues com AC incorreto. Recebe duas novas stories corretivas. |
| **Epic 9** — VC como VC-JWT | backlog | **Médio.** As stories 9.1/9.2 reescrevem o formato de serialização da VC e da verificação. Seus ACs precisam carregar a semântica consolidada, senão a correção é perdida quando o Epic 9 for implementado. |
| **Epic 6** — Webhooks | in-progress (6.1, 6.2 done) | **Baixo.** Apenas o `proofType` hardcoded no disparo. |
| Epics 1, 2, 3, 4, 7, 8 | — | **Nenhum.** |

**Sequenciamento:** não há necessidade de resequenciar épicos. O Epic 9 permanece após o Epic 5;
a dependência é de conteúdo (ACs), não de ordem.

### 2.2 Impacto em Stories

| Story | Situação | Ação |
|---|---|---|
| 5.4 — Emissão de VC | done | Mantida como registro histórico. AC recebe nota de superseção apontando para 5.7. |
| 5.5 — Verificação de VP | done | Mantida como registro histórico. AC recebe nota de superseção apontando para 5.8. |
| **5.7 — Consolidação de Claims na Emissão** | **nova** | Emite ambas as claims; remove o 422 para menor de idade. |
| **5.8 — Correspondência entre Claim e Proof Type** | **nova** | Regra 5 passa a exigir que a claim pedida exista e seja `true`. |
| 9.1 — Emissão da VC como VC-JWT | backlog | AC ajustado para refletir claims consolidadas. |
| 9.2 — Verificação da VC-JWT | backlog | AC ajustado para preservar a nova Regra 5. |

### 2.3 Conflitos em Artefatos

| Artefato | Conflito | Ajuste necessário |
|---|---|---|
| **PRD** | *"VC carrega claims booleanos derivados (`personhood: true`, `ageOver18: true`)"* — sugere que ambas são sempre `true`. | Explicitar que `ageOver18` pode ser `false` e que isso não é erro. Adicionar a regra de correspondência à lista de módulos prioritários para teste. |
| **CONTEXT.md** | Mesma formulação, na definição de **VC**. Definição de **Proof Request** não menciona correspondência. | Idem PRD. Registrar o vocabulário canônico (`age_over_18` na API, `ageOver18` na claim). |
| **epics.md** | Fonte primária do erro (ACs de 5.4 e 5.5). | Adicionar stories 5.7 e 5.8; anotar superseção em 5.4/5.5; ajustar ACs de 9.1/9.2. |
| **architecture.md** | Descreve `vc:{...claims booleanos}` sem especificar quais nem a regra de correspondência. | Nota na seção *Credenciais & Formato da VC*. |
| **UX Design Spec** | **Sem conflito.** Nenhuma tela expõe claims da VC — a abstração de SSI na interface se mantém. | Nenhum. |
| **PROJECT-OVERVIEW.md** (`docs/`) | Momento 2 afirma que a credencial "já carrega as duas respostas" — descreve o estado-alvo, não o atual. | Passa a ficar correto após a implementação. Nenhuma edição necessária se 5.7 for implementada. |
| **Coleção Postman E2E** (`docs/e2e-happy-path-postman.md` + coleção) | §4 envia `proofType` no body e assina `docImage + ':' + proofType`. | Atualizar body e pré-script conforme a decisão sobre `proofType` na emissão (ver §4.1.C). |

### 2.4 Impacto Técnico

**Contrato com o app mobile (codebase separada):** a mudança altera o payload de emissão e o
conteúdo da VC. Como o YaID Wallet ainda não existe, **não há quebra de cliente em produção** — mas
o contrato precisa ser fixado antes que o app comece a ser construído. Este é o momento de baixo
custo para fazê-lo.

**OCR:** sem impacto. O `processDocument` já é chamado antes da ramificação por `proofType`
(`issue_credential_usecase.ts:112`) e o provider real já lança exceção se não encontrar data de
nascimento (`ApiOcrProvider.ts:73`). Ou seja, **toda emissão já exige hoje um documento com data de
nascimento legível** — a consolidação não eleva o requisito de OCR.

**Banco de dados:** nenhuma migration. As claims vivem na VC (no aparelho do holder), nunca em
tabela. O princípio de privacidade permanece intacto.

**Blockchain:** nenhum impacto. O registro on-chain continua sendo `keccak256(did)` e
`keccak256(vc_id)` — não há relação com o conteúdo das claims.

---

## 3. Caminho Recomendado

### 3.1 Opções avaliadas

| Opção | Viabilidade | Avaliação |
|---|---|---|
| **1 — Ajuste Direto** (novas stories no Epic 5 + ajuste de ACs) | ✅ Viável | Esforço **baixo**, risco **baixo**. Epic 5 ainda está `in-progress`; a mudança é localizada em dois use cases e não toca schema, blockchain nem UI. |
| **2 — Rollback** das stories 5.4/5.5 | ❌ Não viável | Não simplifica nada. A estrutura de emissão/verificação está correta; apenas a semântica das claims está errada. Reverter descartaria trabalho válido (auth por DID, assinatura, integração on-chain) para reescrever o mesmo. |
| **3 — Revisão do MVP** | ❌ Não necessária | O MVP não é afetado. A definição de pronto do MVP não muda; ela fica **mais** alcançável, já que o holder passa a precisar de uma emissão em vez de duas. |

### 3.2 Recomendação: Opção 1 — Ajuste Direto

**Justificativa:**

- **Custo baixo, valor alto.** Duas stories pequenas, sem migration, sem mudança de infraestrutura,
  corrigindo uma contradição com a promessa central do produto.
- **Momento certo.** O app mobile ainda não existe. Fixar o contrato agora custa uma atualização da
  coleção Postman; fixar depois custaria uma renegociação entre duas codebases.
- **Corrige a fonte, não o sintoma.** Ajustar os ACs dos épicos impede que a semântica errada seja
  reintroduzida pelo Epic 9.
- **Fecha uma falha de correção** que a própria mudança criaria se implementada pela metade.

**Impacto em cronograma:** nulo. As stories entram no Epic 5, que já está em andamento, e não
bloqueiam o Epic 7 (em execução) nem o Epic 8.

---

## 4. Propostas Detalhadas de Mudança

### 4.1 Stories novas

#### Story 5.7: Consolidação de Claims na Emissão de Credencial

**Épico:** Epic 5 — Emissão, Verificação e Gestão de Credenciais
**Supersede:** parte da Story 5.4

> Como holder com app mobile,
> Quero que minha credencial responda às duas perguntas em uma única emissão,
> Para que eu não precise enviar meu documento mais de uma vez.

**Acceptance Criteria:**

**Given** uma chamada `POST /api/credentials/issue` autenticada por DID
**When** a emissão é processada com sucesso
**Then** a VC é construída com **ambas** as claims: `{ personhood: true, ageOver18: <boolean> }`
**And** `personhood` é sempre `true` — a leitura bem-sucedida do documento é a própria evidência
**And** `ageOver18` é `true` ou `false`, derivado da data de nascimento lida no documento
**And** ambas permanecem estritamente booleanas — nenhuma PII entra na VC

**Given** um holder cuja data de nascimento indica **menos de 18 anos**
**When** a emissão é processada
**Then** a emissão **conclui com sucesso** (HTTP 201)
**And** a VC carrega `{ personhood: true, ageOver18: false }`
**And** **não** é retornado HTTP 422 — não houve falha de processamento

**Given** um documento cujo OCR falha (ilegível, ou sem nome/CPF/data de nascimento)
**When** o processamento é executado
**Then** retorna HTTP 422 com `{ error: "Document processing failed" }`
**And** este é o **único** caminho que produz 422 relacionado ao documento

**Given** uma data de nascimento presente mas não parseável para data válida
**When** o cálculo de idade é executado
**Then** retorna HTTP 422 — não é honesto afirmar `ageOver18: false` quando a idade é desconhecida

**Given** o fluxo existente de emissão (Story 5.4)
**When** esta story é aplicada
**Then** a validação da assinatura do body, o OCR em memória, o descarte de PII e o
`registerDID` on-chain permanecem inalterados

---

**C. Decisão — parâmetro `proofType` na emissão** ✅ **RESOLVIDO (2026-07-28): Opção C1 — remover**

Com as claims consolidadas, o `proofType` deixa de ter função na emissão (não seleciona mais nada).
Decisão tomada: **remover o parâmetro**.

| | **C1 — Remover** ✅ escolhida | C2 — Manter e ignorar |
|---|---|---|
| Body | `{ documentImage, bodySignature }` | `{ documentImage, proofType, bodySignature }` |
| Payload assinado | `documentImage` | `${documentImage}:${proofType}` (inalterado) |
| Coleção Postman | Requer atualização do §4 | Nenhuma alteração |
| Clareza do contrato | Alta — sem campo inerte | Baixa — campo aceito mas sem efeito |

**Rationale:** um parâmetro que não afeta o resultado é uma armadilha para quem for construir o app
mobile. O custo é editar um pré-script da coleção Postman, enquanto o app ainda não existe.

**AC decorrente desta decisão:**

**Given** uma chamada `POST /api/credentials/issue`
**When** o contrato de entrada é validado
**Then** o body aceita `{ documentImage, bodySignature }` — o campo `proofType` não é mais aceito
**And** o payload assinado pelo holder passa a ser apenas `documentImage`
**And** a validação da assinatura ocorre antes de qualquer outra operação, como na Story 5.4

---

#### Story 5.8: Correspondência entre Claim Apresentada e Proof Type Solicitado

**Épico:** Epic 5 — Emissão, Verificação e Gestão de Credenciais
**Supersede:** Regra 5 da Story 5.5
**Dependência:** deve ser entregue **junto com** a Story 5.7 — nunca depois

> Como empresa parceira,
> Quero que uma aprovação signifique que a pergunta que eu fiz foi respondida afirmativamente,
> Para que eu não libere acesso com base numa credencial que responde outra coisa.

**Acceptance Criteria:**

**Given** uma `POST /api/presentations/verify` cuja sessão pertence a uma `proof_request`
**When** o `verify_presentation_usecase` executa
**Then** a `proof_request` associada é carregada e seu `proof_type` é lido
**And** o `proof_type` é mapeado para a chave de claim correspondente
**And** a Regra 5 passa a exigir: a claim mapeada **existe na VC** e seu valor é **exatamente `true`**

**Given** uma `proof_request` de `age_over_18` e uma VC com `ageOver18: false`
**When** a verificação executa
**Then** retorna `{ valid: false }` e a `proof_request` transiciona para `rejected`

**Given** uma `proof_request` de `age_over_18` e uma VC sem a chave `ageOver18`
**When** a verificação executa
**Then** retorna `{ valid: false }` — ausência da claim nunca é tratada como aprovação

**Given** uma `proof_request` de `personhood` e uma VC com `personhood: true, ageOver18: false`
**When** a verificação executa
**Then** retorna `{ valid: true }` — a claim não solicitada é irrelevante para o resultado

**Given** a validação original de que todas as claims são booleanas
**When** esta story é aplicada
**Then** ela é **preservada** — a correspondência é uma exigência adicional, não substituta

**Given** as demais regras da Story 5.5 (1–4 e 6–11)
**When** esta story é aplicada
**Then** todas permanecem em vigor e na mesma ordem

**Given** o disparo de webhook após a transição de status
**When** o webhook é montado
**Then** o campo `proofType` carrega o `proof_type` real da `proof_request`, substituindo o valor
hardcoded `"verification"`

---

### 4.2 Vocabulário canônico

Fixar em CONTEXT.md, eliminando a ambiguidade atual:

| Contexto | Forma canônica | Justificativa |
|---|---|---|
| `proof_type` na API e no banco | `personhood` \| `age_over_18` | Já é o valor persistido e o enum do PRD. Mudar exigiria migration sem ganho. |
| Chave de claim dentro da VC | `personhood` \| `ageOver18` | camelCase é a convenção do JSON da VC e já é o formato previsto no payload do Epic 9. |

O mapeamento entre as duas formas deve existir em **um único lugar** no código, consumido tanto pela
emissão quanto pela verificação. Recomenda-se criar o enum `ProofType` em
`src/shared/domain/enums/ProofType.ts` — hoje inexistente, apesar de referenciado na estrutura de
diretórios do `architecture.md`.

Adicionalmente: `proofType` desconhecido deve retornar **400** (erro de contrato), não 422
(falha de documento).

### 4.3 Edições em artefatos de planejamento

| Arquivo | Seção | Mudança |
|---|---|---|
| `epics.md` | Epic 5 | Inserir stories 5.7 e 5.8 após 5.6 |
| `epics.md` | Story 5.4 | Nota: *"AC de claims superado pela Story 5.7 (Sprint Change 2026-07-28)"* |
| `epics.md` | Story 5.5 | Nota: *"Regra 5 superada pela Story 5.8 (Sprint Change 2026-07-28)"* |
| `epics.md` | Story 9.1 | AC de claims: `{ personhood: true, ageOver18: <boolean> }` |
| `epics.md` | Story 9.2 | Preservar explicitamente a regra de correspondência da 5.8 |
| `prd.md` | Domínio e modelo de dados | `ageOver18` pode ser `false`; menor de idade não é erro |
| `prd.md` | Testing Decisions | Adicionar a correspondência claim ↔ proof_type aos módulos prioritários |
| `CONTEXT.md` | Glossário → VC | Ambas as claims; `ageOver18` pode ser `false` |
| `CONTEXT.md` | Glossário → Proof Request | Aprovação exige a claim correspondente `true` |
| `CONTEXT.md` | Glossário | Registrar o vocabulário canônico da §4.2 |
| `architecture.md` | Credenciais & Formato da VC | Claims consolidadas + regra de correspondência |
| `docs/e2e-happy-path-postman.md` | §4 e §6 | Ajustar body/pré-script conforme decisão C1/C2 |

---

## 5. Impacto no MVP e Plano de Ação

### 5.1 O MVP é afetado?

**Não negativamente.** A definição de pronto do MVP não muda em nenhum critério. O fluxo demo fica
mais curto: o holder faz **uma** emissão em vez de duas para exercitar ambos os tipos de prova.

Ganho colateral para a defesa acadêmica: a plataforma passa a demonstrar que uma aprovação
corresponde à pergunta efetivamente formulada — hoje, uma banca que examinasse o
`verify_presentation_usecase` encontraria uma aprovação que não verifica o que foi pedido.

### 5.2 Sequenciamento

```
1. Story 5.7 — Consolidação de claims na emissão
2. Story 5.8 — Correspondência claim ↔ proof_type na verificação   ← mesma entrega que 5.7
3. Atualização da coleção Postman + docs/e2e-happy-path-postman.md
4. Ajuste dos ACs de 9.1 / 9.2 (antes do Epic 9 entrar em execução)
```

> **Restrição de entrega:** as stories 5.7 e 5.8 **não podem ser liberadas separadamente**.
> Ver §1.3 — 5.7 sem 5.8 faz a credencial de um menor de idade aprovar um pedido de `age_over_18`.

### 5.3 Dependências externas

**Codebase YaID Wallet:** o formato da VC e o payload de emissão são contrato entre backend e app.
Como o app ainda não foi iniciado, o contrato deve ser **registrado agora** para servir de base à
sua construção. Nenhuma coordenação de release é necessária.

---

## 6. Handoff

**Classificação:** Moderado — reorganização de backlog + implementação.

**Aprovação:** concedida por Victordegasperi em 2026-07-28, no escopo **replanejamento apenas** —
edições em artefatos de planejamento e registro das stories no backlog. A implementação de código
fica para uma sessão separada.

| Papel | Responsabilidade | Situação |
|---|---|---|
| **Product Owner / Dev** | Aplicar as edições da §4.3 em `epics.md`, `prd.md`, `CONTEXT.md` e `architecture.md`. Atualizar `sprint-status.yaml` com as stories 5.7 e 5.8 em `backlog`. | ✅ Concluído em 2026-07-28 |
| **Developer** | Implementar 5.7 e 5.8 em uma entrega única. Criar o enum `ProofType` compartilhado. Atualizar a coleção Postman e o guia E2E. | ⏳ Pendente — sessão futura |
| **Decisão do usuário** | `proofType` na emissão — C1 ou C2 (§4.1.C). | ✅ Resolvido: **C1 — remover** |

**Nota sobre o guia E2E (`docs/e2e-happy-path-postman.md`):** deliberadamente **não** atualizado
neste replanejamento. O guia descreve como exercitar o código **como ele está hoje**; antecipar a
edição o tornaria inválido para quem rodar o fluxo antes da implementação. A atualização pertence à
entrega das stories 5.7/5.8.

### Critérios de sucesso

- [ ] Uma emissão produz VC com `personhood` e `ageOver18` presentes
- [ ] Holder menor de 18 recebe 201 com `ageOver18: false`, nunca 422
- [ ] `proof_request` de `age_over_18` com VC `ageOver18: false` resulta em `valid: false`
- [ ] `proof_request` de `personhood` com VC `ageOver18: false` resulta em `valid: true`
- [ ] Webhook carrega o `proof_type` real da `proof_request`
- [ ] `proofType` desconhecido na emissão retorna 400, não 422
- [ ] Épicos, PRD, CONTEXT.md e architecture.md refletem a semântica consolidada
- [ ] Coleção Postman executa o happy path ponta a ponta sem ajustes manuais

---

## 7. Adendo — Higiene de Configuração e Chaves

> Incorporado ao mesmo Correct Course em 2026-07-28, a partir do TODO deixado em
> `issue_credential_usecase.ts:147-148`. Concern distinto do §1–§6; agrupado aqui por ter sido
> levantado e aprovado na mesma sessão.

### 7.1 Causa raiz

`TEST_ENV` (`environments.ts:64-76`) atribui **strings-placeholder não-hexadecimais** a variáveis
que o código consome como chaves hex de 32 bytes:

```ts
ISSUER_PRIVATE_KEY: "test-issuer-private-key",
WEBHOOK_SIGNING_PRIVATE_KEY: "test-webhook-signing-private-key",
BLOCKCHAIN_WALLET_PRIVATE_KEY: "test-blockchain-wallet-private-key",
```

Como esses valores não podem ser usados diretamente por `hexToBytes`, **cada consumidor remenda o
valor no ponto de uso**. É exatamente o vazamento apontado no TODO: `environments.ts` deixa de ser
a fonte única de configuração e a responsabilidade escorre para os use cases.

### 7.2 Mapeamento completo dos pontos de substituição

Busca exaustiva por `process.env` fora de `environments.ts` (**nenhuma ocorrência** — esta regra
está sendo respeitada) e por literais de placeholder em `src/`:

| # | Arquivo | Linha | Placeholder → valor real | Guard fora de TEST? |
|---|---|---|---|---|
| 1 | `src/modules/credential/app/issue_credential_usecase.ts` | 148-151 | `test-issuer-private-key` → `…0001` | ❌ Não |
| 2 | `src/modules/presentation/app/verify_presentation_usecase.ts` | 183-186 | `test-issuer-private-key` → `…0001` | ❌ Não |
| 3 | `src/shared/infra/providers/Ed25519WebhookSigner.ts` | 20-30 | `test-webhook-signing-private-key` → `…0002` | ❌ Não |
| 4 | `src/modules/webhook/app/get_webhook_public_key_usecase.ts` | 4-6, 34-40 | `test-webhook-signing-private-key` → `…0002` | ✅ **Sim** |

**Boa notícia:** os pares derivam a mesma chave (`…0001` para issuer nos dois lados, `…0002` para
webhook nos dois lados). **Não há bug de comportamento hoje** — assinatura e verificação concordam.
O problema é estrutural e de risco, não de correção atual.

### 7.3 Defeitos identificados

**Defeito A — Substituição duplicada em 4 lugares, sem constante compartilhada.**
Cada site redeclara o par placeholder/valor. Um quinto consumidor de chave que esqueça a
substituição falha em runtime; um que use valor diferente quebra a verificação silenciosamente.

**Defeito B — Guard inconsistente.**
Somente o site #4 recusa o placeholder fora do stage `TEST`. Os outros três aceitam
silenciosamente: bastaria alguém escrever `ISSUER_PRIVATE_KEY=test-issuer-private-key` num `.env`
para o backend assinar VCs com `…0001` em `DOTENV`, `DEV`, `HOMOLOG` ou `PROD`.

**Defeito C — O schema não valida o formato das chaves (mais grave).**
`envSchema` declara `ISSUER_PRIVATE_KEY: z.string().min(1).optional()`, e o `superRefine` apenas
verifica **presença** em `PROD`/`HOMOLOG`. Consequências:

- Uma chave com placeholder, typo ou tamanho errado **passa na validação de boot em produção**.
- No caso do placeholder, o sistema passaria a assinar VCs com uma chave privada **publicamente
  conhecida** — o valor `…0001` está neste repositório e no histórico do Git. Qualquer pessoa
  poderia forjar credenciais que o `verify_presentation_usecase` aceitaria como legítimas.
- No caso de um typo, a falha só aparece **na primeira requisição que usa a chave**, contrariando a
  decisão da arquitetura de que as chaves são *"obrigatórias no boot"* em `PROD`/`HOMOLOG`.

Existe precedente do comportamento correto na própria codebase: `EthersBlockchainClient` valida
`ethers.isAddress(contractAddress)` no construtor justamente *"para gerar erro acionável no boot,
não em tempo de requisição"*.

### 7.4 Impacto em testes (obrigatório no escopo)

Dois testes fazem asserção **estrutural sobre o código-fonte** e vão falhar quando as
substituições forem removidas:

| Teste | Linha | Asserção |
|---|---|---|
| `tests/unit/story-6-1/webhook-delivery.test.mjs` | 85 | `assert.match(src, /test-webhook-signing-private-key/)` |
| `tests/unit/story-6-2/webhook-public-key.test.mjs` | 119 | `assert.match(src, /test-webhook-signing-private-key/)` |

Ambos precisam ser reescritos para afirmar o **comportamento novo** (a chave vem pronta do
`environments.ts`) em vez da presença do remendo. As asserções sobre o valor derivado `…0002`
(`story-6-2` linhas 43, 91, 162) **continuam válidas** — ver §7.5.

### 7.5 Correção proposta (preserva comportamento)

`TEST_ENV` passa a carregar **os próprios valores hex** que hoje resultam da substituição:

```ts
ISSUER_PRIVATE_KEY: "0000…0001",   // era "test-issuer-private-key"
WEBHOOK_SIGNING_PRIVATE_KEY: "0000…0002",
```

Como as chaves derivadas são idênticas às atuais, **nenhuma assinatura muda** e os testes que
verificam valores derivados seguem passando. As quatro substituições são então deletadas.

### 7.6 Estrutura: Epic 10

O trabalho atravessa `shared` (`environments.ts`), Epic 5 (credential, presentation) e Epic 6
(webhook) — não cabe dentro de um épico existente. Segue o precedente do Sprint Change 2026-07-27,
que criou épicos novos para mudanças transversais.

| Story | Escopo |
|---|---|
| **10.1** — Centralização de Chaves de Teste no `environments.ts` | Defeitos A e B. `TEST_ENV` com hex válido; remoção das 4 substituições; ajuste dos 2 testes estruturais. |
| **10.2** — Validação de Formato de Chaves no Boot | Defeito C. Schema valida hex de 64 caracteres; placeholders de TEST recusados fora do stage `TEST`. |

**Ordem:** 10.1 antes de 10.2 — validar formato no schema enquanto `TEST_ENV` ainda carrega
placeholders não-hex quebraria o stage `TEST` inteiro.

**Independência:** este adendo não tem relação de dependência com as Stories 5.7/5.8. Podem ser
executados em qualquer ordem ou em paralelo.

---

## Apêndice — Checklist de Navegação de Mudança

| Seção | Item | Status |
|---|---|---|
| 1. Gatilho e contexto | 1.1 Story gatilho identificada (5.4 / 5.5) | [x] |
| | 1.2 Problema categorizado — *mal-entendido de requisito original* | [x] |
| | 1.3 Evidências coletadas (código + ACs + PRD) | [x] |
| 2. Impacto em épicos | 2.1 Epic 5 completável com ajuste | [x] |
| | 2.2 Mudanças de épico definidas (2 stories novas) | [x] |
| | 2.3 Épicos futuros revisados (Epic 9 impactado) | [x] |
| | 2.4 Nenhum épico invalidado; nenhum épico novo | [x] |
| | 2.5 Ordem e prioridade preservadas | [N/A] |
| 3. Conflitos em artefatos | 3.1 PRD — ajuste aplicado | [x] |
| | 3.2 Architecture — nota na seção de credenciais aplicada | [x] |
| | 3.3 UX Spec — sem conflito | [N/A] |
| | 3.4 Outros — CONTEXT.md aplicado; Postman/guia E2E diferidos para a implementação | [!] |
| 4. Caminho | 4.1 Ajuste Direto | [x] Viável |
| | 4.2 Rollback | [ ] Não viável |
| | 4.3 Revisão de MVP | [ ] Não viável |
| | 4.4 Selecionado: **Opção 1** | [x] |
| 5. Componentes da proposta | 5.1–5.5 | [x] |
| 6. Revisão final | 6.1 Checklist revisado | [x] |
| | 6.2 Proposta verificada | [x] |
| | 6.3 Aprovação do usuário | [x] Concedida — escopo replanejamento |
| | 6.4 `sprint-status.yaml` atualizado (5-7, 5-8, 10-1, 10-2 em `backlog`) | [x] |
| | 6.5 Handoff confirmado | [x] Implementação diferida para sessão futura |
| 7. Adendo (config/chaves) | 7.1 Causa raiz identificada (`TEST_ENV` com placeholder não-hex) | [x] |
| | 7.2 Mapeamento exaustivo — 4 pontos; `process.env` fora de `environments.ts`: nenhum | [x] |
| | 7.3 Três defeitos caracterizados (A: duplicação, B: guard inconsistente, C: schema sem formato) | [x] |
| | 7.4 Impacto em testes levantado (2 asserções estruturais a reescrever) | [!] Escopo da Story 10.1 |
| | 7.5 Correção preservadora de comportamento validada | [x] |
| | 7.6 Epic 10 criado com stories 10.1 e 10.2 | [x] |
