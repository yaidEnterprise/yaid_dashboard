# Story 5.9: OCR estruturado via Mistral Document AI

Status: done

> Origem: Sprint Change Proposal 2026-08-19
> (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-19.md`).
> Resolve o TBD de provider de OCR registrado em `prd.md`, `epics.md` e `architecture.md` desde a
> Story 5.4. **Não** é rollback nem revisão de escopo — é a "Opção 1 — Direct Adjustment" do próprio
> Sprint Change: troca a implementação concreta de `OcrProvider` sem tocar a interface de domínio, o
> use case, a rota ou o contrato público de `POST /api/credentials/issue`.

## Story

Como YaID (issuer),
Quero extrair nome, CPF e data de nascimento de documentos brasileiros via extração estruturada
(Mistral Document AI) em vez de regex sobre texto livre,
Para que a emissão de credenciais não dependa de heurísticas frágeis de parsing e a claim
`ageOver18` nunca seja calculada a partir de uma data errada capturada por um fallback perigoso.

## Acceptance Criteria

1. **Given** `MISTRAL_API_KEY` configurada e uma imagem legível de documento brasileiro
   **When** `POST /api/credentials/issue` é chamado
   **Then** nome, CPF e data de nascimento vêm de `document_annotation` da Mistral e a VC é emitida
   com 201 — **sem nenhum regex de extração no caminho**.
2. **Given** o documento não contém nome, CPF ou data de nascimento legíveis
   **Then** retorna **422** `{ error: "Document processing failed" }` sem persistir nada.
3. **Given** a saída da Mistral com CPF fora de 11 dígitos, `birthDate` fora de `YYYY-MM-DD`, data
   inexistente/futura, ou qualquer campo `null`
   **Then** a validação rejeita e retorna **422** — a saída do modelo nunca é aceita sem validação.
4. **Given** qualquer caminho de execução, inclusive falha
   **Then** a imagem e os campos extraídos não aparecem em log nem em banco (NFR7) — o modo debug do
   SDK permanece desligado.
5. **Given** `MISTRAL_API_KEY` ausente e `STAGE` = `PROD` ou `HOMOLOG`
   **Then** o boot falha na validação do schema — **não existe fallback para mock**.
6. **Given** `STAGE` = `DOTENV`, `DEV`, `HOMOLOG` ou `PROD`
   **Then** `getOcrProvider()` devolve **sempre** `MistralOcrProvider`; com a chave ausente, **lança**
   — nunca devolve `MockOcrProvider`.
   **And Given** `STAGE` = `TEST`
   **Then** devolve `MockOcrProvider` sem ler `MISTRAL_API_KEY`.
   *(Guard automatizado obrigatório — a garantia agora depende de uma condição de `STAGE`.)*
7. **Given** o código do projeto
   **Then** `@mistralai/mistralai` é importado **apenas** por
   `src/shared/clients/ocr/MistralOcrProvider.ts`; use case, controller e presenter continuam
   dependendo só da interface `OcrProvider`.
8. `src/shared/clients/ocr/ApiOcrProvider.ts` **não existe mais** e nenhum símbolo dele é importado.
   `MockOcrProvider.ts` permanece, referenciado **exclusivamente** pelo ramo `STAGE=TEST` de
   `getOcrProvider()`.
9. `.env.local.example`, `amplify.yml`, `docs/deployment/production-cicd.md`,
   `docs/e2e-happy-path-postman.md` e os testes de `story-11-8` refletem os **12 nomes canônicos**
   (sem `OCR_API_URL`/`OCR_API_KEY`, com `MISTRAL_API_KEY`).
10. **Pré-requisito de deploy (ação operacional, fora do escopo de código):** o Secret
    `MISTRAL_API_KEY` deve estar cadastrado no GitHub antes do primeiro deploy pós-merge — registrar
    isso nos Dev Notes/Change Log, não é algo que o código possa garantir.
11. `npm run test` passa integralmente.

## Tasks / Subtasks

- [x] Task 1: Criar `MistralOcrProvider` (AC: #1, #3, #4, #7)
  - [x] Criar `src/shared/clients/ocr/MistralOcrProvider.ts` implementando `OcrProvider`
    (`processDocument(base64Image: string): Promise<OcrResult>`), importando `Mistral` de
    `@mistralai/mistralai` — **único arquivo do projeto autorizado a importar esse SDK**.
  - [x] Constante `MISTRAL_OCR_MODEL = "mistral-ocr-latest"` no topo do arquivo (endpoint/modelo são
    constantes no client, não env vars — ver Dev Notes).
  - [x] Montar `documentAnnotationFormat` como `ResponseFormat` do SDK:
    `{ type: "json_schema", jsonSchema: { name: "brazilian_id_document", strict: true,
    schemaDefinition: { type: "object", properties: { name, cpf, birthDate }, required: ["name",
    "cpf", "birthDate"], additionalProperties: false } } }`. **Usar exatamente `jsonSchema` e
    `schemaDefinition`** (camelCase) — são os nomes confirmados do SDK, não `json_schema`/`schema`
    (ver Dev Notes → "Nomes de campo confirmados no SDK").
  - [x] Chamar `this.client.ocr.process({ model, document: { type: "image_url", imageUrl:
    toDataUri(base64Image) }, documentAnnotationFormat, includeImageBase64: false })`.
  - [x] Implementar `toDataUri(base64Image)`: detectar o MIME por magic bytes do buffer decodificado
    (PNG `89 50 4E 47`, JPEG `FF D8 FF`; default `image/png` se nenhum casar) e retornar
    `data:<mime>;base64,<base64Image>`. A API espera uma data URI completa — a entrada do use case é
    base64 puro (mesmo contrato de hoje, `IssueCredentialInput.documentImage`).
  - [x] Implementar `parseAnnotation(response.documentAnnotation)`: **sempre `JSON.parse`** — o campo
    é tipado como `string | null | undefined` no SDK (nunca objeto; ver Dev Notes). Se `null`/
    `undefined`/parse falhar, tratar como resultado inválido (cai no fluxo de validação → lança).
  - [x] Implementar `validateOcrResult(annotation)`:
    - `name`: `string`, `.trim().length >= 3`; senão inválido.
    - `cpf`: normalizar com `replace(/\D/g, "")`; deve resultar em exatamente 11 dígitos; senão
      inválido.
    - `birthDate`: casar `^\d{4}-\d{2}-\d{2}$` **e** ser uma data real e não futura (reaproveitar o
      mesmo padrão de validação de data que hoje existe no use case — `new Date(...)` +
      `isNaN(.getTime())` — mas aplicado aqui, na fronteira do client, não no use case).
    - Qualquer campo `null`/ausente/inválido → `throw new Error("Document processing failed")` (o use
      case já mapeia qualquer exceção do provider para 422 — não mudar esse mapeamento).
  - [x] **Nada de log.** Nenhum `console.*`/logger em nenhum caminho, inclusive `catch`. Não habilitar
    modo debug do SDK (se existir opção, deixar desligada/omitida).
  - [x] Timeout explícito na chamada (via opção do SDK, se existir, ou `AbortSignal` passado à
    chamada) — a implementação atual (`ApiOcrProvider`) não tinha timeout nenhum; esta é uma correção
    both, não uma nova AC formal, mas o Sprint Change pede explicitamente.

- [x] Task 2: Remover `ApiOcrProvider` (AC: #8)
  - [x] Deletar `src/shared/clients/ocr/ApiOcrProvider.ts` por completo (client + `parseDocumentText`
    + `isValidDate`, ~148 linhas).
  - [x] Confirmar que nenhum outro arquivo importa `ApiOcrProvider` além de
    `src/shared/environments.ts` (único import existente, tratado na Task 3). Não há testes que
    importem a classe por nome (`tests/unit/story-5-4/credential-issuance.test.mjs` só referencia
    `OcrProvider` e `MockOcrProvider` — confirmado por leitura completa do arquivo).

- [x] Task 3: Atualizar `src/shared/environments.ts` (AC: #5, #6, #9)
  - [x] Em `productionRequiredEnvNames`, adicionar `"MISTRAL_API_KEY"` à lista (linha ~18-23) — mesmo
    padrão de `ISSUER_PRIVATE_KEY`.
  - [x] No `envSchema`, remover `OCR_API_URL: z.string().url().optional()` e
    `OCR_API_KEY: z.string().min(1).optional()` (linhas 39-40); adicionar
    `MISTRAL_API_KEY: z.string().min(1).optional()`.
  - [x] Em `readProcessEnv()`, remover as linhas `OCR_API_URL: process.env.OCR_API_URL` e
    `OCR_API_KEY: process.env.OCR_API_KEY` (linhas 94-95); adicionar
    `MISTRAL_API_KEY: process.env.MISTRAL_API_KEY`.
  - [x] Remover os getters `OCR_API_URL` e `OCR_API_KEY` (linhas 184-190); adicionar getter
    `MISTRAL_API_KEY` usando `requireConfiguredValue` — mesmo padrão de `ISSUER_PRIVATE_KEY`
    (linhas 152-157):
    ```ts
    get MISTRAL_API_KEY() {
      return requireConfiguredValue(this.values.MISTRAL_API_KEY, "MISTRAL_API_KEY");
    }
    ```
  - [x] Reescrever `getOcrProvider()` (linhas 265-280) para o padrão de `getBlockchainClient()`
    (ramifica por `this.stage === Stage.TEST`, linhas 251-263) — **sem fallback silencioso por
    ausência de configuração**:
    ```ts
    async getOcrProvider(): Promise<OcrProvider> {
      if (this.stage === Stage.TEST) {
        const { MockOcrProvider } = await import("@/shared/clients/ocr/MockOcrProvider");
        return new MockOcrProvider();
      }

      const { MistralOcrProvider } = await import("@/shared/clients/ocr/MistralOcrProvider");
      return new MistralOcrProvider(this.MISTRAL_API_KEY);
    }
    ```
  - [x] `TEST_ENV` (linhas 60-71) não precisa de `MISTRAL_API_KEY` — o ramo `TEST` de
    `getOcrProvider()` nunca lê essa chave (mock retornado antes do getter ser chamado).
  - [x] Confirmar matriz final: `TEST` → mock, chave nunca lida; `DOTENV`/`DEV` → `MistralOcrProvider`,
    chave ausente faz o getter lançar na primeira emissão; `HOMOLOG`/`PROD` → chave ausente derruba o
    boot via `superRefine` (mesmo mecanismo que já existe para `ISSUER_PRIVATE_KEY` etc.).

- [x] Task 4: Instalar dependência (AC: #7)
  - [x] `npm install @mistralai/mistralai` — versão publicada mais recente no momento do planejamento
    é `2.6.3`. **Convenção confirmada do projeto:** todas as dependências em `package.json` usam range
    caret (`^`) — `@noble/ed25519: "^3.1.0"`, `@supabase/supabase-js: "^2.105.3"`, `zod: "^4.4.3"` etc.
    Não fixar versão exata; deixar o `npm install` padrão gravar `^2.6.3` (ou a versão mais recente no
    momento), seguindo o mesmo padrão das demais deps.

- [x] Task 5: Atualizar CI/CD e `.env.local.example` (AC: #9)
  - [x] `.env.local.example`: **este arquivo já tem uma edição não commitada** no working tree atual
    (`git status` mostra `M .env.local.example`) que deixou o bloco em estado transitório — hoje tem
    **tanto** o bloco antigo `# OCR - NOT USING` com `OCR_API_URL`/`OCR_API_KEY` **quanto** um novo
    bloco `# MISTRAL` com `MISTRAL_API_KEY` (14 linhas úteis, não 12). Consolidar para o estado final
    único:
    ```diff
    -# OCR - NOT USING
    -OCR_API_URL=YOUR_OCR_API_URL
    -OCR_API_KEY=YOUR_OCR_API_KEY
    -
    -# MISTRAL
    +# OCR (Mistral Document AI — modelo e endpoint são constantes no client)
     MISTRAL_API_KEY=YOUR_MISTRAL_API_KEY
    ```
    Resultado: um único bloco, 12 nomes canônicos ao todo no arquivo.
  - [x] `amplify.yml:15` — no `grep -we` do passo de env, trocar `-we OCR_API_URL -we OCR_API_KEY`
    por `-we MISTRAL_API_KEY`.
  - [x] `tests/unit/story-11-8/env-var-sync-authoritative.test.mjs:86-104` — no teste "AC1:
    `.env.local.example` lista exatamente os 13 nomes canônicos", atualizar o array `expected`:
    remover `"OCR_API_URL"` e `"OCR_API_KEY"`, adicionar `"MISTRAL_API_KEY"` (13 → 12 nomes); ajustar
    o título do teste de "13" para "12".
  - [x] `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs:316-326` — a fixture usa
    `OCR_API_URL=` como exemplo de variável vazia que não deve entrar no payload; trocar por
    `MISTRAL_API_KEY=` (mudança mecânica, mesma semântica do guard — ver `grep` já confirmado nas
    linhas exatas durante o planejamento).
  - [x] `docs/deployment/production-cicd.md:361-372` — tabela de classificação: remover a linha
    `OCR_API_URL` da coluna **Variables** (era a 5ª de 5) e `OCR_API_KEY` da coluna **Secrets** (era a
    7ª de 7); adicionar `MISTRAL_API_KEY` como **Secret** (contém `KEY` → regra de colocação já
    documentada na linha 349-353 do próprio arquivo). Atualizar o texto acima da tabela: "12 nomes
    cadastráveis" permanece 12 (não muda a contagem total, só a composição); "Variables (5)" passa a
    "Variables (4)"; "Secrets (7)" permanece "Secrets (7)" (perde `OCR_API_KEY`, ganha
    `MISTRAL_API_KEY` — mesma contagem).

- [x] Task 6: Atualizar `docs/e2e-happy-path-postman.md` (AC: #9)
  - [x] Linha 80 (tabela de variáveis de coleção): trocar
    `*(OCR mock: deixe vazio · OCR real: cole o base64 da imagem — §4)*` por
    `*(obrigatório — cole o base64 puro da imagem do documento — §4)*` — não existe mais alternativa
    "deixe vazio".
  - [x] Linhas 188-193 (pre-request script do §4): remover o comentário de duas opções (mock vs.
    real) e o fallback `|| 'mock-doc-personhood'`; `docImage` passa a ser sempre lido da variável de
    coleção sem fallback mockado:
    ```js
    setDidAuth('POST', '/api/credentials/issue');
    // `docImage`: base64 puro (sem prefixo data:image/...;base64,) de uma imagem legível do documento
    var docImage = pm.collectionVariables.get('docImage');
    pm.collectionVariables.set('bodySignature', edSign(docImage));
    ```
  - [x] Linhas 212-214 (box "OCR — mock vs. real"): substituir pelo texto definido no Sprint Change
    §4.3:
    ```md
    > **OCR (obrigatório):** o fluxo de emissão exige `MISTRAL_API_KEY` configurada — **não existe
    > modo mockado em ambiente real**. O `MockOcrProvider` só é usado sob `STAGE=TEST` (suíte
    > automatizada), nunca em execução local/homol/prod. Sem a chave, a emissão falha ao ler o env (e
    > em PROD/HOMOLOG o app nem sobe).
    > O `docImage` deve ser **base64 puro** (sem prefixo `data:image/...;base64,`) de uma imagem
    > legível do documento. Gere com `base64 -i rg.png | tr -d '\n' | pbcopy`. Dica: reduza a imagem
    > (~1000px).
    > A extração é estruturada (Mistral Document AI) — um **422** agora significa que o modelo não
    > encontrou nome, CPF ou data de nascimento no documento, não que um regex falhou.
    ```
  - [x] Linha 320 (tabela de troubleshooting, linha "§4 responde 422"): trocar
    `OCR mock: docImage contém fail/invalid. OCR real: imagem ilegível ou sem NOME/CPF/nascimento no
    texto` / `Mock: use mock-doc-personhood. Real: use um base64 legível e teste sua API de OCR
    isolada antes (deve retornar { text: ... })` por algo como:
    `Imagem ilegível, ou o modelo não conseguiu extrair nome, CPF ou data de nascimento` /
    `Use um base64 legível de um documento real; confirme MISTRAL_API_KEY configurada`.

- [x] Task 7: Testes unitários novos — guard de seleção de provider (AC: #6)
  - [x] Criar `tests/unit/story-5-9/` seguindo o padrão estrutural do projeto (existência de arquivo +
    asserções estáticas via regex sobre o source + `tsc --noEmit` como último teste — ver
    `tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs` como referência direta de
    convenção mais recente).
  - [x] Cobrir estaticamente: `MistralOcrProvider.ts` existe, implementa `OcrProvider`, importa
    `Mistral` de `@mistralai/mistralai`; `ApiOcrProvider.ts` **não existe mais**
    (`assert.ok(!existsSync(...))`); `getOcrProvider()` em `environments.ts` ramifica por
    `this.stage === Stage.TEST` (regex sobre o source, mesmo padrão já usado para
    `getBlockchainClient()`); `MISTRAL_API_KEY` presente em `productionRequiredEnvNames`; nenhum outro
    arquivo de `src/` fora de `MistralOcrProvider.ts` contém a string `@mistralai/mistralai` (grep
    sobre `src/` inteiro, exceto o próprio arquivo).
  - [x] Se o padrão dinâmico (`*.dynamic.test.ts` via `tsx`, introduzido na Story 5.8 QA) já estiver
    disponível, considerar um teste dinâmico que instancia `Environments` com `STAGE` variando
    (`TEST`, `DOTENV` com/sem `MISTRAL_API_KEY` mockada via `process.env`) e verifica o tipo do
    provider retornado por `getOcrProvider()` — é a forma mais direta de provar a matriz de resolução
    do AC #6. Decisão de execução: **avaliar no momento da implementação** se compensa o custo (chama
    `import()` dinâmico real; não precisa de rede, só resolve o `require`/`import` para checar o tipo
    via `instanceof` ou nome de construtor) — não é bloqueante se o padrão estático já cobrir o AC de
    forma satisfatória.
  - [x] Atualizar/confirmar `tests/unit/story-5-4/credential-issuance.test.mjs`: **não precisa** de
    mudança de asserção de nome de classe (confirmado por leitura completa — o arquivo só testa
    `OcrProvider`/`MockOcrProvider`, nunca `ApiOcrProvider` por nome). Só rodar a suíte ao final para
    confirmar que segue verde.

- [x] Task 8: Resolver TBDs nos artefatos de planejamento (AC: nenhum formal — consistência
  documental pedida pelo próprio Sprint Change §4.4)
  - [x] `prd.md` — linha com o TBD de "Provider de OCR concreto": aplicar o diff do Sprint Change
    §4.4 (marcar como Resolvido, citar Mistral Document AI).
  - [x] `epics.md` — linha ~147 (Restrições técnicas do Epic 5, "Integração com OCR em memória —
    provider TBD") e linha ~1001 (nota `⚠️ TBD` da Story 5.4): aplicar os diffs correspondentes do
    Sprint Change §4.4.
  - [x] `architecture.md` — linha ~113 (Restrições e Dependências Técnicas, "OCR — Provider TBD"),
    linha ~173 ("OCR SDK — provider a definir") e linha ~755 (fluxo "Backend → OCR... TBD"): aplicar
    os três diffs do Sprint Change §4.4.
  - [x] **Nota:** os números de linha exatos podem ter deslocado desde a redação do Sprint Change
    (2026-08-19) — localizar pelo texto (`TBD`, `OCR`) em vez de confiar cegamente no número da linha.

- [x] Task 9: Rodar suíte completa e validar (AC: #11)
  - [x] `npm run test` (suíte completa) — deve passar integralmente, sem regressão nas stories 5.4,
    5.7, 5.8, 9.1, 9.2, 11.8 (todas tocam `environments.ts` ou o fluxo de emissão indiretamente).
  - [x] Rodar `npx eslint` nos arquivos novos/modificados antes de finalizar (convenção já seguida
    pelas stories anteriores — ver Story 5.8 Debug Log).

### Escopo explicitamente fora desta story

- **Refino 422 vs 502** (distinguir "documento ilegível" de "Mistral indisponível/timeout/chave
  inválida") — proposto no Sprint Change §4.5 como item **opcional**, com recomendação explícita do
  PO de **não incluir** aqui. Mudaria um AC da Story 5.4 e adicionaria um código de erro ao contrato
  público (`POST /api/credentials/issue`) — decisão de produto independente. Se relevante, registrar
  em `deferred-work.md` como candidato a story própria; **não implementar nesta story**.
- **Registro do processador de dados (Mistral) em material de privacidade** — o Sprint Change nota que
  não existe documento de privacidade dedicado no repositório hoje (busca confirmou: nenhum arquivo
  `*privac*` em `docs/`). Não criar um do zero só por causa desta story; se o usuário/PO tiver um canal
  externo (site, termos), é ação dele, não deste código.
- Qualquer mudança em `issue_credential_usecase.ts` além do que já existe — o use case **não muda**:
  continua chamando `this.ocrProvider.processDocument(documentImage)` dentro do mesmo `try/catch` que
  mapeia qualquer exceção para 422 (linhas 94-99). A validação estrutural entra inteiramente no
  `MistralOcrProvider`, não no use case.
- `cancel_proof_session_usecase.ts`, `verify_presentation_usecase.ts`, qualquer coisa de Epic 3/4/6-10
  — sem relação com OCR, não tocar.
- Migração de outras chaves de ambiente (Epic 10, `ISSUER_PRIVATE_KEY` etc.) — fora de escopo, mesma
  nota já usada pelas stories anteriores do Epic 5.

### Review Findings

**Patch (aplicados nesta sessão):**
- [x] [Review][Patch] `detectMimeType` cai silenciosamente em `image/png` para qualquer buffer que não
  bata PNG/JPEG (WEBP, HEIC, PDF, buffer corrompido/vazio) — a data URI é montada com um MIME falso e
  enviada à Mistral em vez de falhar rápido localmente [src/shared/clients/ocr/MistralOcrProvider.ts:39]
  — **Corrigido:** agora lança `"Document processing failed"` quando nenhuma assinatura conhecida
  bate, em vez de assumir PNG por padrão.
- [x] [Review][Patch] `isValidBirthDate` aceita datas de calendário inválidas por causa do
  auto-rollover do `Date` do JS (ex.: `"2023-02-29"` vira 1º de março silenciosamente em vez de ser
  rejeitado) [src/shared/clients/ocr/MistralOcrProvider.ts:56-65] — **Corrigido:** os componentes
  ano/mês/dia são extraídos do regex e comparados contra os campos UTC da `Date` resultante
  (`getUTCFullYear`/`getUTCMonth`/`getUTCDate`); qualquer divergência (rollover) rejeita a data.
- [x] [Review][Patch] `isValidBirthDate` não tem limite inferior de ano — `"0001-01-01"` passa na
  validação [src/shared/clients/ocr/MistralOcrProvider.ts:56-65] — **Corrigido:** nova constante
  `MIN_BIRTH_YEAR = 1900` rejeita anos abaixo desse piso.

**Defer (pré-existentes ou fora de escopo desta story):**
- [x] [Review][Defer] `validateOcrResult` valida CPF só por contagem de dígitos (11), sem dígito
  verificador — mesma limitação já existia no `ApiOcrProvider` removido; a story só pede validação de
  formato (AC #3), não checksum [src/shared/clients/ocr/MistralOcrProvider.ts:78-81] — deferred,
  pre-existing gap, not introduced by this diff
- [x] [Review][Defer] `Buffer.from(base64Image, "base64")` não valida que a entrada é base64 válido
  nem rejeita string vazia — produz um buffer de 0 bytes que ainda assim é enviado à API como uma data
  URI "bem formada", mas sem conteúdo. Não causa aprovação incorreta (a Mistral rejeita e o fluxo cai
  em 422 do mesmo jeito) — só adia a falha por uma chamada de rede
  [src/shared/clients/ocr/MistralOcrProvider.ts:41-45] — deferred, low severity, no correctness impact
- [x] [Review][Defer] Erros de rede/timeout/SDK (ex.: Mistral indisponível, timeout, chave inválida)
  não são distinguidos de "documento ilegível" — ambos colapsam no mesmo 422 genérico no use case. É
  exatamente o refino 422 vs 502 que o Sprint Change §4.5 marca como opcional e recomenda **não**
  incluir nesta story (ver "Escopo explicitamente fora desta story" acima)
  [src/shared/clients/ocr/MistralOcrProvider.ts:104-121] — deferred, already documented out-of-scope
  decision from the Sprint Change
- [x] [Review][Defer] Suíte de testes é 100% estática (existência de arquivo + regex sobre o source +
  `tsc --noEmit`); nenhum teste instancia `MistralOcrProvider` com o SDK mockado para exercitar
  `processDocument` em runtime. Padrão sistêmico em todas as stories do projeto desde a 5.4, já
  identificado e deferido nos code reviews anteriores (Story 5.8) como "pré-existente, não específico
  do diff" [tests/unit/story-5-9/mistral-ocr-provider-selection.test.mjs] — deferred, pre-existing,
  systemic

**Dismissed (4):** `getOcrProvider()` selecionar um único vendor sem fallback/circuit-breaker (é
exatamente o design deliberado do Sprint Change v3 — a v1 tinha fallback e foi removido de propósito
pelo PO; não é defeito, é a AC #6); `docs/deployment/production-cicd.md` não mostrar o passo de
provisionamento do Secret no GitHub (é a ação operacional do AC #10, explicitamente fora do escopo de
código, já documentada nos Dev Notes); `response.documentAnnotation` não-string não guardado antes do
`JSON.parse` (o Acceptance Auditor confirmou no source do SDK que o tipo é estritamente `string | null
| undefined` — guarda contra um tipo que o próprio contrato do SDK exclui); `lucide-react` "downgrade"
no `package-lock.json` (falso positivo — `package.json` mantém `^0.477.0` inalterado; é só a forma como
o lockfile normaliza o range após `npm install` da nova dependência, nenhuma versão real mudou).

## Dev Notes

### Arquivos principais a modificar/criar (lidos por completo durante o planejamento)

- **Novo:** `src/shared/clients/ocr/MistralOcrProvider.ts`
- **Deletado:** `src/shared/clients/ocr/ApiOcrProvider.ts` (148 linhas, lido por completo — confirmado
  que só `environments.ts` importa a classe)
- **Modificado:** `src/shared/clients/ocr/MockOcrProvider.ts` — **nenhuma mudança de conteúdo**, só
  muda como é alcançado (via `environments.ts`). Não editar este arquivo.
- **Modificado:** `src/shared/environments.ts` (311 linhas, lido por completo) — schema, lista de
  obrigatórias em produção, `readProcessEnv`, getters, `getOcrProvider()`.
- **Inalterado, confirmado por leitura completa:**
  `src/shared/domain/interfaces/OcrProvider.ts` (contrato `{ name, cpf, birthDate }` — não mexer) e
  `src/modules/credential/app/issue_credential_usecase.ts` (307 linhas — o bloco relevante é
  linhas 93-99, `try { ocrResult = await this.ocrProvider.processDocument(documentImage) } catch {
  throw new AppError("Document processing failed", 422, ...) }` — permanece exatamente assim).

### Nomes de campo confirmados no SDK (`@mistralai/mistralai`, verificado no source oficial
`mistralai/client-ts`, não deduzido)

O Sprint Change marcou isso como "⚠️ confirmar ao implementar" — **já confirmado nesta fase de
planejamento** direto no código-fonte gerado do SDK (`src/models/components/*.ts` do repo
`mistralai/client-ts`, branch `main`):

- **Request** (`OCRRequest`, tudo camelCase no lado do SDK TS): `model: string`,
  `document: FileChunk | DocumentURLChunk | ImageURLChunk`, `includeImageBase64?: boolean`,
  `documentAnnotationFormat?: ResponseFormat`, `documentAnnotationPrompt?: string`. O SDK remapeia
  para `snake_case` só na serialização HTTP — o código da aplicação usa sempre camelCase.
- **`document` para imagem em memória**: usar `ImageURLChunk`:
  `{ type: "image_url", imageUrl: <string | { url: string; detail?: ... }> }`. **`imageUrl` aceita
  uma `string` pura diretamente** — não precisa montar o objeto `{ url }`. Uma data URI
  (`data:image/png;base64,...`) serve como essa string (documentado no próprio SDK:
  `{"type":"image_url","image_url":"data:image/png;base64,iVBORw0"}`).
- **`documentAnnotationFormat` (`ResponseFormat`)**: `{ type?: "text" | "json_object" | "json_schema",
  jsonSchema?: JsonSchema }`. **O campo é `jsonSchema`, não `json_schema`** no lado do SDK TS (o
  outbound schema remapeia `jsonSchema` → `json_schema` na hora de montar o request HTTP — a
  aplicação nunca escreve `json_schema` diretamente).
- **`JsonSchema`**: `{ name: string, description?: string, schemaDefinition: { [k: string]: any },
  strict?: boolean }`. **O campo é `schemaDefinition`, não `schema`** no lado do SDK TS (mesmo
  remapeamento — o outbound serializa `schemaDefinition` → `schema` no request real). O
  `additionalProperties`/`required` do JSON Schema em si vão **dentro** de `schemaDefinition`, como
  campos normais de um JSON Schema (`schemaDefinition` é um objeto livre — a aplicação monta o JSON
  Schema completo ali dentro, incluindo `type: "object"`, `properties`, `required`,
  `additionalProperties`).
- **Response (`OCRResponse`)**: `documentAnnotation?: string | null` — **confirmado que é sempre uma
  string JSON (ou `null`/`undefined`), nunca um objeto já parseado**. A doc oficial descreve
  literalmente: "Formatted response in the request_format if provided in json str". Logo
  `parseAnnotation` **deve sempre `JSON.parse`** quando o valor existir — não é um "ou objeto ou
  string" condicional como o Sprint Change havia colocado como hipótese; é sempre string.

Fonte: `https://github.com/mistralai/client-ts` (arquivos `src/models/components/ocrrequest.ts`,
`responseformat.ts`, `jsonschema.ts`, `imageurlchunk.ts`, `ocrresponse.ts`, branch `main`, lidos
durante o planejamento desta story). Versão publicada no npm no momento do planejamento: `2.6.3`.
**Reconfirmar contra a versão efetivamente instalada** ao rodar `npm install` — SDKs gerados por
Speakeasy tendem a manter esses nomes estáveis entre versões minor/patch, mas o agente implementador
deve checar o `.d.ts` instalado se algo não compilar.

### Desenho de referência do `MistralOcrProvider`

```ts
import { Mistral } from "@mistralai/mistralai";
import { OcrProvider, OcrResult } from "@/shared/domain/interfaces/OcrProvider";

const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

const DOCUMENT_ANNOTATION_SCHEMA = {
  type: "json_schema" as const,
  jsonSchema: {
    name: "brazilian_id_document",
    strict: true,
    schemaDefinition: {
      type: "object",
      properties: {
        name: { type: ["string", "null"], description: "Nome civil completo do titular, exatamente como impresso" },
        cpf: { type: ["string", "null"], description: "CPF do titular, apenas dígitos" },
        birthDate: { type: ["string", "null"], description: "Data de nascimento do titular em YYYY-MM-DD. Nunca usar data de emissão, expedição ou validade" },
      },
      required: ["name", "cpf", "birthDate"],
      additionalProperties: false,
    },
  },
};

export class MistralOcrProvider implements OcrProvider {
  private readonly client: Mistral;

  constructor(apiKey: string) {
    this.client = new Mistral({ apiKey });
  }

  async processDocument(base64Image: string): Promise<OcrResult> {
    const response = await this.client.ocr.process({
      model: MISTRAL_OCR_MODEL,
      document: { type: "image_url", imageUrl: toDataUri(base64Image) },
      documentAnnotationFormat: DOCUMENT_ANNOTATION_SCHEMA,
      includeImageBase64: false,
    });

    if (!response.documentAnnotation) {
      throw new Error("Document processing failed");
    }

    const parsed = JSON.parse(response.documentAnnotation);
    return validateOcrResult(parsed);
  }
}
```

`toDataUri` e `validateOcrResult` ficam no mesmo arquivo (funções privadas do módulo, não exportadas)
— não criar um arquivo utilitário novo só para isso; é um client isolado, não um módulo compartilhado.

### Por que o mock permanece, mas só sob `STAGE=TEST`

O `MockOcrProvider` não é apagado — a mudança é **só o critério de seleção** em `getOcrProvider()`.
Hoje o critério é "ausência de `OCR_API_URL`/`OCR_API_KEY`" (silencioso — qualquer ambiente mal
configurado cai no mock sem avisar). Depois desta story, o critério passa a ser **`STAGE === Stage.TEST`
declarado explicitamente** — mesmo padrão já usado por `getBlockchainClient()` (`environments.ts:251-254`,
inalterado por esta story, apenas a referência de padrão). Isso significa: nenhum ambiente real
(DOTENV, DEV, HOMOLOG, PROD) pode receber o mock por omissão — só a suíte de testes automatizados
(`STAGE=TEST`, forçado por `TEST_ENV` no próprio `environments.ts`) o alcança. O efeito prático: rodar
a emissão localmente (`STAGE=DOTENV`) passa a exigir uma `MISTRAL_API_KEY` real — não existe mais
"deixar vazio e cair no mock automaticamente" (ver Task 6, atualização do guia Postman).

### Sem fallback — ausência de chave é erro, não degradação

Ponto central do v3 do Sprint Change (revisão do PO): a versão v1 cogitava `MISTRAL_API_KEY` opcional
com fallback silencioso para o mock; isso foi **descartado**. O padrão final é idêntico ao já usado
por `ISSUER_PRIVATE_KEY`: `optional()` no schema Zod (para não quebrar o parse em ambientes que não
precisam da chave, como `TEST`) + presença em `productionRequiredEnvNames` (falha o boot via
`superRefine` em PROD/HOMOLOG) + getter que lança via `requireConfiguredValue` (cobre DOTENV/DEV, onde
o `superRefine` não age). Não inventar um mecanismo novo — reusar exatamente esse trio já existente.

### Testes — padrão do projeto

`node:test` + `node:assert/strict`, arquivos `.test.mjs`, três categorias: existência de arquivo,
verificação estática de conteúdo via regex sobre o source, `tsc --noEmit` como último teste (com
`STAGE: "TEST"` no env). Ver `tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs` como
referência mais recente de convenção. A Story 5.8 (QA) introduziu um segundo padrão — testes
dinâmicos/comportamentais via `tsx` (`*.dynamic.test.ts`, instanciam a classe real com dependências
fake) — disponível se o agente decidir que vale a pena para o guard do AC #6 (ver Task 7).

A suíte completa tinha 610 testes passando após a Story 5.8 (604 estáticos + 6 dinâmicos). Rodar
`npm run test` ao final e confirmar que o total sobe sem nenhuma regressão.

### Project Structure Notes

Nenhuma mudança de rota, controller, presenter, viewmodel ou schema de banco — o blast radius é
inteiramente `src/shared/clients/ocr/` + `src/shared/environments.ts` + `package.json` +
`.env.local.example` + `amplify.yml` + dois arquivos de doc + dois arquivos de teste de
`story-11-8` + três arquivos de planejamento (TBD → resolvido). Novo diretório de teste
`tests/unit/story-5-9/` (padrão já estabelecido). Confirma a análise do Sprint Change: a inversão de
dependência já isolava o provider atrás de `OcrProvider` — é exatamente o cenário para o qual essa
camada foi desenhada.

### Nota sobre o estado atual não commitado de `.env.local.example`

O working tree já tem uma edição solta em `.env.local.example` (visível em `git status` como
modificado, não commitada) que deixou o arquivo num estado transitório — o bloco antigo de OCR virou
`# OCR - NOT USING` e um bloco novo `# MISTRAL` foi adicionado **ao lado**, sem remover o antigo. A
Task 5 desta story consolida isso para o estado final único (12 nomes). Não assumir que o arquivo já
está pronto — ele está pela metade.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-19.md] — proposta completa,
  análise de causa-raiz, diffs de referência para cada artefato (§4.1-§4.4), ACs originais (§5),
  histórico de revisão v1→v3 (importante: v3 é a versão vigente — mock preservado sob `STAGE=TEST`)
- [Source: src/shared/clients/ocr/ApiOcrProvider.ts] — implementação a ser removida, lida por completo
- [Source: src/shared/clients/ocr/MockOcrProvider.ts] — test double, lido por completo, não modificar
- [Source: src/shared/domain/interfaces/OcrProvider.ts] — contrato de domínio, inalterado
- [Source: src/shared/environments.ts] — arquivo principal de wiring, lido por completo (311 linhas)
- [Source: src/modules/credential/app/issue_credential_usecase.ts] — consumidor de `OcrProvider`, lido
  por completo (163 linhas), confirma que o mapeamento de erro para 422 já existe e não muda
- [Source: https://github.com/mistralai/client-ts — src/models/components/{ocrrequest,responseformat,jsonschema,imageurlchunk,ocrresponse}.ts]
  — nomes de campo do SDK confirmados via source oficial durante o planejamento (branch `main`)
- [Source: tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs] — padrão de teste mais
  recente do projeto
- [Source: tests/unit/story-11-8/env-var-sync-authoritative.test.mjs linhas 86-104] — teste dos 13
  nomes canônicos a ajustar para 12
- [Source: tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs linhas 316-326] — fixture
  `OCR_API_URL` a trocar por `MISTRAL_API_KEY`
- [Source: docs/deployment/production-cicd.md linhas 349-377] — regra de colocação Secret vs.
  Variable e tabela de classificação atual
- [Source: docs/e2e-happy-path-postman.md linhas 75-214, 310-323] — guia E2E a atualizar
- [Source: .env.local.example] — estado atual (parcialmente editado, não commitado — ver nota acima)
- [Source: amplify.yml linha 15] — lista de `grep -we` do passo de env
- [Source: CONTEXT.md linhas 34, 36, 61-62] — vocabulário canônico de OCR/personhood/ageOver18, não
  precisa de edição (já descreve o processamento em memória de forma agnóstica de provider)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Confirmados os nomes exatos de campo do SDK `@mistralai/mistralai@2.6.3` diretamente no source
  instalado (`node_modules/@mistralai/mistralai/src/models/components/{ocrrequest,responseformat,jsonschema}.ts`):
  `documentAnnotationFormat` (não `document_annotation_format`), `ResponseFormat.jsonSchema` (não
  `json_schema`), `JsonSchema.schemaDefinition` (não `schema`), `OCRResponse.documentAnnotation:
  string | null | undefined` (sempre string JSON, nunca objeto pré-parseado) — resolve o ponto que o
  Sprint Change havia marcado como "⚠️ confirmar ao implementar".
- `node --test tests/unit/story-5-9/mistral-ocr-provider-selection.test.mjs` — 21/21 passando
  (inclui `tsc --noEmit`).
- `npm run test` (suíte completa, pré-review) — 971 testes estáticos + 63 dinâmicos, 1034/1034
  passando, 0 falhas, sem regressões em `story-5-4`, `story-5-7`, `story-5-8`, `story-9-1`,
  `story-9-2`, `story-11-8`.
- `npx eslint src/shared/clients/ocr/MistralOcrProvider.ts src/shared/environments.ts
  tests/unit/story-5-9/mistral-ocr-provider-selection.test.mjs` — sem findings.
- **Code review (3 camadas paralelas: Blind Hunter, Edge Case Hunter, Acceptance Auditor)** — 0
  decision-needed, 3 patch (aplicados), 4 defer (registrados em `deferred-work.md`), 4 dismissed
  (ruído/falso positivo/decisão deliberada já documentada). Acceptance Auditor confirmou as 11 ACs
  satisfeitas sem violações, incluindo verificação direta do source do SDK instalado para os nomes de
  campo (`jsonSchema`/`schemaDefinition`) e do `timeoutMs` real em `RequestOptions`.
- Após aplicar os 3 patches (MIME desconhecido lança em vez de assumir PNG; data de calendário
  inválida rejeitada em vez de sofrer rollover silencioso do `Date`; ano de nascimento mínimo
  1900): `node --test tests/unit/story-5-9/mistral-ocr-provider-selection.test.mjs` — 24/24 passando
  (21 originais + 3 novos testes de regressão para os patches).
- `npm run test` (suíte completa, pós-patches) — 974 estáticos + 63 dinâmicos, 1037/1037 passando, 0
  falhas, sem regressões.
- `npx eslint` nos arquivos patcheados — sem findings.

### Completion Notes List

- Criado `MistralOcrProvider` implementando `OcrProvider`, único arquivo do projeto que importa
  `@mistralai/mistralai` (guard automatizado no teste novo varre todo `src/` para garantir isso).
  Chama `client.ocr.process` com `document_annotation_format` (JSON Schema `strict: true`) pedindo
  `{ name, cpf, birthDate }` estruturados — zero regex de extração de texto livre.
- `toDataUri` detecta o MIME por magic bytes (PNG/JPEG, fallback `image/png`) e monta a data URI que
  a API espera; a entrada do use case continua sendo base64 puro, sem mudança de contrato.
- `documentAnnotation` da resposta é sempre uma string JSON (confirmado no source do SDK, não uma
  hipótese) — sempre `JSON.parse`, nunca um `typeof` condicional.
- `validateOcrResult` rejeita (lança `"Document processing failed"`, mesmo texto que o use case já
  mapeia para 422) qualquer `name` < 3 chars, `cpf` que não normalize para 11 dígitos, ou `birthDate`
  fora de `YYYY-MM-DD`/data inválida/futura — a saída do modelo nunca é aceita sem validação
  estrutural.
- `ApiOcrProvider.ts` removido por completo (client + `parseDocumentText` + `isValidDate`, ~148
  linhas) — confirmado que só `environments.ts` o importava.
- `getOcrProvider()` em `environments.ts` reescrito no mesmo padrão de `getBlockchainClient()`:
  ramifica por `this.stage === Stage.TEST` (mock, sem ler a chave) vs. todo ambiente real
  (`MistralOcrProvider`, chave obrigatória). Eliminado o fallback silencioso por ausência de
  configuração que existia antes (`if (url && key)`).
- `MISTRAL_API_KEY` entra em `productionRequiredEnvNames` (deriva boot failure em PROD/HOMOLOG via
  `superRefine`) e ganha getter que lança via `requireConfiguredValue` (cobre DOTENV/DEV) — mesmo
  trio de mecanismos já usado por `ISSUER_PRIVATE_KEY`, nenhum mecanismo novo introduzido.
- `.env.local.example` consolidado: removido o bloco antigo `OCR_API_URL`/`OCR_API_KEY` (que estava
  num estado transitório não commitado, coexistindo com um bloco `MISTRAL_API_KEY` solto) — resultado
  final é um único bloco `# OCR (Mistral Document AI...)` com `MISTRAL_API_KEY`, 12 nomes canônicos
  no total.
- `amplify.yml`, `docs/deployment/production-cicd.md` (tabela Variables 4 / Secrets 8) e os dois
  testes de `story-11-8` (nomes canônicos e fixture) atualizados para os 12 nomes.
- `docs/e2e-happy-path-postman.md`: removida a dicotomia mock/real do guia — `docImage` passa a ser
  sempre obrigatório (sem fallback `mock-doc-personhood`), box de OCR reescrito, linha de
  troubleshooting do 422 atualizada.
- `prd.md`, `epics.md`, `architecture.md`: TBDs de provider de OCR já estavam resolvidos no working
  tree ao iniciar esta story (mudança preexistente, não commitada) — confirmado por leitura completa
  que o texto bate exatamente com o Sprint Change §4.4; nenhuma edição adicional necessária.
- **Fora de escopo, não implementado (por decisão explícita do Sprint Change):** refino 422 vs 502
  para distinguir "documento ilegível" de "provider indisponível" — mudaria contrato público e AC da
  Story 5.4, deferido para story própria.
- **Pré-requisito operacional pendente (AC #10, fora do escopo de código):** o Secret
  `MISTRAL_API_KEY` precisa ser cadastrado no GitHub antes do próximo deploy em produção — sem ele o
  boot falha em PROD/HOMOLOG (comportamento intencional, não um bug).
- **Code review — 3 patches aplicados:** `detectMimeType` agora lança `"Document processing failed"`
  para qualquer buffer que não bata a assinatura PNG/JPEG, em vez de assumir `image/png` por padrão;
  `isValidBirthDate` reescrito para comparar os componentes ano/mês/dia extraídos do regex contra os
  campos UTC da `Date` resultante — rejeita datas de calendário inválidas (ex.: `"2023-02-29"`) em vez
  de aceitar o rollover silencioso do `Date` nativo do JS; nova constante `MIN_BIRTH_YEAR = 1900`
  rejeita anos de nascimento implausíveis.
- **Code review — 4 itens deferidos** (registrados em `deferred-work.md`, sem impacto nos ACs desta
  story): CPF sem dígito verificador (mesma limitação do provider antigo); `Buffer.from` não valida
  base64/vazio antes de montar a data URI (não causa aprovação incorreta, só adia a falha); erros de
  rede/timeout colapsam no mesmo 422 que documento ilegível (é o refino 422 vs 502 que o próprio
  Sprint Change §4.5 pede para deferir); suíte 100% estática, sem teste dinâmico do SDK mockado
  (padrão sistêmico do projeto).

### File List

**Novos:**
- `src/shared/clients/ocr/MistralOcrProvider.ts`
- `tests/unit/story-5-9/mistral-ocr-provider-selection.test.mjs`
- `tests/unit/story-5-9/mistral-ocr-provider.dynamic.test.ts` (QA — teste dinâmico/comportamental via
  `tsx`, mocka `client.ocr.process` e instancia o provider real)

**Deletados:**
- `src/shared/clients/ocr/ApiOcrProvider.ts`

**Modificados:**
- `src/shared/environments.ts` — schema, `productionRequiredEnvNames`, `readProcessEnv`, getters,
  `getOcrProvider()`
- `package.json` / `package-lock.json` — nova dependência `@mistralai/mistralai@^2.6.3`; novo script
  `test:story:5.9` (QA)
- `.env.local.example` — bloco OCR consolidado para `MISTRAL_API_KEY` único
- `amplify.yml` — lista de `grep -we` do passo de env
- `docs/deployment/production-cicd.md` — tabela de classificação Variables/Secrets
- `docs/e2e-happy-path-postman.md` — box OCR, pre-request script, troubleshooting do 422
- `tests/unit/story-11-8/env-var-sync-authoritative.test.mjs` — 13 → 12 nomes canônicos
- `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` — fixture `OCR_API_URL` →
  `MISTRAL_API_KEY`
- `_bmad-output/implementation-artifacts/deferred-work.md` — 4 itens deferidos do code review
- `_bmad-output/implementation-artifacts/tests/test-summary.md` — cobertura da story 5.9

## Change Log

- **2026-08-19** — Implementação completa da Story 5.9: `MistralOcrProvider` substitui
  `ApiOcrProvider`, eliminando todo parsing por regex de texto livre em favor de extração estruturada
  via `document_annotation_format` da Mistral Document AI. `getOcrProvider()` passa a selecionar o
  provider exclusivamente por `STAGE` (mock só sob `STAGE=TEST`, sem fallback silencioso por ausência
  de configuração). `MISTRAL_API_KEY` obrigatória em produção. CI/CD, docs e testes de `story-11-8`
  atualizados para os 12 nomes canônicos de env vars. 21 novos testes estruturais; suíte completa
  (1034 testes: 971 estáticos + 63 dinâmicos) passando sem regressões. Status → `review`.
- **2026-08-19** — Code review (3 camadas: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0
  decision-needed, 3 patch, 4 defer (registrados em `deferred-work.md`), 4 dismissed. Todas as 11 ACs
  confirmadas satisfeitas pelo Acceptance Auditor, sem violações. Patches aplicados: MIME não
  reconhecido agora lança em vez de assumir PNG; datas de calendário inválidas (ex.: 29/02 em ano não
  bissexto) rejeitadas em vez de sofrer rollover silencioso; ano de nascimento mínimo (1900)
  adicionado. 3 novos testes de regressão cobrindo os patches. Suíte completa: 1037/1037 passando (974
  estáticos + 63 dinâmicos). Status → `test`.
- **2026-08-19** — QA: geração de testes dinâmicos/comportamentais. `mistral-ocr-provider.dynamic.test.ts`
  instancia `MistralOcrProvider` real e mocka apenas `client.ocr.process` (único ponto de I/O de rede)
  via `node:test`'s `mock.method` nativo — verifica `processDocument` em runtime para as 3 ACs
  centrais (extração estruturada, rejeição de documento sem campos, rejeição de saída inválida) e os 3
  patches do code review, todos confirmados por mutação. Fecha a lacuna "suíte 100% estática"
  registrada em `deferred-work.md` pelo próprio code review desta story. Novo script `test:story:5.9`.
  Suíte completa: 1048/1048 passando (974 estáticos + 74 dinâmicos). Status → `done`.
