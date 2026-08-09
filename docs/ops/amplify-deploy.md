# Deploy no AWS Amplify

> Story relacionada: [11.2 — amplify.yml e desabilitar auto-build](../../_bmad-output/implementation-artifacts/stories/11-2-amplify-yml-e-desabilitar-auto-build.md)
> Epic: 11 — Pipeline de CI/CD de Produção

## Visão geral

A aplicação é hospedada no **AWS Amplify** (Web Compute / SSR — Next.js App Router com rotas de
API, middleware de autenticação e renderização no servidor). A especificação de build usada pelo
Amplify é o arquivo [`amplify.yml`](../../amplify.yml) versionado na raiz do repositório.

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
    excludeFiles:
      - cache/**/*
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

**Por que `baseDirectory: .next` e não `out`:** o projeto usa rotas de API (`app/api/*`),
middleware de autenticação (`src/shared/middleware.ts` / `proxy.ts`) e SSR. Nenhuma dessas
capacidades sobrevive a um static export (`next export` / `output: "export"`). `next.config.ts`
não define `output: "export"` — o Amplify App **precisa** estar configurado como aplicação Next.js
Web Compute (SSR), não como site estático, ou o deploy quebra silenciosamente (rotas de API
somem, middleware não executa).

## Por que desabilitar o Auto Build na branch `prod`

Por padrão, um Amplify App com Auto Build habilitado dispara um novo build/deploy automaticamente
a cada push na branch conectada — **sem esperar por testes ou migrations**.

O Epic 11 introduz um pipeline de CI/CD via GitHub Actions com jobs sequenciais:

1. **Story 11.3** — job de testes (`npm ci` + `npm test`)
2. **Story 11.4** — job de deploy das migrations no Supabase Cloud
3. **Story 11.5** — job de deploy no Amplify (dispara o build/deploy explicitamente, via API/CLI,
   *depois* que os jobs anteriores passarem)
4. **Story 11.6** — job de smoke-test (`GET $PRODUCTION_URL/api/health`, ver Story 11.1)

Se o Auto Build do Amplify permanecer **habilitado**, o Amplify fará deploy de qualquer push à
branch `prod` **independentemente** do resultado dos jobs de teste e migration do GitHub Actions —
quebrando a garantia de "só publica se os testes passarem". A Story 11.5 assume o papel de
disparar o deploy manualmente (via GitHub Actions), então o Auto Build nativo do Amplify precisa
estar desligado para essa branch.

> **Pré-requisito para a Story 11.5.** Sem essa desabilitação, os dois mecanismos de deploy (Auto
> Build do Amplify + job explícito do GitHub Actions) competem entre si.

## Como desabilitar (ação manual — requer acesso ao Amplify App de produção)

> Esta é uma ação de configuração da infraestrutura AWS real. Ela **não** é executada
> automaticamente por nenhuma story do Epic 11 — precisa ser feita manualmente, uma única vez, por
> alguém com acesso ao Amplify App de produção (não há credenciais AWS no ambiente de
> desenvolvimento/sandbox deste projeto).

### Opção A — Console AWS

1. Acesse o [AWS Amplify Console](https://console.aws.amazon.com/amplify/).
2. Selecione o Amplify App do projeto.
3. Vá em **App settings → Branch settings**.
4. Localize a branch `prod`.
5. Edite as configurações da branch e desabilite o toggle **Auto build**.
6. Salve.

### Opção B — AWS CLI

Antes de alterar, confirme o App e o estado atual do Auto Build para evitar aplicar o comando no
App/branch errado:

```bash
aws amplify get-branch \
  --app-id <APP_ID> \
  --branch-name prod \
  --query 'branch.enableAutoBuild'
```

Se retornar `true`, prossiga com a desabilitação:

```bash
aws amplify update-branch \
  --app-id <APP_ID> \
  --branch-name prod \
  --no-enable-auto-build
```

Substitua `<APP_ID>` pelo ID do Amplify App (visível na URL do console ou via `aws amplify
list-apps`).

**Rollback:** se for necessário reverter (voltar ao comportamento de auto-deploy a cada push,
por exemplo durante um incidente ou debugging), o comando inverso é:

```bash
aws amplify update-branch \
  --app-id <APP_ID> \
  --branch-name prod \
  --enable-auto-build
```

### Verificação

Após desabilitar, confirme o novo estado com o mesmo `get-branch` acima (deve retornar `false`), e
então valide que um `git push` na branch `prod` **não** dispara mais um build automático no
Amplify Console. O próximo deploy só deve ocorrer quando o job da Story 11.5 (GitHub Actions)
disparar explicitamente um build via API/CLI do Amplify.
