# Story 11.8: Sync Autoritativo de Env Vars no Amplify (derivado do `.env.local.example`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Nota de contexto:** oitava story do Epic 11, criada pelo **Sprint Change 2026-08-09**
> (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-09.md`). **Revisa** o passo de
> sincronização de env vars entregue na Story 11.5: o sync deixa de ser por **merge** (§5.4 da
> proposta 2026-08-08) e passa a ser **autoritativo derivado do `.env.local.example`**. Motivo: o
> modelo anterior dependia de um único secret manual (`AMPLIFY_ENVIRONMENT_VARIABLES`) desacoplado de
> `environments.ts`/`.env.local.example` — variáveis novas nunca chegavam ao Amplify. Epic 11 foi
> reaberto (`in-progress`) por esta story.
>
> **Reversão consciente da §5.4 (merge → replace):** é segura porque, no novo modelo, **todas** as
> env vars têm origem no GitHub (Variables/Secrets); nenhuma variável server-side vive apenas no
> console do Amplify. Logo, um `update-branch` autoritativo não apaga nada que não seja reprovisionado
> no mesmo passo.
>
> **GitHub Actions e AWS não rodam no sandbox** — os testes são estruturais/de contrato (parse do YAML
> via `js-yaml`), no mesmo padrão das Stories 11.2–11.6.

## Story

Como pipeline de CI/CD de produção (Epic 11),
Quero sincronizar as env vars do Amplify de forma **autoritativa a partir do `.env.local.example`**
(a lista de nomes vem dele; os valores, do GitHub Variables/Secrets pela colocação),
Para que toda variável usada pela aplicação seja criada/atualizada no Amplify a cada release e
nenhuma variável fora dessa lista permaneça no branch.

## Acceptance Criteria

1. **Given** o composite `deploy-amplify`
   **When** o passo de sync de env vars roda
   **Then** ele extrai a lista de **nomes** do `.env.local.example` (ignorando comentários/linhas
   vazias) e monta o mapa de env vars **apenas** com esses nomes.

2. **Given** cada nome do `.env.local.example`
   **When** o valor é resolvido
   **Then** a pipeline procura o valor **primeiro em Secrets, senão em Variables** (colocação no
   GitHub decide Secret vs Variable); um nome sem valor em nenhum dos dois é **omitido** do payload.

3. **Given** o mapa montado
   **When** é enviado ao Amplify
   **Then** usa `aws amplify update-branch --environment-variables` com o **mapa completo**
   (**replace** autoritativo) — **sem** `get-branch`/merge. Variável fora da lista **desaparece** do
   branch.

4. **Given** o orquestrador `production.yml`
   **When** chama o composite
   **Then** passa `github-variables-json: ${{ toJSON(vars) }}` e
   `github-secrets-json: ${{ toJSON(secrets) }}`; o input `amplify-environment-variables` e o uso do
   secret `AMPLIFY_ENVIRONMENT_VARIABLES` são **removidos**.

5. **Given** a resolução de valores
   **Then** secrets de infra (`AWS_*`, `SUPABASE_ACCESS_TOKEN`, `AMPLIFY_*`, `GITHUB_TOKEN`) **não**
   chegam ao Amplify (filtrados por não constarem no `.env.local.example`); nenhum valor de env var é
   ecoado nos logs (`echo`/`cat`/`printenv`).

6. **Given** `src/shared/environments.ts`
   **When** `YAID_VERIFICATION_BASE_URL` é acessada
   **Then** ela é **derivada** como `${NEXT_PUBLIC_APP_URL}/v` — não é mais lida de `process.env` nem
   consta no conjunto sincronizado.

7. **Given** a suíte de testes de contrato da 11.5
   **Then** o teste de **merge** é substituído por um teste de **replace autoritativo** (sem
   `get-branch`; nomes derivados do `.env.local.example`); o teste do orquestrador aceita
   `toJSON(vars)`/`toJSON(secrets)`. `npm run test:story:11.5` (e um `test:story:11.8` novo, se
   criado) verdes.

## Tasks / Subtasks

- [x] **`.github/jobs/deploy-amplify/action.yml`** — trocar o input `amplify-environment-variables`
  por `github-variables-json` e `github-secrets-json` (ambos `required`).
- [x] Reescrever o passo de sync: derivar nomes do `.env.local.example`; resolver valor por
  colocação (Secrets→Variables); montar payload (omitir vazios); `update-branch` autoritativo (sem
  `get-branch`/merge). Sem echo de valores.
- [x] **`.github/workflows/production.yml`** — no job `deploy-amplify`, passar
  `github-variables-json: ${{ toJSON(vars) }}` e `github-secrets-json: ${{ toJSON(secrets) }}`;
  remover `amplify-environment-variables`.
- [x] **`src/shared/environments.ts`** — derivar `YAID_VERIFICATION_BASE_URL` de
  `NEXT_PUBLIC_APP_URL` (`${NEXT_PUBLIC_APP_URL}/v`); remover a leitura via `process.env` e o campo
  correspondente de `readProcessEnv`/schema (mantendo o getter e o `TEST_ENV` coerentes).
- [x] **Testes** — atualizar `tests/unit/story-11-5/deploy-amplify-contract.test.mjs`
  (merge → replace) e `workflow-job-deploy-amplify.test.mjs` (inputs); adicionar teste do
  derivamento de `YAID_VERIFICATION_BASE_URL` em `environments.ts`.
- [x] **Docs** — atualizar `docs/ops/amplify-deploy.md` e a Story 11.7 (runbook de env vars:
  tabela de classificação, colocação Secret vs Variable, replace autoritativo, como adicionar uma
  variável nova).

### Review Findings

- [x] [Review][Patch] Bug de barra dupla em `YAID_VERIFICATION_BASE_URL` se `NEXT_PUBLIC_APP_URL` terminar em `/` [src/shared/environments.ts:152] — corrigido com `.replace(/\/+$/, "")` antes de anexar `/v`.
- [x] [Review][Patch] `update-branch` autoritativo sem guarda contra payload totalmente vazio (wipe silencioso do branch) [.github/jobs/deploy-amplify/action.yml:~148] — adicionado `exit 1` explícito se o mapa resolvido tiver 0 chaves.
- [x] [Review][Patch] `grep -v` sob `set -euo pipefail` aborta sem mensagem clara se `.env.local.example` não tiver linhas não-comentadas [.github/jobs/deploy-amplify/action.yml:~127] — adicionado `|| true` + checagem explícita de arquivo vazio/ausente com mensagem clara.
- [x] [Review][Patch] AC5 (secrets de infra nunca chegam ao Amplify) depende só de convenção — adicionar denylist explícito como defesa em profundidade [.github/jobs/deploy-amplify/action.yml] — adicionado guard que aborta o step se um nome derivado do `.env.local.example` casar com `AWS_*`/`AMPLIFY_*`/`SUPABASE_ACCESS_TOKEN`/`GITHUB_TOKEN`.
- [x] [Review][Patch] `test:story:11.8` não roda o arquivo `.dynamic.test.ts` (quebra o padrão de 11.1/9.1/5.8) [package.json:37] — script atualizado para `node --test ... && tsx --test .../*.dynamic.test.ts`.
- [x] [Review][Patch] Task 6 marcada `[x]` mas o arquivo da Story 11.7 em si não foi tocado (só o runbook associado) [_bmad-output/implementation-artifacts/stories/11-7-documentacao-operacional.md] — adicionada entrada no Change Log da 11.7 apontando para a revisão desta story.
- [x] [Review][Patch] Sprint-change-proposal §4.5 pedia revisão da AC#4/nota §5.4 na Story 11.5 — não feita [_bmad-output/implementation-artifacts/stories/11-5-workflow-job-deploy-amplify.md] — adicionada entrada no Change Log da 11.5 apontando para o modelo autoritativo desta story.
- [x] [Review][Defer] Valor vazio (`""`) e valor ausente são indistinguíveis na resolução via `jq // empty` — deferred, baixa probabilidade prática (nenhuma das 13 vars é esperada como string vazia legítima); mudar exigiria decisão de produto sobre semântica
- [x] [Review][Defer] `toJSON(secrets)` expõe todos os secrets do repo ao composite (blast radius maior que o payload único anterior) — deferred, decisão arquitetural já assumida explicitamente pela AC4/proposta 2026-08-09; mitigado parcialmente pelo denylist do patch acima
- [x] [Review][Defer] `.env.local.example` trocou defaults funcionais (`http://localhost:3000`) por placeholders `YOUR_*`, piorando o setup local out-of-the-box — deferred, pré-existente à Story 11.8 (já estava assim no working tree antes do dev desta story)
- [x] [Review][Defer] Testes só fazem assertion sobre o texto/YAML do step de sync, nunca executam de fato o pipeline grep/sed/jq com fixtures — deferred, segue o padrão estrutural já estabelecido nas Stories 11.2–11.7; mudar exigiria decisão de estratégia de teste do Epic 11 inteiro

## Configuração no GitHub (fora do código — pré-requisito de release)

Criar, antes do próximo release em `prod`, e **remover** o secret `AMPLIFY_ENVIRONMENT_VARIABLES`:

**GitHub Variables (6):** `STAGE` (=`PROD`), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`, `OCR_API_URL`.

**GitHub Secrets (7):** `SUPABASE_SECRET_KEY`, `SUPABASE_DB_PASSWORD`, `BLOCKCHAIN_RPC_URL`,
`BLOCKCHAIN_WALLET_PRIVATE_KEY`, `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `OCR_API_KEY`.

> Regra de colocação: nome contém `KEY|PASSWORD|PRIVATE|SECRET|TOKEN` → Secret; senão → Variable.
> Exceções: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → Variable (pública);
> `BLOCKCHAIN_RPC_URL` → Secret (embute API key do provedor de RPC).

## Dev Notes

- **`update-branch` já substitui o mapa inteiro** nativamente — o "replace" é obtido simplesmente
  **não** fazendo o merge (basta enviar o payload autoritativo). O invariante da 11.5 "o composite só
  usa `inputs.*`, nunca `secrets.*`" **permanece** (a enumeração entra via input `toJSON(...)`).
- **`STAGE=PROD` exige env obrigatórias no boot** (`environments.ts`): se um secret obrigatório
  faltar no GitHub, o boot falha — comportamento fail-fast desejado.
- **`SUPABASE_DB_PASSWORD`** consta no `.env.local.example` mas é usada só pelo CLI do Supabase (job
  `deploy-supabase`); sincronizá-la ao Amplify é inócuo. Mantida por estar no `.env.local.example`.

## References

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-09.md` (proposta desta story)
- `architecture.md` → *Infraestrutura & Deploy* e *Regras Obrigatórias* (revisão 2026-08-09)
- `epics.md` → Epic 11 (nota Sprint Change 2026-08-09)
- Story 11.5 (`11-5-workflow-job-deploy-amplify.md`) — modelo de merge que esta story substitui

## Dev Agent Record

### Completion Notes

- **Sync autoritativo implementado** em `.github/jobs/deploy-amplify/action.yml`: os dois inputs
  antigos (`amplify-environment-variables`) foram substituídos por `github-variables-json` e
  `github-secrets-json` (ambos `required`, alimentados por `toJSON(vars)`/`toJSON(secrets)` em
  `production.yml`). O passo de sync deriva os nomes do `.env.local.example` (ignorando
  comentários/linhas vazias), resolve cada valor por colocação — Secrets primeiro, senão Variables —
  omite nomes sem valor, e envia o mapa resultante via `aws amplify update-branch --cli-input-json`
  como replace total (sem `get-branch`/merge). Cabeçalhos/comentários de segurança do composite foram
  reescritos para descrever o modelo REPLACE em vez do MERGE da §5.4.
- **`.env.local.example`** reconciliado: `YAID_VERIFICATION_BASE_URL` removida (agora derivada);
  `SUPABASE_DB_PASSWORD` mantida (readicionada — havia sido removida por engano em uma edição
  anterior não relacionada a esta story) com comentário indicando uso exclusivo pelo CLI do Supabase.
  Arquivo final contém exatamente os 13 nomes canônicos esperados.
- **`src/shared/environments.ts`**: `YAID_VERIFICATION_BASE_URL` deixou de ser um campo do schema
  zod/`readProcessEnv`/`TEST_ENV` e passou a ser um getter derivado
  (`` `${this.values.NEXT_PUBLIC_APP_URL}/v` ``); `TEST_ENV` continua implicitamente consistente
  (`http://localhost:3000/v` a partir de `NEXT_PUBLIC_APP_URL: "http://localhost:3000"`).
- **Testes**: `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` e
  `deploy-amplify-contract.test.mjs` foram atualizados — as asserções de merge (`get-branch`, `jq
  '.[0] * .[1]'`, input único) foram substituídas por asserções de replace autoritativo, e o teste de
  `with:` agora aceita `toJSON(vars)`/`toJSON(secrets)` para os dois novos inputs (mantendo
  `secrets.*` para os demais). Novo diretório `tests/unit/story-11-8/` com dois arquivos: um
  estrutural (`.test.mjs`, cobre AC1–AC6 explicitamente) e um dinâmico (`.dynamic.test.ts`, exercita
  `Environments`/`YAID_VERIFICATION_BASE_URL` em runtime). Novo script `test:story:11.8` em
  `package.json`, seguindo o padrão dos demais `test:story:*`.
- **Docs**: `docs/deployment/production-cicd.md` (o runbook entregue pela Story 11.7) ganhou a seção
  §6.2 "Sync de env vars no Amplify — modelo autoritativo (Story 11.8)" com a tabela de classificação
  (6 Variables / 7 Secrets), a regra de colocação, como criar Variable/Secret no GitHub e o
  procedimento de adicionar uma variável nova; §3.3, §9.6 e a tabela de troubleshooting (§9.9) foram
  atualizadas para refletir o replace autoritativo em vez do merge. `docs/ops/amplify-deploy.md`
  ganhou uma seção curta de cross-link para essa nova §6.2 (sem duplicar conteúdo).
- **Verificação**: suíte completa (`npm test`) rodada ao final — 885 testes estruturais/unitários
  (`node --test`) + 16 testes dinâmicos (`tsx --test`), todos verdes, 0 falhas. `npm run
  test:story:11.5` (37/37 verdes) e `npm run test:story:11.8` (15/15 verdes, arquivo `.test.mjs`)
  também rodados isoladamente. Nenhum script `typecheck`/`tsc` dedicado existe no projeto — a
  suíte já inclui checks de "compila sem erros de TypeScript" (ex.: Story 7.1/7.6/9.1) que passaram,
  cobrindo a mudança em `environments.ts`.

### File List

- `.github/jobs/deploy-amplify/action.yml` (modificado)
- `.github/workflows/production.yml` (modificado)
- `.env.local.example` (modificado)
- `src/shared/environments.ts` (modificado)
- `package.json` (modificado — novo script `test:story:11.8`)
- `tests/unit/story-11-5/deploy-amplify-contract.test.mjs` (modificado)
- `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` (modificado)
- `tests/unit/story-11-8/env-var-sync-authoritative.test.mjs` (novo)
- `tests/unit/story-11-8/environments-yaid-verification-url.dynamic.test.ts` (novo)
- `docs/deployment/production-cicd.md` (modificado)
- `docs/ops/amplify-deploy.md` (modificado)

## Change Log

- 2026-08-09: Implementação completa da Story 11.8 — sync de env vars no Amplify revertido de MERGE
  (§5.4 da proposta 2026-08-08) para REPLACE autoritativo derivado do `.env.local.example`;
  `YAID_VERIFICATION_BASE_URL` passou a ser derivada em vez de lida de `process.env`; testes de
  contrato/estruturais atualizados e novos testes da Story 11.8 adicionados; runbook operacional
  (`docs/deployment/production-cicd.md`) atualizado com a tabela de classificação Variable/Secret e o
  procedimento de adicionar uma env var nova. Suíte completa verde (885 + 16 testes). Status →
  `review`.
- 2026-08-09: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, paralelo) — 0
  decision-needed, 7 patch, 4 defer (registrados em `deferred-work.md`), 7 dismiss. Patches aplicados:
  fix de barra dupla em `YAID_VERIFICATION_BASE_URL`; guarda contra payload vazio antes do
  `update-branch` autoritativo; guarda contra `.env.local.example` ausente/sem linhas válidas sob
  `pipefail`; denylist de defesa em profundidade para nomes de secrets de infra (AC5); script
  `test:story:11.8` corrigido para rodar também o `.dynamic.test.ts`; notas de cross-referência
  adicionadas às Stories 11.5 e 11.7. Suíte completa permanece verde (885 sync + 16 dinâmicos, 0
  falhas) após os patches. Status → `test`.
- 2026-08-09: QA adicionou `tests/unit/story-11-8/env-var-sync-guards-contract.test.mjs` (16 testes —
  extrai e executa de fato o script bash do step de sync via `bash -c` com stub de `aws`, cobrindo os
  4 guards adicionados pelo code review: `.env.local.example` ausente/vazio/sem linhas válidas,
  denylist de secrets de infra, payload vazio) e estendeu
  `environments-yaid-verification-url.dynamic.test.ts` (+3 testes, `STAGE=DEV`, cobrindo o fix de
  barra dupla com 0/1/4 barras finais em `NEXT_PUBLIC_APP_URL`). Suíte da story: 36 testes (17 dev +
  19 QA). Suíte completa: 901 síncronos + 19 dinâmicos, 0 falhas. `test-summary.md` atualizado. Nenhum
  defeito de implementação encontrado. Status → `done`.
