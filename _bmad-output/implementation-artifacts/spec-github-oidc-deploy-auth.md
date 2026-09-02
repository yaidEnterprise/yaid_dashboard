---
title: 'Migrar autenticação AWS do deploy de bootstrap SSO para GitHub OIDC'
type: 'refactor'
created: '2026-09-02'
status: 'done'
context: []
baseline_commit: 'aab5a16fbc1896feb8928d05e9ae7a32b976d740'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O deploy autentica na AWS via bootstrap federado SSO (access-key+secret+session-token renovados manualmente por login interativo antes de cada release) porque, na story anterior, OIDC estava indisponível na conta AWS da faculdade. O administrador da conta agora confirmou que consegue configurar um IAM OIDC Identity Provider + trust policy federada — mas ainda não o fez.

**Approach:** Trocar o composite `deploy-amplify` e o orquestrador `production.yml` para autenticação 100% via GitHub Actions OIDC (`sts:AssumeRoleWithWebIdentity` direto no deploy role, sem nenhuma credencial estática nem sessão a renovar), e atualizar o runbook operacional (`docs/deployment/production-cicd.md`) e os testes de contrato para o novo modelo. O lado AWS (criar o OIDC Identity Provider e a trust policy do deploy role) é responsabilidade do humano, fora deste código, e ainda não está pronto — o pipeline só voltará a autenticar com sucesso depois disso.

## Boundaries & Constraints

**Always:** Job `deploy-amplify` declara `permissions: id-token: write` (mais `contents: read`, pois permissions no nível do job substitui o default do workflow); nenhuma credencial estática (`aws-access-key-id`/`aws-secret-access-key`/`aws-session-token`) permanece em código, testes ou docs; preservar os gates `tests → deploy-supabase → deploy-amplify → smoke-test` e o restante do composite (sync de env autoritativo, start-job, polling) inalterados.

**Ask First:** Nada nesta story — a criação do OIDC Identity Provider e o ajuste da trust policy do deploy role na conta AWS da faculdade são responsabilidade do humano, fora do escopo de código.

**Never:** Manter um modo dual (fallback para credenciais estáticas) "só por segurança" — é troca completa, sem compat shim; configurar runner self-hosted; automatizar qualquer passo fora do repositório.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Trust policy OIDC configurada | Deploy role confia no OIDC provider do GitHub, condição `sub` escopada a `repo:yaidEnterprise/yaid_dashboard:ref:refs/heads/prod` | `configure-aws-credentials` obtém o ID token do job e assume o deploy role via `AssumeRoleWithWebIdentity`; pipeline segue | N/A |
| Trust policy ainda não configurada (estado atual) | Deploy role só confia no ARN do bootstrap user antigo | `AssumeRoleWithWebIdentity` falha na AWS (Not authorized) | Erro da AWS propaga; humano configura o Identity Provider/trust policy e reexecuta |
| `permissions: id-token: write` ausente no job | Job sem essa permissão | O runner não emite ID token; `configure-aws-credentials` falha ao tentar obter o token OIDC | Erro explícito da action antes de qualquer chamada AWS |

</frozen-after-approval>

## Code Map

- `.github/jobs/deploy-amplify/action.yml` -- remove inputs/step de credenciais estáticas; step de auth passa a OIDC puro
- `.github/workflows/production.yml` -- job `deploy-amplify`: adiciona `permissions: id-token: write`+`contents: read`; remove os 3 `with:` de credenciais estáticas
- `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` -- REQUIRED_INPUTS e asserções refletem OIDC (sem access-key/secret)
- `tests/unit/story-11-7/production-cicd-contract.test.mjs` -- invariantes IAM: trust policy `Principal.Federated` (não mais bootstrap user)
- `tests/unit/story-11-7/documentacao-operacional.test.mjs` -- AC#4 reflete policy única do deploy role (trust + permissão), sem policy de bootstrap user
- `docs/deployment/production-cicd.md` -- §1, §2.3, §3.3, §4, §5, §6, §9.9: runbook descreve o modelo OIDC
- `_bmad-output/planning-artifacts/architecture.md` -- linhas ~59 e ~276-277: prosa "OIDC indisponível" corrigida

## Tasks & Acceptance

**Execution:**
- [x] `.github/jobs/deploy-amplify/action.yml` -- remover inputs `aws-access-key-id`/`aws-secret-access-key`/`aws-session-token` e o step de validação do session token -- não existem mais credenciais estáticas para validar
- [x] `.github/jobs/deploy-amplify/action.yml` -- step `configure-aws-credentials` passa a usar somente `aws-region`+`role-to-assume`+`role-session-name`(+`role-skip-session-tagging: true`) -- OIDC nativo dispensa bootstrap
- [x] `.github/jobs/deploy-amplify/action.yml` -- reescrever comentários (topo, SEGURANÇA, bloco que hoje descreve "BOOTSTRAP FEDERADO") para descrever OIDC + `AssumeRoleWithWebIdentity` -- documentação inline não pode contradizer o código
- [x] `.github/workflows/production.yml` -- job `deploy-amplify` ganha `permissions: {id-token: write, contents: read}`; remover as 3 linhas `with:` de credenciais estáticas; reescrever o comentário "BOOTSTRAP FEDERADO" -- é o precondition do OIDC no runner
- [x] `tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs` -- remover `aws-access-key-id`/`aws-secret-access-key` de `REQUIRED_INPUTS`; adicionar teste que falha se esses inputs (ou `aws-session-token`) ainda existirem no composite ou no `with:` do job; adicionar teste que o job declara `permissions.id-token === 'write'` -- trava a regressão para credenciais estáticas
- [x] `tests/unit/story-11-7/production-cicd-contract.test.mjs` -- trocar a asserção "policy bootstrap: só sts:AssumeRole" por uma que valida a trust policy com `Principal.Federated` apontando para `oidc-provider/token.actions.githubusercontent.com` e uma `Condition` (`StringEquals`/`StringLike`) escopando o `sub` ao repo (nunca `*`)
- [x] `tests/unit/story-11-7/documentacao-operacional.test.mjs` -- AC#4: trocar "existe policy do bootstrap user com apenas sts:AssumeRole" por "existe trust policy com Principal.Federated (OIDC) e Condition no sub"
- [x] `docs/deployment/production-cicd.md` -- §5: remover §5.1 (policy do bootstrap user); reescrever a antiga §5.2 (trust policy) com o JSON `Principal.Federated`+`Condition`; renumerar a antiga §5.3 (permission policy do deploy role, inalterada) para §5.2; atualizar §1/§2.3(mermaid)/§3.3/§4(mermaid+checklist)/§6(tabela de secrets: remover `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`)/§9.9 para refletir OIDC
- [x] `_bmad-output/planning-artifacts/architecture.md` -- ajustar a prosa que hoje diz "OIDC indisponível" (linhas ~59 e ~276-277) para descrever o fluxo OIDC atual

**Acceptance Criteria:**
- Given o job `deploy-amplify` em `production.yml`, when inspecionado, then ele declara `permissions: id-token: write` e não referencia `secrets.AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN`.
- Given o composite `deploy-amplify/action.yml`, when inspecionado, then não existem inputs de credenciais estáticas nem o step de validação de session token, e o step `configure-aws-credentials` usa apenas `role-to-assume`+`aws-region`.
- Given o runbook `docs/deployment/production-cicd.md`, when lido, then não há mais menção a "IAM User bootstrap" nem "OIDC indisponível", e o bloco JSON de trust policy usa `Principal.Federated`.
- Given `npm test`, when executado, then toda a suíte passa (incluindo os testes atualizados de `story-11-5` e `story-11-7`).

## Design Notes

Trust policy alvo (documentada no runbook, aplicada pelo humano na conta AWS):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowGitHubActionsOIDC",
    "Effect": "Allow",
    "Principal": {"Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"},
      "StringLike": {"token.actions.githubusercontent.com:sub": "repo:yaidEnterprise/yaid_dashboard:ref:refs/heads/prod"}
    }
  }]
}
```

A policy de permissão do deploy role (ações `amplify:*` no ARN do app) não muda — só a trust policy (quem pode assumir) e como a credencial chega (token OIDC do job em vez de bootstrap user).

## Verification

**Commands:**
- `npm test` -- expected: toda a suíte passa, incluindo os testes atualizados de `story-11-5` e `story-11-7`
- `actionlint .github/workflows/production.yml .github/jobs/deploy-amplify/action.yml` -- expected: sem erros de sintaxe/schema (se ausente, revisar o YAML manualmente)

**Manual checks (if no CLI):**
- Confirmar que nenhum arquivo do repo (código, testes, docs) ainda referencia `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` ou `AWS_SESSION_TOKEN` como secret de auth AWS

## Suggested Review Order

**Autenticação OIDC no composite (o core da mudança)**

- Ponto de entrada: bootstrap+session-token vira `role-to-assume` puro via GitHub OIDC.
  [`action.yml:109`](../../.github/jobs/deploy-amplify/action.yml#L109)

- `role-skip-session-tagging` mantido, mas comentário corrigido para não se auto-contradizer (achado de review).
  [`action.yml:115`](../../.github/jobs/deploy-amplify/action.yml#L115)

**Precondição no orquestrador**

- `permissions.id-token: write` é o que autoriza o runner a emitir o token OIDC do job.
  [`production.yml:90`](../../.github/workflows/production.yml#L90)

- Comentário explica por que os 3 secrets de bootstrap desaparecem do `with:`.
  [`production.yml:109`](../../.github/workflows/production.yml#L109)

**Trust policy documentada (runbook)**

- JSON alvo com `Principal.Federated` + `Condition` no `sub` — aplicado pelo humano fora deste repo.
  [`production-cicd.md:249`](../../docs/deployment/production-cicd.md#L249)

- §2.2 agora explica que `permissions` no job substitui (não mescla) o default do workflow (achado de review).
  [`production-cicd.md:68`](../../docs/deployment/production-cicd.md#L68)

**Guards de regressão (testes)**

- Nenhum input/secret estático pode voltar a existir no composite ou no `with:` do job.
  [`workflow-job-deploy-amplify.test.mjs:99`](../../tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs#L99)

- `contents: read` precisa sobreviver junto com `id-token: write` no job (achado de review — permissions não mescla).
  [`workflow-job-deploy-amplify.test.mjs:135`](../../tests/unit/story-11-5/workflow-job-deploy-amplify.test.mjs#L135)

- Trust policy do runbook: `sub` precisa ser valor exato `repo:<org>/<repo>:ref:refs/heads/<branch>`, nunca wildcard (endurecido em review).
  [`production-cicd-contract.test.mjs:103`](../../tests/unit/story-11-7/production-cicd-contract.test.mjs#L103)

- Mesma invariante estrita replicada no teste de documentação operacional (antes só checava truthiness).
  [`documentacao-operacional.test.mjs:141`](../../tests/unit/story-11-7/documentacao-operacional.test.mjs#L141)

**Peripherals**

- Prosa da arquitetura atualizada de "OIDC indisponível" para o fluxo atual (item que ficou pendente na primeira passada).
  [`architecture.md:59`](../planning-artifacts/architecture.md#L59)
</content>
