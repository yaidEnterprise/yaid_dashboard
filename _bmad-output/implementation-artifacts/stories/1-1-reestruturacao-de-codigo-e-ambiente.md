# Story 1.1: Reestruturação de Código e Ambiente

Status: done

## Story

Como desenvolvedor,
Quero migrar a codebase para a estrutura `src/` com path aliases e environments validados no boot,
Para que todo desenvolvimento subsequente siga o padrão arquitetural estabelecido sem ambiguidade.

## Acceptance Criteria

1. **Given** o projeto Next.js existente com módulos em `modules/` (raiz)
   **When** a reestruturação é aplicada
   **Then** o `tsconfig.json` contém path aliases `@/modules/*` → `src/modules/*` e `@/shared/*` → `src/shared/*`

2. **And** os módulos `company`, `company-app` e `proof-request` estão em `src/modules/` seguindo a convenção `{action}_{feature}_{usecase|controller|presenter|viewmodel}.ts`

3. **And** `src/shared/environments.ts` é o único arquivo que lê `process.env`, exporta config tipada e lança erro no boot em `PROD`/`HOMOLOG` se `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY` ou `BLOCKCHAIN_CONTRACT_ADDRESS` estiverem ausentes; em `DOTENV`/`DEV`, getters dependentes falham apenas quando usados

4. **And** as pastas `app/(dashboard)/apps/novo/` e `app/onboarding/` são removidas da codebase

5. **And** todos os fluxos existentes (login, listagem de apps, listagem de proof_requests, tela coringa básica) continuam funcionando sem regressão após a migração

## Tasks / Subtasks

- [x] Task 1: Atualizar `tsconfig.json` com path aliases (AC: #1)
  - [x] Adicionar `"@/modules/*": ["./src/modules/*"]` antes de `"@/*"`
  - [x] Adicionar `"@/shared/*": ["./src/shared/*"]` antes de `"@/*"`
  - [x] Manter `"@/*": ["./*"]` para cobrir `components/`, `utils/`, `app/`, etc.

- [x] Task 2: Migrar `shared/` (raiz) → `src/shared/` (AC: #3, #5)
  - [x] Criar `src/shared/environments.ts` baseado em `shared/config/env.ts` (ver dev notes sobre mudanças)
  - [x] Mover `shared/errors/AppError.ts` → `src/shared/errors/AppError.ts`
  - [x] Mover `shared/http/requireAuthenticatedUser.ts` → `src/shared/http/requireAuthenticatedUser.ts` (atualizar import de `@/lib/supabase/server` para `@/shared/clients/supabase/server`)
  - [x] Mover `shared/http/getApiKeyFromRequest.ts` → `src/shared/http/getApiKeyFromRequest.ts`
  - [x] Mover `shared/http/handleHttpError.ts` → `src/shared/http/handleHttpError.ts`

- [x] Task 3: Migrar `lib/` → `src/shared/clients/supabase/` e `utils/` (AC: #5)
  - [x] Mover `lib/supabase/client.ts` → `src/shared/clients/supabase/client.ts`
  - [x] Mover `lib/supabase/server.ts` → `src/shared/clients/supabase/server.ts` (atualizar import de `@/shared/config/env` para `@/shared/environments`)
  - [x] Mover `lib/supabase/admin.ts` → `src/shared/clients/supabase/admin.ts`
  - [x] Mover `lib/supabase/proxy.ts` → `src/shared/clients/supabase/proxy.ts`
  - [x] Mover `lib/utils.ts` → `utils/utils.ts` (o `cn()` helper)
  - [x] Mover `lib/apps-store.ts` → `utils/apps-store.ts` (localStorage store transitório — será removido na Story 2.1)

- [x] Task 4: Migrar shared domain para `src/shared/domain/` (AC: #2)
  - [x] `modules/company/domain/entities/Company.ts` → `src/shared/domain/entities/Company.ts`
  - [x] `modules/company/domain/enums/CompanyStatus.ts` → `src/shared/domain/enums/CompanyStatus.ts`
  - [x] `modules/company/domain/repositories/CompanyRepository.ts` → `src/shared/domain/interfaces/repositories/CompanyRepository.ts`
  - [x] `modules/company-app/domain/entities/CompanyApp.ts` → `src/shared/domain/entities/CompanyApp.ts`
  - [x] `modules/company-app/domain/enums/CompanyAppEnvironment.ts` → `src/shared/domain/enums/CompanyAppEnvironment.ts`
  - [x] `modules/company-app/domain/enums/CompanyAppStatus.ts` → `src/shared/domain/enums/CompanyAppStatus.ts`
  - [x] `modules/company-app/domain/repositories/CompanyAppRepository.ts` → `src/shared/domain/interfaces/repositories/CompanyAppRepository.ts`
  - [x] `modules/company-app/domain/services/ApiKeyHasher.ts` → `src/shared/domain/interfaces/ApiKeyHasher.ts`
  - [x] `modules/proof-request/domain/entities/ProofRequest.ts` → `src/shared/domain/entities/ProofRequest.ts`
  - [x] `modules/proof-request/domain/entities/ProofSession.ts` → `src/shared/domain/entities/ProofSession.ts`
  - [x] `modules/proof-request/domain/enums/ProofRequestStatus.ts` → `src/shared/domain/enums/ProofRequestStatus.ts`
  - [x] `modules/proof-request/domain/enums/ProofSessionStatus.ts` → `src/shared/domain/enums/ProofSessionStatus.ts`
  - [x] `modules/proof-request/domain/repositories/ProofRequestRepository.ts` → `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts`
  - [x] `modules/proof-request/domain/repositories/ProofSessionRepository.ts` → `src/shared/domain/interfaces/repositories/ProofSessionRepository.ts`

- [x] Task 5: Migrar shared infra para `src/shared/infra/` (AC: #2)
  - [x] `modules/company/infra/mappers/CompanyMapper.ts` → `src/shared/infra/dto/CompanyMapper.ts`
  - [x] `modules/company/infra/repositories/SupabaseCompanyRepository.ts` → `src/shared/infra/repositories/SupabaseCompanyRepository.ts`
  - [x] `modules/company-app/infra/mappers/CompanyAppMapper.ts` → `src/shared/infra/dto/CompanyAppMapper.ts`
  - [x] `modules/company-app/infra/repositories/SupabaseCompanyAppRepository.ts` → `src/shared/infra/repositories/SupabaseCompanyAppRepository.ts`
  - [x] `modules/company-app/infra/services/Sha256ApiKeyHasher.ts` → `src/shared/infra/providers/Sha256ApiKeyHasher.ts`
  - [x] `modules/proof-request/infra/mappers/ProofRequestMapper.ts` → `src/shared/infra/dto/ProofRequestMapper.ts`
  - [x] `modules/proof-request/infra/mappers/ProofSessionMapper.ts` → `src/shared/infra/dto/ProofSessionMapper.ts`
  - [x] `modules/proof-request/infra/repositories/SupabaseProofRequestRepository.ts` → `src/shared/infra/repositories/SupabaseProofRequestRepository.ts`
  - [x] `modules/proof-request/infra/repositories/SupabaseProofSessionRepository.ts` → `src/shared/infra/repositories/SupabaseProofSessionRepository.ts`

- [x] Task 6: Migrar módulos para `src/modules/` com nova convenção de nomenclatura (AC: #2)
  - [x] Módulo `company`: criar `src/modules/company/app/` com:
    - `create_company_usecase.ts`, `create_company_controller.ts`, `create_company_presenter.ts`, `create_company_viewmodel.ts`
    - `get_my_company_usecase.ts`, `get_my_company_controller.ts`, `get_my_company_presenter.ts`, `get_my_company_viewmodel.ts`
  - [x] Módulo `company-app`: criar `src/modules/company-app/app/` com:
    - `create_company_app_usecase.ts`, `_controller.ts`, `_presenter.ts`, `_viewmodel.ts`
    - `list_company_apps_usecase.ts`, `_controller.ts`, `_presenter.ts`, `_viewmodel.ts`
    - `get_company_app_usecase.ts`, `_controller.ts`, `_presenter.ts`, `_viewmodel.ts`
    - `update_company_app_usecase.ts`, `_controller.ts`, `_presenter.ts`, `_viewmodel.ts`
  - [x] Módulo `proof-request`: criar `src/modules/proof-request/app/` com:
    - `create_proof_request_*.ts`, `list_proof_requests_*.ts`, `get_proof_request_*.ts`
  - [x] Módulo `proof-session`: criar `src/modules/proof-session/app/` com:
    - `get_proof_session_*.ts`

- [x] Task 7: Atualizar todos os route handlers para usar novos caminhos (AC: #5)
  - [x] `app/api/company-apps/route.ts` → importar de `@/modules/company-app/app/`
  - [x] `app/api/company-apps/[appId]/route.ts` → importar de `@/modules/company-app/app/`
  - [x] `app/api/companies/route.ts` → importar de `@/modules/company/app/`
  - [x] `app/api/companies/me/route.ts` → importar de `@/modules/company/app/`
  - [x] `app/api/proof-requests/route.ts` → importar de `@/modules/proof-request/app/`
  - [x] `app/api/proof-requests/[requestId]/route.ts` → importar de `@/modules/proof-request/app/`
  - [x] `app/api/proof-sessions/[sessionToken]/route.ts` → importar de `@/modules/proof-session/app/`
  - [x] `app/api/auth/sign-out/route.ts` → atualizar imports de `@/shared/clients/supabase/server`
  - [x] `proxy.ts` → `@/lib/supabase/proxy` → `@/shared/clients/supabase/proxy`
  - [x] Todos os imports `@/lib/utils` → `@/utils/utils` (components/ e app/)
  - [x] Todos os imports `@/lib/apps-store` → `@/utils/apps-store`

- [x] Task 8: Remover pastas obsoletas (AC: #4)
  - [x] Deletar `app/(dashboard)/apps/novo/`
  - [x] Deletar `app/onboarding/`
  - [x] Deletar `modules/` (raiz)
  - [x] Deletar `shared/` (raiz)
  - [x] Deletar `lib/`

- [x] Task 9: Verificar que `npm run build` passa sem erros (AC: #5)
  - [x] Rodar `npx tsc --noEmit` para verificar tipos — zero erros

### Review Findings

- [x] [Review][Patch] Clients Supabase ainda leem `process.env` fora de `src/shared/environments.ts` [`src/shared/clients/supabase/client.ts:5`]
- [x] [Review][Patch] Build documentado/local falha porque as novas envs obrigatórias não foram refletidas no ambiente de exemplo [`./.env.local.example:1`]

## Dev Notes

### Mudanças Críticas em `src/shared/environments.ts`

O arquivo atual `shared/config/env.ts` usa a classe `Environments` com método `getEnvs()` estático. Manter esse padrão ao migrar para `src/shared/environments.ts`. As mudanças são:

1. **Remover as três envs com TBD**: `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY` devem existir em `Environments`. Em `PROD`/`HOMOLOG`, elas são obrigatórias no boot; em `DOTENV`/`DEV`, fluxos que não usam issuer/blockchain podem rodar sem elas, e o getter específico lança erro quando usado.

2. **Atualizar importações internas**: O arquivo atual importa repositórios de `@/modules/...` — após migração deve importar de `@/modules/...` (mesmos paths, mas agora resolvendo para `src/modules/`).

3. **Não criar `env.test` sem as três novas envs**: Adicionar valores de teste para `ISSUER_PRIVATE_KEY`, `WEBHOOK_SIGNING_PRIVATE_KEY`, `BLOCKCHAIN_WALLET_PRIVATE_KEY` no `TEST_ENV` mock.

**ATENÇÃO**: `src/shared/environments.ts` é o ÚNICO arquivo que pode ler `process.env`. Após a migração, não deve existir nenhum outro arquivo lendo `process.env` diretamente.

### Estratégia de Migração para Evitar Regressões

**Abordagem recomendada**: Migrar por partes, validando com `npx tsc --noEmit` a cada bloco:
1. Criar toda a estrutura `src/` primeiro (copiando arquivos)
2. Atualizar todos os imports internos dos arquivos copiados
3. Atualizar `tsconfig.json` DEPOIS que `src/` está completo
4. Atualizar os route handlers e pages para usar os novos caminhos
5. Deletar as pastas antigas
6. Verificar build

**Risco principal**: Circular imports ao mover `environments.ts` que importa repositórios que importam `shared/domain`. Resolução: `src/shared/environments.ts` usa dynamic `import()` para os repositórios (como já faz o arquivo atual com `await import(...)`).

### Mapeamento Exato de Nomenclatura dos Arquivos

Convenção da skill `nextjs-backend` (ver architecture.md, seção "Convenções de Nomenclatura"):
- Use Case: `{action}_{feature}_usecase.ts` → classe `{Action}{Feature}UseCase`
- ViewModel: `{action}_{feature}_viewmodel.ts` → função/objeto que define o shape de saída
- Controller: `{action}_{feature}_controller.ts` → classe `{Action}{Feature}Controller`
- Presenter: `{action}_{feature}_presenter.ts` → função `make{Action}{Feature}Controller()` (composition root)

**Mapeamento completo dos arquivos existentes**:

| Atual | Novo caminho em `src/` |
|-------|----------------------|
| `modules/company/application/usecases/CreateCompanyUseCase.ts` | `src/modules/company/app/create_company_usecase.ts` |
| `modules/company/application/usecases/GetMyCompanyUseCase.ts` | `src/modules/company/app/get_my_company_usecase.ts` |
| `modules/company/application/dtos/CreateCompanyDTO.ts` | Dividir: tipos de input ficam no usecase, tipos de output viram `create_company_viewmodel.ts` e `get_my_company_viewmodel.ts` |
| `modules/company/presentation/controllers/CreateCompanyController.ts` | `src/modules/company/app/create_company_controller.ts` |
| `modules/company/presentation/controllers/GetMyCompanyController.ts` | `src/modules/company/app/get_my_company_controller.ts` |
| `modules/company/factories/makeCompanyControllers.ts` | Dividir em `create_company_presenter.ts` e `get_my_company_presenter.ts` |
| `modules/company-app/application/usecases/CreateCompanyAppUseCase.ts` | `src/modules/company-app/app/create_company_app_usecase.ts` |
| `modules/company-app/application/usecases/GetCompanyAppUseCase.ts` | `src/modules/company-app/app/get_company_app_usecase.ts` |
| `modules/company-app/application/usecases/ListCompanyAppsUseCase.ts` | `src/modules/company-app/app/list_company_apps_usecase.ts` |
| `modules/company-app/application/usecases/UpdateCompanyAppUseCase.ts` | `src/modules/company-app/app/update_company_app_usecase.ts` |
| `modules/company-app/application/dtos/CompanyAppDTOs.ts` | Schemas Zod ficam no controller, tipos de output viram `_viewmodel.ts` |
| `modules/company-app/presentation/controllers/CompanyAppControllers.ts` | Dividir em arquivos individuais `{action}_company_app_controller.ts` |
| `modules/company-app/factories/makeCompanyAppControllers.ts` | Dividir em arquivos individuais `{action}_company_app_presenter.ts` |
| `modules/proof-request/application/usecases/CreateProofRequestUseCase.ts` | `src/modules/proof-request/app/create_proof_request_usecase.ts` |
| `modules/proof-request/application/usecases/GetProofRequestUseCase.ts` | `src/modules/proof-request/app/get_proof_request_usecase.ts` |
| `modules/proof-request/application/usecases/ListProofRequestsUseCase.ts` | `src/modules/proof-request/app/list_proof_requests_usecase.ts` |
| `modules/proof-request/application/usecases/GetProofSessionByTokenUseCase.ts` | `src/modules/proof-session/app/get_proof_session_usecase.ts` (módulo separado!) |
| `modules/proof-request/presentation/controllers/ProofRequestControllers.ts` | Dividir em arquivos individuais |
| `modules/proof-request/factories/makeProofRequestControllers.ts` | Dividir em arquivos individuais |

### Sobre o `CompanyAppEnvironment` Enum

O código atual tem `CompanyAppEnvironment` (`dev | homol | prod`) no schema Zod de criação de app. O PRD declara explicitamente que `environment` por app está **fora do escopo do MVP** ("No MVP cada app é apenas um app — não há campo environment"). Porém o AC desta story diz "todos os fluxos existentes continuam funcionando" — então **manter o comportamento atual** durante esta migração. Não remover o enum nesta story. A remoção do `environment` é uma decisão para revisão futura.

### Sobre o `apps-store.ts` (localStorage)

`lib/apps-store.ts` é usado por `app/(dashboard)/apps/page.tsx` e possivelmente outras páginas do dashboard. A listagem de apps atual usa localStorage em vez da API real. Esta story **não altera esse comportamento** — apenas move o arquivo de `lib/apps-store.ts` para `utils/apps-store.ts`. A migração para a API real acontece na Story 2.1.

### Importações no `app/(dashboard)/apps/page.tsx`

Este arquivo importa `@/lib/apps-store` — atualizar para `@/utils/apps-store`. Também importa `@/components/feedback/environment-badge` (EnvBadge) — este componente usa o conceito de `environment`, que é mantido nesta story.

### Estrutura `src/` a Criar (árvore de diretórios)

```
src/
  modules/
    company/
      app/
        create_company_usecase.ts
        create_company_viewmodel.ts
        create_company_controller.ts
        create_company_presenter.ts
        get_my_company_usecase.ts
        get_my_company_viewmodel.ts
        get_my_company_controller.ts
        get_my_company_presenter.ts
    company-app/
      app/
        create_company_app_usecase.ts
        create_company_app_viewmodel.ts
        create_company_app_controller.ts
        create_company_app_presenter.ts
        list_company_apps_usecase.ts
        list_company_apps_viewmodel.ts
        list_company_apps_controller.ts
        list_company_apps_presenter.ts
        get_company_app_usecase.ts
        get_company_app_viewmodel.ts
        get_company_app_controller.ts
        get_company_app_presenter.ts
        update_company_app_usecase.ts
        update_company_app_viewmodel.ts
        update_company_app_controller.ts
        update_company_app_presenter.ts
    proof-request/
      app/
        create_proof_request_usecase.ts
        create_proof_request_viewmodel.ts
        create_proof_request_controller.ts
        create_proof_request_presenter.ts
        list_proof_requests_usecase.ts
        list_proof_requests_viewmodel.ts
        list_proof_requests_controller.ts
        list_proof_requests_presenter.ts
        get_proof_request_usecase.ts
        get_proof_request_viewmodel.ts
        get_proof_request_controller.ts
        get_proof_request_presenter.ts
    proof-session/
      app/
        get_proof_session_usecase.ts
        get_proof_session_viewmodel.ts
        get_proof_session_controller.ts
        get_proof_session_presenter.ts
  shared/
    environments.ts                  # único lugar que lê process.env
    errors/
      AppError.ts
    domain/
      entities/
        Company.ts
        CompanyApp.ts
        ProofRequest.ts
        ProofSession.ts
      enums/
        CompanyStatus.ts
        CompanyAppStatus.ts
        CompanyAppEnvironment.ts
        ProofRequestStatus.ts
        ProofSessionStatus.ts
      interfaces/
        repositories/
          CompanyRepository.ts
          CompanyAppRepository.ts
          ProofRequestRepository.ts
          ProofSessionRepository.ts
        ApiKeyHasher.ts
    infra/
      dto/
        CompanyMapper.ts
        CompanyAppMapper.ts
        ProofRequestMapper.ts
        ProofSessionMapper.ts
      repositories/
        SupabaseCompanyRepository.ts
        SupabaseCompanyAppRepository.ts
        SupabaseProofRequestRepository.ts
        SupabaseProofSessionRepository.ts
      providers/
        Sha256ApiKeyHasher.ts
    clients/
      supabase/
        client.ts
        server.ts
        admin.ts
    http/
      requireAuthenticatedUser.ts
      getApiKeyFromRequest.ts
      handleHttpError.ts
```

### tsconfig.json — Mudança Exata

```json
"paths": {
  "@/modules/*": ["src/modules/*"],
  "@/shared/*": ["src/shared/*"],
  "@/*": ["./*"]
}
```

**Ordem importa**: aliases mais específicos devem vir ANTES do genérico `@/*`.

### Regra de Ouro do `environments.ts`

Após esta story, fazer um grep por `process.env` em todo o projeto (exceto `src/shared/environments.ts` e arquivos de config de ferramentas como `next.config.ts`). Se aparecer em qualquer outro arquivo, é um bug que deve ser corrigido antes de marcar AC #3 como concluído.

```bash
grep -r "process\.env" --include="*.ts" --include="*.tsx" . \
  --exclude-dir=node_modules --exclude-dir=.next \
  | grep -v "src/shared/environments.ts" \
  | grep -v "next.config" \
  | grep -v ".eslintrc"
```

### Project Structure Notes

- Path alias `@/modules/*` e `@/shared/*` **devem vir antes** de `@/*` no `tsconfig.json` para ter precedência correta no TypeScript resolver
- A pasta `shared/` na raiz e a pasta `modules/` na raiz podem coexistir temporariamente com `src/shared/` e `src/modules/` durante a migração, mas DEVEM ser deletadas ao final desta story
- O arquivo `proxy.ts` na raiz do projeto é o entrypoint de auth do Next.js 16. Não mover para `src/shared/clients/supabase/proxy.ts`; esse segundo arquivo é apenas o client/helper Supabase usado pela lógica compartilhada.
- A codebase atual não tem `src/` — este diretório deve ser criado do zero
- `utils/utils.ts` destino: o `utils/` na raiz provavelmente não existe ainda — criar o diretório antes de mover `lib/utils.ts`

### References

- [Architecture: Estrutura de Diretórios](../planning-artifacts/architecture.md#estrutura-de-diretórios)
- [Architecture: Módulos a Migrar](../planning-artifacts/architecture.md#módulos-a-migrar)
- [Architecture: Convenções de Nomenclatura](../planning-artifacts/architecture.md#convenções-de-nomenclatura)
- [Architecture: Regras Obrigatórias](../planning-artifacts/architecture.md#regras-obrigatórias-para-todos-os-agentes)
- [Architecture: Responsabilidades por Camada](../planning-artifacts/architecture.md#responsabilidades-por-camada)
- [PRD: Requisitos Adicionais — path aliases e environments.ts](../planning-artifacts/prd.md#additional-requirements)
- [Código atual: `shared/config/env.ts`](../../shared/config/env.ts)
- [Código atual: `modules/company-app/factories/makeCompanyAppControllers.ts`](../../modules/company-app/factories/makeCompanyAppControllers.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- tsconfig.json: primeiro tentou `"src/modules/*"` sem baseUrl — erro "Non-relative paths not allowed". Corrigido com `"./src/modules/*"` (relativo explícito, sem baseUrl).
- Componentes em `components/` também importavam `@/lib/utils` — detectado e corrigido durante Task 9.

### Completion Notes List

- Todas as 9 tarefas concluídas com `npx tsc --noEmit` passando sem erros.
- `src/shared/environments.ts` é agora o único ponto de leitura de `process.env`; `publicEnv` expõe `NEXT_PUBLIC_*` para browser/edge.
- Módulo `GetProofSessionByTokenUseCase` migrado para `src/modules/proof-session/app/` como `GetProofSessionUseCase` (novo módulo separado conforme arquitetura).
- `CompanyAppEnvironment` mantido pois AC #5 exige que todos os fluxos existentes continuem funcionando.

### File List

**Criados:**
- tsconfig.json (modificado)
- src/shared/environments.ts
- src/shared/errors/AppError.ts
- src/shared/http/requireAuthenticatedUser.ts
- src/shared/http/getApiKeyFromRequest.ts
- src/shared/http/handleHttpError.ts
- src/shared/clients/supabase/client.ts
- src/shared/clients/supabase/server.ts
- src/shared/clients/supabase/admin.ts
- src/shared/clients/supabase/proxy.ts
- src/shared/domain/entities/Company.ts
- src/shared/domain/entities/CompanyApp.ts
- src/shared/domain/entities/ProofRequest.ts
- src/shared/domain/entities/ProofSession.ts
- src/shared/domain/enums/CompanyStatus.ts
- src/shared/domain/enums/CompanyAppEnvironment.ts
- src/shared/domain/enums/CompanyAppStatus.ts
- src/shared/domain/enums/ProofRequestStatus.ts
- src/shared/domain/enums/ProofSessionStatus.ts
- src/shared/domain/interfaces/repositories/CompanyRepository.ts
- src/shared/domain/interfaces/repositories/CompanyAppRepository.ts
- src/shared/domain/interfaces/repositories/ProofRequestRepository.ts
- src/shared/domain/interfaces/repositories/ProofSessionRepository.ts
- src/shared/domain/interfaces/ApiKeyHasher.ts
- src/shared/infra/dto/CompanyMapper.ts
- src/shared/infra/dto/CompanyAppMapper.ts
- src/shared/infra/dto/ProofRequestMapper.ts
- src/shared/infra/dto/ProofSessionMapper.ts
- src/shared/infra/repositories/SupabaseCompanyRepository.ts
- src/shared/infra/repositories/SupabaseCompanyAppRepository.ts
- src/shared/infra/repositories/SupabaseProofRequestRepository.ts
- src/shared/infra/repositories/SupabaseProofSessionRepository.ts
- src/shared/infra/providers/Sha256ApiKeyHasher.ts
- src/modules/company/app/create_company_viewmodel.ts
- src/modules/company/app/create_company_usecase.ts
- src/modules/company/app/create_company_controller.ts
- src/modules/company/app/create_company_presenter.ts
- src/modules/company/app/get_my_company_viewmodel.ts
- src/modules/company/app/get_my_company_usecase.ts
- src/modules/company/app/get_my_company_controller.ts
- src/modules/company/app/get_my_company_presenter.ts
- src/modules/company-app/app/create_company_app_viewmodel.ts
- src/modules/company-app/app/create_company_app_usecase.ts
- src/modules/company-app/app/create_company_app_controller.ts
- src/modules/company-app/app/create_company_app_presenter.ts
- src/modules/company-app/app/list_company_apps_viewmodel.ts
- src/modules/company-app/app/list_company_apps_usecase.ts
- src/modules/company-app/app/list_company_apps_controller.ts
- src/modules/company-app/app/list_company_apps_presenter.ts
- src/modules/company-app/app/get_company_app_viewmodel.ts
- src/modules/company-app/app/get_company_app_usecase.ts
- src/modules/company-app/app/get_company_app_controller.ts
- src/modules/company-app/app/get_company_app_presenter.ts
- src/modules/company-app/app/update_company_app_viewmodel.ts
- src/modules/company-app/app/update_company_app_usecase.ts
- src/modules/company-app/app/update_company_app_controller.ts
- src/modules/company-app/app/update_company_app_presenter.ts
- src/modules/proof-request/app/create_proof_request_viewmodel.ts
- src/modules/proof-request/app/create_proof_request_usecase.ts
- src/modules/proof-request/app/create_proof_request_controller.ts
- src/modules/proof-request/app/create_proof_request_presenter.ts
- src/modules/proof-request/app/list_proof_requests_viewmodel.ts
- src/modules/proof-request/app/list_proof_requests_usecase.ts
- src/modules/proof-request/app/list_proof_requests_controller.ts
- src/modules/proof-request/app/list_proof_requests_presenter.ts
- src/modules/proof-request/app/get_proof_request_viewmodel.ts
- src/modules/proof-request/app/get_proof_request_usecase.ts
- src/modules/proof-request/app/get_proof_request_controller.ts
- src/modules/proof-request/app/get_proof_request_presenter.ts
- src/modules/proof-session/app/get_proof_session_viewmodel.ts
- src/modules/proof-session/app/get_proof_session_usecase.ts
- src/modules/proof-session/app/get_proof_session_controller.ts
- src/modules/proof-session/app/get_proof_session_presenter.ts
- utils/utils.ts
- utils/apps-store.ts

**Modificados:**
- app/api/companies/route.ts
- app/api/companies/me/route.ts
- app/api/company-apps/route.ts
- app/api/company-apps/[appId]/route.ts
- app/api/proof-requests/route.ts
- app/api/proof-requests/[requestId]/route.ts
- app/api/proof-sessions/[sessionToken]/route.ts
- app/api/auth/sign-out/route.ts
- proxy.ts
- app/(dashboard)/apps/page.tsx
- app/(dashboard)/apps/new/page.tsx
- app/(dashboard)/apps/[appId]/page.tsx
- app/(dashboard)/proof-requests/new/page.tsx
- app/sign-in/page.tsx
- components/api/code-block.tsx
- components/feedback/environment-badge.tsx
- components/feedback/status-badge.tsx
- components/layout/app-sidebar.tsx
- components/layout/page-header.tsx
- components/yaid/filter-popover.tsx
- components/yaid/metric-card.tsx

**Deletados:**
- app/(dashboard)/apps/novo/ (pasta completa)
- app/onboarding/ (pasta completa)
- modules/ (pasta raiz completa)
- shared/ (pasta raiz completa)
- lib/ (pasta raiz completa)
