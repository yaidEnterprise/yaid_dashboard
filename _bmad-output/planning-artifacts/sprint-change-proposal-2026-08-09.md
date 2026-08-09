# Sprint Change Proposal — Sincronização de Env Vars na Pipeline Amplify

- **Data:** 2026-08-09
- **Autor:** Victordegasperi (com apoio do agente Dev)
- **Epic afetado:** Epic 11 — Pipeline de CI/CD de Produção
- **Story âncora:** Story 11.5 (`deploy-amplify`) — `done`
- **Classificação de escopo:** **Moderate** (múltiplos artefatos; reverte uma decisão de segurança documentada — §5.4 — de forma controlada, contida no Epic 11)

---

## 1. Issue Summary

**Problema:** As variáveis de ambiente usadas pela aplicação (as declaradas em `.env.local.example`
e validadas em `src/shared/environments.ts`) **não estão sendo efetivamente atualizadas** no AWS
Amplify pela pipeline de deploy.

**Contexto de descoberta:** Operacionalizando o release de produção (Epic 11). A pipeline
(`.github/jobs/deploy-amplify/action.yml`) **já possui** um passo de sincronização de env vars,
porém a fonte dos dados é um **único secret opaco** `AMPLIFY_ENVIRONMENT_VARIABLES` (um blob JSON
mantido manualmente), **desacoplado** de `.env.local.example` e de `environments.ts`.

**Evidência (causa-raiz):**

1. **Dois "sources of truth" que divergem sem guard.** Quando uma variável nova é adicionada ao
   schema (`environments.ts`) / ao `.env.local.example`, ninguém atualiza o blob JSON → a variável
   nova nunca chega ao Amplify. Nada na pipeline detecta a divergência. Daí a percepção de que
   "nada está sendo atualizado".
2. **Semântica de _merge_ (não-autoritativa).** O passo atual faz `get-branch` → `jq '$current *
   $incoming'` → `update-branch`, ou seja, **preserva** o que já existe no console Amplify e nunca
   remove nada. Variáveis obsoletas permanecem indefinidamente.
3. **Variáveis de build (`NEXT_PUBLIC_*`) tratadas como "server-side".** O input está descrito como
   "env vars server-side", quando `NEXT_PUBLIC_*` são inlinadas **no build** (`npm run build`).

---

## 2. Impact Analysis

### Epic Impact
- **Epic 11** — a descrição do epic promete "sincronização segura de env vars (merge, sem
  sobrescrever)". Esta mudança **reformula** essa promessa para um modelo **autoritativo derivado
  de `.env.local.example`**. Nenhum outro epic é afetado.

### Story Impact
- **Story 11.5 (`deploy-amplify`)** — impactada diretamente: inputs, passo de sync, ACs e tasks.
- **Story 11.7 (documentação operacional)** — runbook de env vars precisa refletir o novo modelo
  (GitHub Variables/Secrets nomeados por variável, regra de classificação, replace autoritativo).
- Demais stories do Epic 11 (11.1–11.4, 11.6): **sem impacto**.

### Artifact Conflicts
| Artefato | Mudança |
|---|---|
| `.github/jobs/deploy-amplify/action.yml` | Reescrever inputs + passo de sync (merge → replace derivado do `.env.local.example`) |
| `.github/workflows/production.yml` | Trocar `amplify-environment-variables` por `toJSON(vars)` + `toJSON(secrets)` |
| `tests/unit/story-11-5/deploy-amplify-contract.test.mjs` | Substituir o teste de _merge_ por teste de _replace autoritativo_; ajustar teste do orquestrador |
| `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` | Ajustar asserções de inputs/sync |
| `_bmad-output/implementation-artifacts/stories/11-5-*.md` | ACs #4 e tasks de sync; notas §5.4 |
| `_bmad-output/implementation-artifacts/stories/11-7-*.md` + `docs/ops/amplify-deploy.md` | Runbook de env vars |
| `_bmad-output/planning-artifacts/epics.md` | Descrição do Epic 11 (texto "merge, sem sobrescrever") |

### Technical Impact
- **Reversão da decisão §5.4** (merge → replace). **É seguro agora** porque, no novo modelo,
  **todas** as env vars têm origem no GitHub (Variables/Secrets); nenhuma variável server-side vive
  apenas no console Amplify. Logo, um `update-branch` autoritativo não apaga nada que não seja
  reprovisionado no mesmo passo.
- **Secret `AMPLIFY_ENVIRONMENT_VARIABLES` deixa de existir** (removido do repo).
- Requer criar, no GitHub, **1 Variable/Secret por variável** do `.env.local.example` (ver §3).

---

## 3. Recommended Approach

**Modelo autoritativo derivado do `.env.local.example`:**

1. **Fonte da verdade para os NOMES = `.env.local.example`.** A pipeline extrai a lista canônica
   de nomes dele.
2. **Valores vêm do GitHub, 1:1 — resolvidos pelo lugar onde estão.** Para cada nome, a pipeline
   procura o valor em **Secrets**; se não achar, procura em **Variables** (precedência de Secret se
   por engano estiver nos dois). Assim **quem decide Secret vs Variable é a colocação no GitHub** —
   sem lista de exceção em código. A regra abaixo é apenas a **orientação para humanos** decidirem
   onde colocar cada variável.
   - **Padrão:** nome casa `KEY|PASSWORD|PRIVATE|SECRET|TOKEN` (case-insensitive) → **Secret**;
     senão → **Variable**.
   - **Exceções explícitas:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **Variable** (pública);
     `BLOCKCHAIN_RPC_URL` → **Secret** (a URL embute a API key do provedor de RPC).
3. **Replace autoritativo.** O mapa montado (só os nomes do `.env.local.example` que tiverem valor)
   é enviado via `aws amplify update-branch --environment-variables`, que **substitui o mapa
   inteiro** nativamente. Variável ausente do conjunto **desaparece** do Amplify.
4. **Mecanismo de enumeração:** o orquestrador passa `${{ toJSON(vars) }}` e `${{ toJSON(secrets) }}`
   como inputs; o composite **filtra** para exatamente os nomes do `.env.local.example` — garantindo
   que secrets de infra (AWS_*, SUPABASE_ACCESS_TOKEN, AMPLIFY_*) **nunca** vazem para o Amplify.

### Classificação das 13 variáveis

| Variável | Padrão sensível? | Destino |
|---|---|---|
| `STAGE` | não | **Variable** (valor em prod = `PROD`) |
| `NEXT_PUBLIC_APP_URL` | não | **Variable** |
| `NEXT_PUBLIC_SUPABASE_URL` | não | **Variable** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `KEY` | **Variable** ⚠️ (exceção — ver Nota A) |
| `SUPABASE_SECRET_KEY` | `SECRET`/`KEY` | **Secret** |
| `SUPABASE_DB_PASSWORD` | `PASSWORD` | **Secret** ⚠️ (ver Nota B) |
| `BLOCKCHAIN_RPC_URL` | não | **Secret** ⚠️ (exceção — embute API key do RPC) |
| `BLOCKCHAIN_WALLET_PRIVATE_KEY` | `PRIVATE`/`KEY` | **Secret** |
| `BLOCKCHAIN_CONTRACT_ADDRESS` | não | **Variable** |
| `ISSUER_PRIVATE_KEY` | `PRIVATE`/`KEY` | **Secret** |
| `WEBHOOK_SIGNING_PRIVATE_KEY` | `PRIVATE`/`KEY` | **Secret** |
| `OCR_API_URL` | não | **Variable** |
| `OCR_API_KEY` | `KEY` | **Secret** |

**6 Variables · 7 Secrets.**

### Notas / decisões a confirmar
- **Nota A — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`:** apesar do `KEY` no nome, é **pública** (vai
  inlinada no bundle). **Decisão do usuário:** fica em **Variables**. `BLOCKCHAIN_RPC_URL`, embora
  sem padrão sensível no nome, vai em **Secrets** por embutir a API key do provedor de RPC. Como a
  pipeline resolve pela colocação no GitHub (Secrets → Variables), ambas as exceções são honradas
  sem código especial.
- **Nota B — `SUPABASE_DB_PASSWORD`:** consta no `.env.local.example` mas é usada apenas pelo CLI
  do Supabase (job `deploy-supabase`), **não** pelo app em runtime. Sincronizá-la ao Amplify é
  inócuo, porém desnecessário. Incluída por estar no `.env.local.example` ("todas as variáveis").
- **Nota C — `YAID_VERIFICATION_BASE_URL` (RESOLVIDO — decisão do usuário):** **não** vira env var
  própria (não faz sentido uma variável só para acrescentar `/v`). O `src/shared/environments.ts`
  passa a **derivá-la** de `NEXT_PUBLIC_APP_URL`: `YAID_VERIFICATION_BASE_URL = ${NEXT_PUBLIC_APP_URL}/v`.
  Deixa de ser lida de `process.env` e sai do conjunto sincronizado. (É um ajuste de `environments.ts`
  — descrito na Story 11.8; não implementado neste proposal.)

**Estimativa:** ~1 dia (código + testes + docs). **Risco:** baixo-médio (mexige criar os
Variables/Secrets no GitHub antes do próximo release, senão o boot falha por `environments.ts` —
que é o comportamento fail-fast desejado). **Timeline:** dentro do Epic 11.

---

## 4. Detailed Change Proposals

### 4.1 `.github/jobs/deploy-amplify/action.yml` — inputs

**OLD:**
```yaml
  amplify-environment-variables:
    description: >-
      Payload JSON (objeto {chave:valor}) com as env vars server-side a
      sincronizar no branch Amplify. ... É MESCLADO com as vars atuais ...
    required: true
```
**NEW:**
```yaml
  github-variables-json:
    description: >-
      JSON de TODAS as GitHub Variables do repo (via `${{ toJSON(vars) }}`).
      A pipeline resolve, para cada nome do `.env.local.example`, o valor em
      Secrets → senão em Variables. Nunca ecoado.
    required: true
  github-secrets-json:
    description: >-
      JSON de TODOS os GitHub Secrets do repo (via `${{ toJSON(secrets) }}`).
      Consultado primeiro na resolução de cada nome do `.env.local.example`.
      Nunca ecoado. Secrets de infra (AWS_*, SUPABASE_ACCESS_TOKEN, AMPLIFY_*)
      são filtrados fora por não constarem no `.env.local.example`.
    required: true
```

### 4.2 `.github/jobs/deploy-amplify/action.yml` — passo de sync (merge → replace)

**OLD:** step "Sincroniza env vars no Amplify (merge, sem sobrescrever)" com `get-branch` +
`jq '$current * $incoming'` + `update-branch` do mapa mesclado.

**NEW (lógica):**
```bash
set -euo pipefail
# 1) nomes canônicos a partir do .env.local.example (fonte da verdade)
names="$(grep -vE '^[[:space:]]*#|^[[:space:]]*$' .env.local.example \
         | sed -E 's/=.*//; s/[[:space:]]//g')"
# 2) para cada nome: resolve o valor pela COLOCAÇÃO (Secrets → senão Variables)
payload='{}'
while IFS= read -r name; do
  [ -z "$name" ] && continue
  value="$(jq -r --arg n "$name" '.[$n] // empty' <<<"$SECRETS_JSON")"
  [ -z "$value" ] && value="$(jq -r --arg n "$name" '.[$n] // empty' <<<"$VARS_JSON")"
  [ -z "$value" ] && continue      # não passada => não aparece no Amplify
  payload="$(jq --arg n "$name" --arg v "$value" '. + {($n): $v}' <<<"$payload")"
done <<<"$names"
# 3) REPLACE autoritativo: update-branch substitui o mapa inteiro nativamente
aws amplify update-branch --cli-input-json "$(jq -n \
  --arg app "$AMPLIFY_APP_ID" --arg branch "$AMPLIFY_BRANCH_NAME" \
  --argjson env "$payload" \
  '{appId:$app,branchName:$branch,environmentVariables:$env}')"
```
`env:` do step: `AWS_REGION`, `AMPLIFY_APP_ID`, `AMPLIFY_BRANCH_NAME`,
`VARS_JSON: ${{ inputs.github-variables-json }}`, `SECRETS_JSON: ${{ inputs.github-secrets-json }}`.
**Sem `get-branch`. Sem echo/cat de valores.** O filtro pela lista do `.env.local.example` é a
garantia de que secrets de infra não vazam para o Amplify.

**Rationale:** atende "toda variável do `.env.local.example` aparece" + "só essa lista" + "variável
não passada desaparece" (replace autoritativo), com classificação Secret/Variable por nome.

### 4.3 `.github/workflows/production.yml` — job `deploy-amplify`

**OLD:**
```yaml
          amplify-environment-variables: ${{ secrets.AMPLIFY_ENVIRONMENT_VARIABLES }}
```
**NEW:**
```yaml
          github-variables-json: ${{ toJSON(vars) }}
          github-secrets-json: ${{ toJSON(secrets) }}
```

### 4.4 Testes — `tests/unit/story-11-5/deploy-amplify-contract.test.mjs`

- **Remover** o teste `"o update-branch reenvia o mapa MESCLADO (current + incoming)"`.
- **Adicionar** teste de **replace autoritativo**: o step de sync **não** faz `get-branch`; deriva
  os nomes de `.env.local.example`; resolve o valor por colocação (`SECRETS_JSON` → `VARS_JSON`);
  monta o payload e chama `update-branch`.
- **Ajustar** `"o orquestrador só passa valores ${{ secrets.* }}"`: passa a aceitar também
  `${{ toJSON(vars) }}` e `${{ toJSON(secrets) }}`.
- O invariante `"os steps do composite NUNCA referenciam secrets.*"` **permanece válido** (o
  composite lê `inputs.*`; a enumeração vem via input, não via `secrets.*` direto).
- O teste `"ao menos 3 steps aws amplify"` **permanece válido** (update-branch, start-job, get-job).

### 4.5 Story 11.5 — `11-5-workflow-job-deploy-amplify.md`
- Reescrever AC #4 (de "merge" para "replace autoritativo derivado de `.env.local.example` +
  classificação Secret/Variable").
- Atualizar tasks de inputs e do passo de sync; atualizar a nota §5.4.

### 4.6 Story 11.7 + `docs/ops/amplify-deploy.md`
- Nova seção de runbook: tabela de classificação, como criar Variable vs Secret, o modelo replace
  autoritativo e o procedimento para **adicionar uma variável nova** (basta adicioná-la ao
  `.env.local.example` e criar o Variable/Secret correspondente no GitHub).

### 4.7 `epics.md` — descrição do Epic 11
- Trocar "sincronização segura de env vars (merge, sem sobrescrever...)" por "sincronização
  autoritativa de env vars derivada do `.env.local.example` (replace; Secret/Variable por padrão
  de nome; secrets nunca em `NEXT_PUBLIC_*` nem em logs)".

---

## 5. Implementation Handoff

- **Escopo:** **Moderate.**
- **Rota:** Developer (Amelia / `bmad-dev-story`) executa as edições §4; PO valida o runbook (§4.6).
- **Pré-requisito operacional (fora do código):** criar no GitHub, antes do próximo release em
  `prod`, os **6 Variables** e **7 Secrets** da tabela §3, e **remover** o secret
  `AMPLIFY_ENVIRONMENT_VARIABLES`.
- **Critérios de sucesso:**
  1. `npm run test:story:11.5` verde com os testes de replace autoritativo.
  2. Todas as 13 variáveis do `.env.local.example` presentes no branch Amplify após o release.
  3. Nenhuma variável fora dessa lista permanece no branch Amplify (replace confirmado).
  4. Nenhum valor de secret aparece nos logs da pipeline.
