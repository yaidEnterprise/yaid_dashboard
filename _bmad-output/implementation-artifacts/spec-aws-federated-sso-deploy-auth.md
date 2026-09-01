---
title: 'Suporte a bootstrap federado (SSO) na autenticação AWS do deploy'
type: 'feature'
created: '2026-09-01'
status: 'done'
context: []
baseline_commit: '4aeb6acb1555468da989bdfcf1749918fbc6cdc7'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O deploy passa a rodar na conta AWS da faculdade, cujo único acesso é via AWS IAM Identity Center (SSO), que gera credenciais temporárias (obrigatoriamente com `session_token`) obtidas por login interativo. O composite `deploy-amplify` hoje só aceita `aws-access-key-id`/`aws-secret-access-key` (modelo de IAM User permanente) para o bootstrap que faz `sts:AssumeRole` na role de deploy — sem campo para `session_token`, a autenticação falha.

**Approach:** Adicionar suporte a `aws-session-token` no bootstrap do composite `deploy-amplify`, mantendo o fluxo `bootstrap → sts:AssumeRole → role de deploy` inalterado. O bootstrap passa a ser as credenciais temporárias da sessão SSO, renovadas manualmente pelo humano (login `aws sso login` + atualização dos secrets) antes de cada deploy em `prod` — decisão explícita do usuário: aceitar login manual no momento do deploy em vez de automação total (OIDC indisponível na conta da faculdade).

## Boundaries & Constraints

**Always:** Preservar o fluxo `bootstrap → sts:AssumeRole → role de deploy` e os gates sequenciais `tests → deploy-supabase → deploy-amplify → smoke-test`; nunca logar/ecoar credenciais; falhar explicitamente (`::error::`) em vez de deixar a AWS CLI estourar erro opaco quando faltar o session token.

**Ask First:** Nada nesta story — as ações fora do repositório (atualizar os 3 secrets no GitHub Environment `prod`, e ajustar a trust policy da role de deploy na conta da faculdade para confiar no principal da sessão SSO) são de responsabilidade do humano, fora do escopo de código.

**Never:** Implementar OIDC; configurar runner self-hosted; tentar automatizar o refresh da sessão SSO (exige interação humana, não é possível a partir do CI).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sessão SSO válida | `AWS_SESSION_TOKEN` presente e não expirado | `configure-aws-credentials` assume a role de deploy normalmente; pipeline segue | N/A |
| Session token ausente | `AWS_SESSION_TOKEN` vazio/não setado | Job falha antes de chamar a AWS | `::error::` explícito citando o secret ausente |
| Session token expirado | Sessão SSO expirada no momento do push | `AssumeRole` falha na autenticação | Erro da AWS propaga; humano renova os secrets e reexecuta o job manualmente |

</frozen-after-approval>

## Code Map

- `.github/jobs/deploy-amplify/action.yml` -- composite que autentica via bootstrap + AssumeRole; precisa do input/threading de `aws-session-token` e validação fail-fast
- `.github/workflows/production.yml` -- orquestrador que passa os secrets ao composite; precisa passar `AWS_SESSION_TOKEN`

## Tasks & Acceptance

**Execution:**
- [x] `.github/jobs/deploy-amplify/action.yml` -- adicionar input `aws-session-token` (required: false) -- necessário para credenciais temporárias de SSO, que sempre incluem session token
- [x] `.github/jobs/deploy-amplify/action.yml` -- adicionar step de validação antes de `configure-aws-credentials` que falha com `::error::` se `aws-session-token` estiver vazio -- evita erro opaco da AWS CLI e aponta a causa raiz (secret não renovado)
- [x] `.github/jobs/deploy-amplify/action.yml` -- passar `aws-session-token: ${{ inputs.aws-session-token }}` para o step `aws-actions/configure-aws-credentials@v4` -- é o campo que falta para autenticar com credenciais temporárias
- [x] `.github/jobs/deploy-amplify/action.yml` -- atualizar comentários (topo do arquivo e do step de autenticação) descrevendo o bootstrap como sessão federada SSO temporária, não mais IAM User permanente
- [x] `.github/workflows/production.yml` -- adicionar `aws-session-token: ${{ secrets.AWS_SESSION_TOKEN }}` no `with:` do job `deploy-amplify` -- sem isso o novo input do composite nunca recebe valor
- [x] `.github/workflows/production.yml` -- atualizar comentário do job `deploy-amplify` explicando que os 3 secrets AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) vêm de uma sessão SSO renovada manualmente antes de cada release em `prod`

**Acceptance Criteria:**
- Given `AWS_SESSION_TOKEN` configurado com uma sessão SSO válida, when o workflow `production.yml` roda o job `deploy-amplify`, then `configure-aws-credentials` autentica com access key + secret key + session token e assume `AWS_DEPLOY_ROLE_ARN` com sucesso.
- Given `AWS_SESSION_TOKEN` vazio ou não setado, when o job `deploy-amplify` roda, then o job falha no step de validação com `::error::` explícito, antes de qualquer chamada à AWS.
- Given a sessão SSO expirou desde a última renovação manual, when `deploy-amplify` tenta assumir a role, then a autenticação falha na AWS (erro de token expirado) e o humano precisa renovar os secrets e reexecutar manualmente.

## Design Notes

**Role chaining (limite de 1h):** ao assumir uma role a partir de credenciais já temporárias (sessão SSO), a AWS limita a duração da sessão resultante a no máximo 1 hora, independente da duração máxima configurada na role de deploy. O `configure-aws-credentials@v4` já usa 1h como padrão de `role-duration-seconds`, então nenhuma mudança de código é necessária — apenas ciente de que aumentar esse valor não terá efeito na prática com bootstrap federado.

**Fora do repositório (ação humana, não implementada aqui):** a trust policy da role de deploy na conta da faculdade precisa confiar no principal da sessão SSO (a role de permission-set do Identity Center), não mais no ARN do IAM User antigo. Os 3 secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) precisam ser atualizados manualmente no GitHub Environment `prod` antes de cada deploy, via `aws sso login` + `aws configure export-credentials`.

## Verification

**Commands:**
- `actionlint .github/workflows/production.yml .github/jobs/deploy-amplify/action.yml` -- expected: sem erros de sintaxe/schema nos workflows editados (se `actionlint` não estiver instalado, validar YAML manualmente)

**Manual checks (if no CLI):**
- Revisar visualmente que o novo input/step não quebra a ordem dos steps existentes no composite
- Confirmar que os secrets `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN` estão documentados como oriundos de sessão SSO nos comentários atualizados

## Suggested Review Order

**Bootstrap federado (novo modelo de credenciais)**

- Entrada: comentário explica por que o bootstrap deixou de ser IAM User permanente e virou sessão SSO temporária.
  [`action.yml:26`](../../.github/jobs/deploy-amplify/action.yml#L26)

- Novo input `aws-session-token`, `required: false` de propósito — validado em runtime, não no schema.
  [`action.yml:68`](../../.github/jobs/deploy-amplify/action.yml#L68)

- Descrições de `aws-access-key-id`/`aws-secret-access-key` atualizadas para refletir a origem federada (patch pós-revisão).
  [`action.yml:63`](../../.github/jobs/deploy-amplify/action.yml#L63)

**Fail-fast na ausência de session token**

- Step novo falha explicitamente antes de chamar a AWS se o token estiver ausente ou só espaço em branco.
  [`action.yml:121`](../../.github/jobs/deploy-amplify/action.yml#L121)

- `configure-aws-credentials` passa a receber o session token junto com access key/secret key.
  [`action.yml:146`](../../.github/jobs/deploy-amplify/action.yml#L146)

**Wiring no orquestrador**

- `production.yml` passa `AWS_SESSION_TOKEN` ao composite e documenta a renovação manual pré-deploy.
  [`production.yml:99`](../../.github/workflows/production.yml#L99)

- Secret efetivamente encaminhado ao `with:` do job `deploy-amplify`.
  [`production.yml:110`](../../.github/workflows/production.yml#L110)
</content>
