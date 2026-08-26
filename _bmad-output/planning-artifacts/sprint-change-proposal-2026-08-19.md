# Sprint Change Proposal — OCR via Mistral Document AI (eliminação do parsing por regex)

- **Data:** 2026-08-19
- **Autor:** Victordegasperi (com apoio do agente Dev)
- **Epic afetado:** Epic 5 — Emissão, Verificação e Gestão de Credenciais
- **Story âncora:** Story 5.4 (`emissao-de-verifiable-credential`) — `done`
- **Classificação de escopo:** **Moderate** (uma story nova + resolução de um TBD de PRD/Arquitetura + ajuste de CI/CD e docs; contido no Epic 5)
- **Modo de revisão:** Batch

---

## 1. Issue Summary

**Problema:** A integração de OCR extrai `name`, `cpf` e `birthDate` aplicando **regex sobre o texto
bruto** devolvido por uma API de OCR genérica. O client
`src/shared/clients/ocr/ApiOcrProvider.ts` chama a API, recebe `{ text: "..." }` e roda ~100 linhas
de heurística textual (`parseDocumentText`) para reconstruir os campos.

**Contexto de descoberta:** Uso real do fluxo `POST /api/credentials/issue` com imagens de RG/CNH.
O provider de OCR sempre foi um **TBD explícito** nos artefatos de planejamento — a implementação da
Story 5.4 escolheu uma API genérica de OCR como solução provisória e o parsing por regex foi a
consequência direta dessa escolha, não uma decisão arquitetural deliberada.

**Evidência (causa-raiz):**

1. **A extração é heurística, não estruturada.** `ApiOcrProvider.ts:8-105` tenta 3 padrões de CPF,
   2 padrões rotulados + 1 fallback para data, e 2 padrões para nome. Qualquer layout de documento
   fora desses moldes (RG antigo, RG de outro estado, CNH, CIN/RG digital, foto rotacionada, texto
   em coluna) não casa e a emissão morre em **422 `Document processing failed`**.
2. **O fallback de data é perigoso.** `dateFallbackPattern` (`ApiOcrProvider.ts:44`) aceita
   **qualquer** `DD/MM/YYYY` do documento quando não acha o rótulo — data de emissão, de validade ou
   de expedição podem ser lidas como data de nascimento. Isso alimenta diretamente o cálculo de
   `ageOver18` no `issue_credential_usecase.ts:100-113`, ou seja: **um erro de parsing vira uma
   claim falsa numa credencial assinada**.
3. **O regex de nome quebra por acentuação e ordem de campos.** A alternância exige um conjunto
   fechado de keywords (`CPF|RG|CNH|DOC|DATA|...`) como delimitador de fim de nome; qualquer rótulo
   fora da lista faz o nome capturar lixo até a quebra de linha.
4. **Custo de manutenção crescente e sem teto.** Cada documento novo que falha vira mais um padrão
   no array. Não existe critério de parada.

**O que NÃO é o problema:** o contrato de domínio.
`OcrProvider.processDocument(base64) → { name, cpf, birthDate }`
(`src/shared/domain/interfaces/OcrProvider.ts`) está correto e **permanece inalterado**. O defeito
está inteiramente na camada de client.

---

## 2. Impact Analysis

### Epic Impact

- **Epic 5** — continua válido e entregável como planejado. A mudança **resolve** um TBD que o
  próprio epic registra (`epics.md:147`, `epics.md:1001`) em vez de contradizer qualquer decisão
  anterior. Nenhum AC de negócio do Epic 5 muda de significado.
- **Epic 11 (CI/CD)** — impacto **colateral e mecânico**: o modelo autoritativo de env vars da
  Story 11.8 deriva a lista canônica de `.env.local.example`; trocar `OCR_API_URL`/`OCR_API_KEY` por
  `MISTRAL_API_KEY` exige atualizar o manifesto, o `amplify.yml`, o runbook e os testes de contrato.
  **Não reabre o Epic 11** — é consequência de uma mudança do Epic 5.
- Demais epics (1–4, 6–10): **sem impacto**.

### Story Impact

| Story | Status | Impacto |
|---|---|---|
| 5.4 — Emissão de VC | `done` | Implementação do provider substituída; ACs de negócio inalterados; a nota "⚠️ TBD provider de OCR" sai |
| 5.7 / 5.8 — claims consolidadas | `done` | **Sem mudança de código.** Beneficiadas indiretamente: `ageOver18` passa a se apoiar numa data extraída de forma estruturada |
| 9.1 / 9.2 — VC-JWT | `done` | Sem impacto — a serialização da VC não toca o OCR |
| 11.8 — sync de env vars | `done` | Testes de contrato (`tests/unit/story-11-8/`) referenciam a lista canônica com os nomes de OCR — precisam de atualização |
| **5.9 (nova)** | — | Story que executa esta mudança |

### Artifact Conflicts

| Artefato | Mudança |
|---|---|
| `_bmad-output/planning-artifacts/prd.md` | §Decisões em aberto (TBD): riscar o item de provider de OCR como **Resolvido** |
| `_bmad-output/planning-artifacts/epics.md` | Linha 147 (TBD de OCR) e linha 1001 (nota TBD da Story 5.4) |
| `_bmad-output/planning-artifacts/architecture.md` | Linhas 113 (restrições), 173 (dependências não instaladas), 755 (fluxo Backend → OCR) |
| `_bmad-output/planning-artifacts/ux-design-specification.md` | **Nenhuma** — o OCR é 100% backend, sem superfície de UI |
| `src/shared/clients/ocr/ApiOcrProvider.ts` | **Deletado** |
| `src/shared/clients/ocr/MockOcrProvider.ts` | **Mantido** como test double — alcançável só por `STAGE=TEST` |
| `src/shared/clients/ocr/MistralOcrProvider.ts` | **Novo** (único ponto que importa o SDK) |
| `src/shared/domain/interfaces/OcrProvider.ts` | **Inalterado** |
| `package.json` | **Nova dependência** `@mistralai/mistralai` (versão fixada) |
| `src/shared/environments.ts` | Schema, `productionRequiredEnvNames`, `readProcessEnv`, getter e `getOcrProvider()` |
| `tests/unit/story-5-4/credential-issuance.test.mjs` | Asserções estruturais: `ApiOcrProvider` → `MistralOcrProvider` (as de `MockOcrProvider` seguem válidas) |
| `tests/unit/story-5-9/` (novo) | Guard de seleção de provider por `STAGE` (AC #6) |
| `.env.local.example` | Bloco `# OCR` → `MISTRAL_API_KEY` |
| `amplify.yml` | Lista de `grep -we` do passo de env |
| `docs/deployment/production-cicd.md` | Tabela de classificação Variables/Secrets |
| `docs/e2e-happy-path-postman.md` | Box "OCR — mock vs. real" e a linha de troubleshooting 422 |
| `tests/unit/story-11-8/env-var-sync-authoritative.test.mjs` | Lista de nomes canônicos (13 → 12) |
| `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` | Fixture que usa `OCR_API_URL` |

### Technical Impact

- **Contrato externo da API: inalterado.** `POST /api/credentials/issue` continua recebendo
  `{ documentImage, bodySignature }` e devolvendo 201/401/422/502 com os mesmos corpos. O app mobile
  **não precisa de nenhuma alteração**.
- **NFR7 (OCR em memória, zero persistência) preservado.** A imagem continua trafegando em memória
  e nunca é gravada em banco nem em log. Muda o destinatário externo da imagem, não a política.
- **Privacidade / terceiro processador:** a imagem do documento passa a ser enviada à Mistral em vez
  da API de OCR atual. Ambas são terceiros — a natureza do tratamento não muda —, mas a troca de
  processador deve ser registrada. Ação recomendada na story: usar a plataforma da Mistral com
  retenção zero e documentar o processador no material de privacidade.
- **Dependências:** **nova dependência npm `@mistralai/mistralai`** (SDK oficial TS), usada
  exclusivamente dentro de `src/shared/clients/ocr/MistralOcrProvider.ts`. A orientação a interfaces
  é preservada: o SDK fica confinado à implementação concreta, atrás de `OcrProvider`; nenhuma outra
  camada importa `@mistralai/mistralai`.
- **Sem fallback para mock:** ausência de `MISTRAL_API_KEY` passa a ser **erro**, não degradação
  silenciosa. Em PROD/HOMOLOG o boot falha; em DOTENV/DEV o getter lança ao ser lido. O
  `MockOcrProvider` continua existindo para a suíte de testes, mas **só é alcançável sob
  `STAGE=TEST` declarado** — nenhum ambiente real (DOTENV/DEV/HOMOLOG/PROD) pode recebê-lo.
  Consequência prática: rodar o fluxo de emissão localmente passa a exigir uma chave Mistral de dev
  (custo por página).
- **Custo:** passa a existir custo por página processada na Mistral. Ordem de grandeza compatível com
  o volume de emissão do MVP; sem impacto de arquitetura.
- **Latência:** chamada única (OCR + anotação estruturada no mesmo request), portanto comparável ao
  desenho atual — sem round-trip extra.

---

## 3. Recommended Approach

### Opções avaliadas

| Opção | Avaliação |
|---|---|
| **1 — Direct Adjustment** | ✅ **Viável.** Uma story nova dentro do Epic 5 substitui o client, sem tocar interface de domínio, use case, rota ou contrato externo. Esforço: **Baixo–Médio**. Risco: **Baixo** |
| **2 — Rollback** | ❌ **Não viável e desnecessário.** As stories 5.4/5.7/5.8/9.1/9.2 estão corretas; o defeito está numa classe de infraestrutura folha. Reverter destruiria trabalho válido para reescrever a mesma coisa |
| **3 — Revisão de MVP** | ❌ **Não aplicável.** O MVP não muda de escopo — o TBD do provider de OCR sempre esteve previsto para ser fechado nesta fase. Isso é **fechar** o TBD, não reduzir escopo |

### Caminho selecionado: **Opção 1 — Direct Adjustment**

**Solução:** `MistralOcrProvider` chamando `POST https://api.mistral.ai/v1/ocr` com
`model: "mistral-ocr-latest"` e `document_annotation_format` (JSON Schema) — a API devolve os campos
já estruturados em `document_annotation`. **Nenhum regex de extração sobrevive.**

**Justificativa:**

1. **Ataca a causa-raiz, não o sintoma.** O problema é "parsing de texto livre"; a solução é "não
   ter texto livre para parsear". Trocar só a qualidade do OCR (mantendo o parser) deixaria o mesmo
   defeito estrutural de pé.
2. **Elimina o fallback perigoso de data.** O schema pede `birthDate` explicitamente — o modelo lê o
   campo rotulado do documento em vez de o código chutar a primeira data que aparecer.
3. **Escopo cirúrgico.** A arquitetura em camadas já isola o provider atrás de uma interface de
   domínio: o blast radius é um arquivo de client + wiring de env. É exatamente o cenário para o
   qual a inversão de dependência foi desenhada.
4. **Resolve um TBD documentado.** PRD, epics e architecture pedem essa decisão desde o início; o
   custo marginal de documentá-la agora é praticamente zero.

**Trade-off assumido:** troca-se um parser determinístico (previsível, mas errado com frequência) por
um modelo (mais robusto, porém não determinístico). Mitigação: **validação estrutural** na saída —
CPF com 11 dígitos após normalização, `birthDate` em `YYYY-MM-DD` sendo data real, `name` não vazio.
Validar ≠ parsear: rejeita-se saída malformada, não se reconstrói campo a partir de texto corrido.

**Estimativa:** ~1 story · Esforço **Baixo–Médio** · Risco **Baixo** · Sem impacto no cronograma dos
epics abertos (7.5, 10.x).

---

## 4. Detailed Change Proposals

### 4.1 Código

#### (a) Novo — `src/shared/clients/ocr/MistralOcrProvider.ts`

**Princípio de camada (inegociável):** o SDK da Mistral entra como detalhe de implementação, **atrás
da interface de domínio**. `MistralOcrProvider implements OcrProvider` é o único arquivo em todo o
projeto autorizado a importar `@mistralai/mistralai`. O use case
(`issue_credential_usecase.ts:43`) continua dependendo exclusivamente de `OcrProvider` — trocar de
provider no futuro segue custando um arquivo.

Desenho de referência (a implementação final é da story):

```ts
import { Mistral } from "@mistralai/mistralai";
import { OcrProvider, OcrResult } from "@/shared/domain/interfaces/OcrProvider";

const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

const DOCUMENT_ANNOTATION_SCHEMA = {
  type: "json_schema",
  jsonSchema: {
    name: "brazilian_id_document",
    strict: true,
    schemaDefinition: {
      type: "object",
      properties: {
        name:      { type: ["string", "null"], description: "Nome civil completo do titular, exatamente como impresso" },
        cpf:       { type: ["string", "null"], description: "CPF do titular, apenas dígitos" },
        birthDate: { type: ["string", "null"], description: "Data de nascimento do titular em YYYY-MM-DD. Nunca usar data de emissão, expedição ou validade" },
      },
      required: ["name", "cpf", "birthDate"],
      additionalProperties: false,
    },
  },
} as const;

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

    const annotation = parseAnnotation(response.documentAnnotation); // JSON.parse se vier como string
    return validateOcrResult(annotation); // valida — não reconstrói
  }
}
```

**Pontos que a story deve resolver explicitamente:**

- ⚠️ **Confirmar os nomes exatos do SDK ao implementar.** O `client-ts` usa camelCase
  (`documentAnnotationFormat`, `imageUrl`, `includeImageBase64`), mas o formato interno do
  `json_schema` (`jsonSchema.schemaDefinition` vs. `schema`) e o campo de resposta
  (`documentAnnotation`) devem ser verificados contra a versão instalada — tipos do SDK e/ou o
  helper `responseFormatFromZodObject` exposto pelo pacote. Fixar a versão em `package.json`.
- `toDataUri`: a API espera `data:<mime>;base64,<...>`; a entrada atual é base64 puro. Detectar o
  MIME por magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`) em vez de assumir `image/png` como hoje
  (`ApiOcrProvider.ts:118`).
- `documentAnnotation` pode chegar como objeto **ou** como string JSON — tratar ambos.
- `validateOcrResult`: `name` com ≥ 3 caracteres após `trim`; `cpf` normalizado para 11 dígitos
  (`replace(/\D/g, "")`) e rejeitado fora disso; `birthDate` casando `^\d{4}-\d{2}-\d{2}$` **e**
  sendo data real e não futura. Qualquer campo `null` ou inválido → `throw` (o use case mapeia 422).
- **Nada da imagem, do texto ou dos campos extraídos pode ir para log** — inclusive em caminho de
  erro. NFR7 vale igual no `catch`. Atenção: SDKs costumam ter modo debug que loga request/response
  inteiros — **manter desligado**, o request carrega a imagem do documento.
- Timeout explícito (opção do SDK ou `AbortSignal`) — a implementação atual não tem timeout algum.

#### (b) Deletado — `src/shared/clients/ocr/ApiOcrProvider.ts`

Arquivo inteiro, incluindo `parseDocumentText` e `isValidDate`. Nenhum outro módulo importa esses
símbolos (verificado: só `environments.ts` referencia a classe).

#### (c) Mantido, mas restrito a `STAGE=TEST` — `src/shared/clients/ocr/MockOcrProvider.ts`

O arquivo **permanece** como test double disponível à suíte. O que muda é **como ele é alcançado**:

| | Antes | Depois |
|---|---|---|
| Critério de seleção | **Ausência** de `OCR_API_URL`/`OCR_API_KEY` | **`STAGE === Stage.TEST`**, explícito |
| Alcançável em DOTENV / DEV | ✅ (silenciosamente) | ❌ |
| Alcançável em HOMOLOG / PROD | ✅ (silenciosamente) | ❌ |
| Falta de chave | Cai no mock | **Lança** |

A distinção é a coisa toda: **ausência de configuração deixa de ser um seletor**. Um ambiente só
recebe o mock se alguém declarar `STAGE=TEST` — nunca por omissão, nunca por acidente. Isso segue o
precedente já existente no próprio arquivo: `getBlockchainClient()` (`environments.ts:251-254`)
também ramifica por `stage === Stage.TEST`.

> **Nota factual sobre o uso atual:** hoje **nenhum teste importa** `MockOcrProvider` — os testes do
> use case injetam o próprio `FakeOcrProvider` no construtor
> (`tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts:59-64`), e as referências em
> `tests/unit/story-5-4/credential-issuance.test.mjs:31,63` são apenas asserções estruturais de
> existência de arquivo. Mantê-lo é, portanto, uma decisão deliberada de conservar o test double
> disponível para testes que exercitem o wiring de `getOcrProvider()` sob `STAGE=TEST` — não uma
> dependência existente. Registrado aqui para que ninguém no futuro leia essa permanência como
> "algum teste depende disso".

#### (d) Guard contra regressão

Como a segurança agora depende de uma condição de `STAGE`, ela precisa de teste próprio (AC #6):
asserção de que `getOcrProvider()` devolve `MistralOcrProvider` em `DOTENV`, `DEV`, `HOMOLOG` e
`PROD`, e `MockOcrProvider` **somente** em `TEST` — incluindo o caso "chave ausente em DOTENV", que
deve **lançar** em vez de cair no mock.

#### (e) Inalterados

- `src/shared/domain/interfaces/OcrProvider.ts` — contrato mantido.
- `src/modules/credential/app/issue_credential_usecase.ts` — nenhuma mudança (ver §4.5 para a
  proposta **opcional** de refino de erro).

#### (f) `src/shared/environments.ts`

**Chave obrigatória em produção** — entra em `productionRequiredEnvNames`, ao lado das outras chaves
sem as quais o sistema não pode operar honestamente:

```diff
 const productionRequiredEnvNames = [
   "ISSUER_PRIVATE_KEY",
   "WEBHOOK_SIGNING_PRIVATE_KEY",
   "BLOCKCHAIN_WALLET_PRIVATE_KEY",
   "BLOCKCHAIN_CONTRACT_ADDRESS",
+  "MISTRAL_API_KEY",
 ] as const;
```

```diff
   BLOCKCHAIN_RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
-  OCR_API_URL: z.string().url().optional(),
-  OCR_API_KEY: z.string().min(1).optional(),
+  MISTRAL_API_KEY: z.string().min(1).optional(),
```

> `optional()` no schema + presença em `productionRequiredEnvNames` é **exatamente** o padrão já
> usado por `ISSUER_PRIVATE_KEY` (`environments.ts:34,19`): o `superRefine` (`environments.ts:47-55`)
> transforma a ausência em erro de boot quando `STAGE` é `PROD` ou `HOMOLOG`.

```diff
-  OCR_API_URL: process.env.OCR_API_URL,
-  OCR_API_KEY: process.env.OCR_API_KEY,
+  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
```

**Getter que lança** — mesmo padrão de `ISSUER_PRIVATE_KEY` (`environments.ts:152-157`), cobrindo
também DOTENV/TEST, onde o `superRefine` não age:

```diff
-  get OCR_API_URL() { return this.values.OCR_API_URL; }
-  get OCR_API_KEY() { return this.values.OCR_API_KEY; }
+  get MISTRAL_API_KEY() {
+    return requireConfiguredValue(this.values.MISTRAL_API_KEY, "MISTRAL_API_KEY");
+  }
```

**Factory sem fallback, com o mock atrás de `STAGE=TEST` explícito:**

```diff
   async getOcrProvider(): Promise<OcrProvider> {
-    const url = this.values.OCR_API_URL;
-    const key = this.values.OCR_API_KEY;
-
-    if (url && key) {
-      const { ApiOcrProvider } = await import("@/shared/clients/ocr/ApiOcrProvider");
-      return new ApiOcrProvider(url, key);
-    }
-
-    const { MockOcrProvider } = await import("@/shared/clients/ocr/MockOcrProvider");
-    return new MockOcrProvider();
+    // Test double alcançável SOMENTE por STAGE=TEST declarado — nunca por
+    // ausência de configuração. Mesmo critério de getBlockchainClient().
+    if (this.stage === Stage.TEST) {
+      const { MockOcrProvider } = await import(
+        "@/shared/clients/ocr/MockOcrProvider"
+      );
+      return new MockOcrProvider();
+    }
+
+    const { MistralOcrProvider } = await import(
+      "@/shared/clients/ocr/MistralOcrProvider"
+    );
+    return new MistralOcrProvider(this.MISTRAL_API_KEY);
   }
```

**Matriz de resolução resultante:**

| `STAGE` | Provider | `MISTRAL_API_KEY` ausente |
|---|---|---|
| `TEST` | `MockOcrProvider` | irrelevante — chave nunca é lida |
| `DOTENV` (local) | `MistralOcrProvider` | getter **lança** na 1ª emissão |
| `DEV` | `MistralOcrProvider` | getter **lança** na 1ª emissão |
| `HOMOLOG` | `MistralOcrProvider` | **boot falha** (`superRefine`) |
| `PROD` | `MistralOcrProvider` | **boot falha** (`superRefine`) |

> **Decisão 1 — endpoint e modelo como constantes no client, não como env vars.** Mantém a linha da
> simplificação do Sprint Change 2026-08-09: só vira variável de ambiente o que muda por ambiente.
> Uma variável (`MISTRAL_API_KEY`) substitui duas.
>
> **Decisão 2 — sem fallback (correção sobre a v1 desta proposta).** Ausência de chave é erro, não
> degradação. Em PROD/HOMOLOG o boot falha com `MISTRAL_API_KEY is required for PROD`; em DOTENV/TEST
> o getter lança `MISTRAL_API_KEY is not configured for this environment` na primeira emissão. **A
> aplicação nunca emite uma credencial assinada a partir de dados falsos** — que era o desfecho
> possível com o fallback silencioso.
>
> **Efeito colateral importante:** isso **elimina** o risco operacional que a v1 tratava como AC
> bloqueante. Esquecer o Secret no deploy agora derruba o boot de forma barulhenta, em vez de subir
> um app que emite VCs para "Mock Holder". A falha ficou mais visível e menos perigosa.

**Rationale (código):** o defeito é de camada de client; a interface de domínio já isolava o
provider. Trocar apenas a folha da árvore de dependências é o que a arquitetura previa.

### 4.2 Configuração e CI/CD

#### `.env.local.example`

```diff
-# OCR
-OCR_API_URL=YOUR_OCR_API_URL
-OCR_API_KEY=YOUR_OCR_API_KEY
+# OCR (Mistral Document AI — modelo e endpoint são constantes no client)
+MISTRAL_API_KEY=YOUR_MISTRAL_API_KEY
```

→ a lista canônica passa de **13 para 12 nomes**.

#### `amplify.yml:15`

```diff
- ... -we BLOCKCHAIN_CONTRACT_ADDRESS -we OCR_API_URL -we OCR_API_KEY >> .env.production || true
+ ... -we BLOCKCHAIN_CONTRACT_ADDRESS -we MISTRAL_API_KEY >> .env.production || true
```

#### `docs/deployment/production-cicd.md:355-372`

Tabela de classificação: remover `OCR_API_URL` da coluna **Variables** e `OCR_API_KEY` da coluna
**Secrets**; adicionar **`MISTRAL_API_KEY` como Secret**. Atualizar a contagem no cabeçalho
(12 nomes cadastráveis → **11**, com `STAGE` como 12º automático): **Variables 4 · Secrets 7**.

> ⚠️ **Ação operacional obrigatória no deploy** (o sync da Story 11.8 é autoritativo — o que sai do
> `.env.local.example` **é removido** do Amplify): cadastrar o Secret `MISTRAL_API_KEY` no GitHub
> **antes** do primeiro deploy pós-merge. Com a chave em `productionRequiredEnvNames` (§4.1e), a
> ausência **derruba o boot** em PROD/HOMOLOG — falha barulhenta e imediata, não emissão de
> credenciais falsas. O risco deixou de ser "credencial mock em produção" e passou a ser
> "indisponibilidade no deploy", que é o trade-off correto.

#### `tests/unit/story-11-8/env-var-sync-authoritative.test.mjs:86-104`

Ajustar o teste "AC1: `.env.local.example` lista exatamente os 13 nomes canônicos" → **12 nomes**,
removendo `OCR_API_URL`/`OCR_API_KEY` e incluindo `MISTRAL_API_KEY` (título do teste incluído).

#### `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs:316-326`

Fixture usa `OCR_API_URL` como exemplo de variável vazia → trocar por `MISTRAL_API_KEY` (ou outro
nome canônico vivo). Mudança mecânica, sem alteração de semântica do guard.

### 4.3 Documentação

#### `docs/e2e-happy-path-postman.md` (linhas 212-214 e 320)

**O modo "OCR mockado" deixa de existir** — a dicotomia mock/real sai do documento inteiro:

```diff
-> **OCR — mock vs. real:** o provider é escolhido em `src/shared/environments.ts` conforme o `.env`.
-> - **Sem `OCR_API_URL`/`OCR_API_KEY`** → OCR **mockado**: ...
-> - **Com `OCR_API_URL`/`OCR_API_KEY`** → OCR **real**: ... senão o parse falha com 422 ...
+> **OCR (obrigatório):** o fluxo de emissão exige `MISTRAL_API_KEY` configurada — **não existe modo
+> mockado em ambiente real**. O `MockOcrProvider` só é usado sob `STAGE=TEST` (suíte automatizada),
+> nunca em execução local/homol/prod. Sem a chave, a emissão falha ao ler o env (e em PROD/HOMOLOG o
+> app nem sobe).
+> O `docImage` deve ser **base64 puro** (sem prefixo `data:image/...;base64,`) de uma imagem legível
+> do documento. Gere com `base64 -i rg.png | tr -d '\n' | pbcopy`. Dica: reduza a imagem (~1000px).
+> A extração é estruturada (Mistral Document AI) — um **422** agora significa que o modelo não
+> encontrou nome, CPF ou data de nascimento no documento, não que um regex falhou.
```

Também afetados no mesmo arquivo:
- **Linha 80** — a linha da tabela de variáveis (`docImage` · "*OCR mock: deixe vazio*") perde a
  alternativa mock: passa a exigir sempre o base64 real.
- **Linhas 188-190** — comentários do script pré-request que descrevem os dois modos.
- **Linha 320** — troubleshooting do 422: remover "teste sua API de OCR isolada (deve retornar
  `{ text: ... }`)" e substituir por verificação de `MISTRAL_API_KEY` válida + legibilidade da imagem.

### 4.4 Artefatos de planejamento

#### `prd.md:247` — Decisões em aberto (TBD)

```diff
-- Provider de OCR concreto (Google Vision, AWS Textract, IDWall, Unico, etc.) — decidir após prototipar com 1–2 amostras de RG.
+- ~~Provider de OCR concreto (Google Vision, AWS Textract, IDWall, Unico, etc.).~~ **Resolvido (Sprint Change 2026-08-19):** **Mistral Document AI** (`POST /v1/ocr`, `mistral-ocr-latest`) com `document_annotation_format` (JSON Schema) devolvendo `{ name, cpf, birthDate }` estruturados. Extração estruturada na origem — sem parsing de texto livre no backend.
```

#### `epics.md:147` — Restrições técnicas

```diff
-- Integração com OCR em memória — provider **TBD** (Google Vision, AWS Textract, IDWall etc.): agente implementador deve questionar antes de implementar.
+- Integração com OCR em memória — provider **definido (Sprint Change 2026-08-19): Mistral Document AI** (`POST https://api.mistral.ai/v1/ocr`, `mistral-ocr-latest`) com `document_annotation_format` (JSON Schema) retornando `{ name, cpf, birthDate }`. O backend **valida** a saída (formato de CPF e de data), **nunca extrai campos de texto corrido por regex**. Autenticação por `MISTRAL_API_KEY`; modelo e endpoint são constantes no client.
```

#### `epics.md:1001` — Nota da Story 5.4

```diff
-> ⚠️ **TBD para o agente implementador:** questionar provider de OCR (Google Vision, AWS Textract, IDWall etc.) e biblioteca de assinatura Ed25519 antes de implementar.
+> ℹ️ **Decisões fechadas:** provider de OCR = **Mistral Document AI** com extração estruturada via `document_annotation_format` (Sprint Change 2026-08-19; ver Story 5.9). Assinatura Ed25519 = `@noble/ed25519` (resolvido na implementação da 5.4).
```

#### `architecture.md:113` — Restrições e Dependências Técnicas

```diff
-- **OCR** — Provider TBD (Google Vision, AWS Textract, IDWall etc.); integração em memória obrigatória.
+- **OCR** — **Mistral Document AI** (`POST /v1/ocr`, `mistral-ocr-latest`), com `document_annotation_format` (JSON Schema) devolvendo `{ name, cpf, birthDate }` já estruturados. Integração em memória obrigatória (NFR7). O backend valida formato; **não faz parsing de texto livre**.
```

#### `architecture.md:173` — Dependências não instaladas

```diff
-- **OCR SDK** — provider a definir — **⚠️ TBD: ver seção de TBDs no PRD**
+- **OCR SDK** — `@mistralai/mistralai` (SDK oficial TS da Mistral). Import **restrito** a `src/shared/clients/ocr/MistralOcrProvider.ts`; nenhuma outra camada conhece o SDK.
```

#### `architecture.md:755` — Fluxo Backend → OCR

```diff
-**Backend → OCR:** somente via `shared/clients/ocr/` — ⚠️ TBD.
+**Backend → OCR:** somente via `shared/clients/ocr/`, resolvido em `environments.ts#getOcrProvider()`. Em **todo ambiente real** (`DOTENV`, `DEV`, `HOMOLOG`, `PROD`) o provider é `MistralOcrProvider` — **sem fallback**: `MISTRAL_API_KEY` é obrigatória (`productionRequiredEnvNames`), sua ausência derruba o boot em PROD/HOMOLOG e lança no getter nos demais. O `MockOcrProvider` existe apenas como test double e é alcançável **exclusivamente** sob `STAGE=TEST` declarado — ausência de configuração nunca seleciona provider (mesmo critério de `getBlockchainClient()`). O use case depende apenas da interface `OcrProvider` — nunca do client, nem do SDK. A saída do provider é **estruturada na origem**; o client só valida formato (CPF 11 dígitos, `birthDate` em `YYYY-MM-DD`) e lança em caso de saída inválida.
```

### 4.5 Refino de erro (proposta **opcional** — decisão do usuário)

**Observação levantada na análise, fora do escopo mínimo:**
`issue_credential_usecase.ts:94-98` captura **qualquer** exceção do provider e devolve **422
`Document processing failed`**. Isso mistura dois casos diferentes:

- documento ilegível / sem os campos → **422** está correto;
- Mistral fora do ar, timeout ou chave inválida → hoje também vira **422**, dizendo ao holder que o
  documento dele é ruim quando o problema é nosso.

Existe precedente no próprio sistema: falha de blockchain devolve **502**
(`epics.md:998-1000`). O simétrico seria o provider distinguir "documento não processável" de
"provider indisponível" e o use case mapear o segundo para **502 `OCR provider unavailable`**.

**Impacto:** muda um AC da Story 5.4 (`epics.md:993-995`) e adiciona um código de erro ao contrato
público do `POST /api/credentials/issue` — o app mobile precisaria tratar o novo 502.

**Recomendação:** **não incluir** na Story 5.9. O escopo desta mudança é eliminar o regex; mexer no
contrato de erro é uma decisão de produto independente. Registrar em `deferred-work.md` como item
candidato a story própria.

---

## 5. Implementation Handoff

### Classificação de escopo: **Moderate**

Múltiplos artefatos (planejamento + código + CI/CD + docs + testes), uma story nova e uma ação
operacional obrigatória (cadastro do Secret) — mas **contido no Epic 5**, sem replanejamento de
produto e sem alteração do contrato público da API.

### Nova story: **Story 5.9 — OCR estruturado via Mistral Document AI**

- **Epic:** 5 — Emissão, Verificação e Gestão de Credenciais
- **Status inicial:** `backlog` → `ready-for-dev` ao ser criada via `bmad-create-story`
- **Dependências:** nenhuma (5.4/5.7/5.8 já `done`). Independente das stories 7.5 e 10.x — pode
  correr em paralelo.

**Critérios de aceite propostos:**

1. **Given** `MISTRAL_API_KEY` configurada e uma imagem legível de documento brasileiro
   **When** `POST /api/credentials/issue` é chamado
   **Then** nome, CPF e data de nascimento vêm de `document_annotation` da Mistral e a VC é emitida
   com 201 — **sem nenhum regex de extração no caminho**.
2. **Given** o documento não contém nome, CPF ou data de nascimento legíveis
   **Then** retorna **422** `{ error: "Document processing failed" }` sem persistir nada.
3. **Given** a saída da Mistral com CPF fora de 11 dígitos, `birthDate` fora de `YYYY-MM-DD`,
   data inexistente/futura, ou qualquer campo `null`
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
   `docs/e2e-happy-path-postman.md` e os testes de `story-11-8` refletem os **12 nomes canônicos**.
10. **Pré-requisito de deploy:** o Secret `MISTRAL_API_KEY` está cadastrado no GitHub **antes** do
    primeiro deploy pós-merge (o sync autoritativo remove do Amplify o que saiu do manifesto; sem a
    chave o boot falha).
11. `npm run test` passa integralmente.

### Handoff

| Papel | Responsabilidade |
|---|---|
| **PO / Dev (Victordegasperi)** | Aprovar esta proposta; aplicar as edições de §4.4 nos artefatos de planejamento; registrar a Story 5.9 no `sprint-status.yaml` |
| **Agente Dev** (`bmad-create-story` → `bmad-story-pipeline`) | Criar e implementar a Story 5.9: novo client, remoção do antigo, wiring de env, CI/CD, docs e testes |
| **Operação (Victordegasperi)** | Provisionar a conta Mistral, gerar a API key, cadastrar o Secret `MISTRAL_API_KEY` no GitHub antes do deploy |

### Critérios de sucesso

- Zero regex de extração de campo no diretório `src/shared/clients/ocr/`.
- Documentos que hoje falham em 422 por variação de layout passam a emitir credencial.
- `ageOver18` deixa de depender do fallback "primeira data que aparecer no documento".
- `npm run test` verde; deploy de produção com `MISTRAL_API_KEY` presente (sem queda silenciosa
  para o mock).

---

## 6. Change Navigation Checklist — resultado

| Seção | Item | Status |
|---|---|---|
| 1 | 1.1 Story de origem (5.4) · 1.2 Problema (limitação técnica descoberta na implementação) · 1.3 Evidência | [x] Done |
| 2 | 2.1 Epic 5 entregável como planejado · 2.2 Sem mudança de escopo de epic (story nova) · 2.3 Epic 11 impactado só mecanicamente · 2.4 Nenhum epic obsoleto/novo · 2.5 Ordem e prioridade inalteradas | [x] Done |
| 3 | 3.1 PRD (TBD resolvido) · 3.2 Architecture (3 seções) · 3.3 UX — **[N/A]** sem superfície de UI · 3.4 CI/CD, docs, testes | [x] Done / [N/A] 3.3 |
| 4 | 4.1 Direct Adjustment **viável** · 4.2 Rollback **não viável** · 4.3 Revisão de MVP **não aplicável** · 4.4 Selecionado: **Opção 1** | [x] Done |
| 5 | 5.1–5.5 Componentes da proposta | [x] Done |
| 6 | 6.1 Checklist revisado · 6.2 Proposta verificada · 6.3 Aprovação do usuário · 6.4 `sprint-status.yaml` · 6.5 Handoff | [!] Pendente de aprovação |

**Itens marcados [!] Action-needed:**

1. **Secret `MISTRAL_API_KEY` antes do deploy** — sem ele o boot falha em PROD/HOMOLOG. Coberto
   pelos ACs #5 e #10.
2. **Chave Mistral de desenvolvimento** — como `DOTENV`/`DEV` não recebem mais o mock, rodar o fluxo
   de emissão local ou o e2e do Postman passa a exigir uma chave real (custo por página).
3. **`STAGE=TEST` não pode vazar para ambiente implantado.** A garantia do mock passou a depender do
   valor de `STAGE`. O sync da Story 11.8 já trata `STAGE` como automático por ambiente
   (`docs/deployment/production-cicd.md`), então o risco é baixo — mas a story deve confirmar que
   nenhum caminho de deploy permite `STAGE=TEST`.
4. **Registro do novo processador de dados (Mistral)** no material de privacidade — troca de
   terceiro processando imagem de documento.
5. **Refino 422 vs 502 (§4.5)** — recomendado **deferir** para story própria.

---

## 7. Histórico de revisão

| Versão | Data | Mudança |
|---|---|---|
| v1 | 2026-08-19 | Proposta inicial: `fetch` puro, `MISTRAL_API_KEY` opcional com fallback para `MockOcrProvider` |
| v2 | 2026-08-19 | **Revisão do PO:** (1) **fallback para mock eliminado** — chave obrigatória via `productionRequiredEnvNames` + `requireConfiguredValue`, `MockOcrProvider` deletado; (2) **SDK `@mistralai/mistralai` adotado** no lugar de `fetch` puro, confinado à implementação concreta atrás da interface `OcrProvider` |
| **v3** | 2026-08-19 | **Revisão do PO:** `MockOcrProvider` **preservado** para a suíte de testes, porém alcançável **somente** sob `STAGE=TEST` declarado (mesmo critério de `getBlockchainClient()`). Nenhum ambiente real — DOTENV, DEV, HOMOLOG, PROD — pode recebê-lo; ausência de chave lança em vez de degradar. Guard automatizado da matriz `STAGE` → provider vira AC #6 |
