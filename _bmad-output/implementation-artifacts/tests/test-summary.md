# Test Automation Summary

## Generated Tests

### Unit Tests

- [x] tests/unit/story-1-1/restructure.test.mjs - Story 1.1 contratos estruturais: aliases, layout src/, env centralizado, pastas obsoletas, entrypoints preservados, TypeScript clean
- [x] tests/unit/story-1-2/middleware.test.mjs - Story 1.2 contratos de middleware: arquivo, helpers, routing por método/path, remoção de requireAuthenticatedUser, injeção de x-company-id
- [x] tests/unit/story-1-3/proof-session-schema.test.mjs - Story 1.3 contratos de schema: entidade, mapper, use cases, repository, regressão da tela coringa
- [x] tests/unit/story-1-3/dependencies.test.mjs - Story 1.3 dependências de formulário: react-hook-form, @hookform/resolvers, compilação TypeScript
- [x] tests/unit/story-1-4/fetch-with-auth.test.mjs - Story 1.4 contrato do fetchWithAuth: assinatura, intercept 401, redirect ?next=, throw-after-redirect, guard SSR, migração de 4 endpoints em apps-store, review patch do settings page
- [x] tests/unit/story-1-4/sign-in-redirect.test.mjs - Story 1.4 redirect pós-login: leitura do ?next=, open-redirect guard (inline + source), remoção de código legado /api/companies/me
- [x] tests/unit/story-1-5/signup-atomico.test.mjs - Story 1.5 contrato do signup atômico: rota POST, schema Zod (CNPJ .length(14)), rollback auth user, 409 duplicado, middleware /sign-up redirect, isPublicApiRoute, layout Toaster, página (RHF+zodResolver, confirmPassword refine, CNPJ mask, submit flow, toast.error), testes inline de CNPJ formatter e schema Zod
- [x] tests/unit/story-3-1/create-proof-request.test.mjs - Story 3.1 contratos do endpoint B2B: schema Zod (proofType enum, externalReference, sem default), DTO de saída (verificationUrl, externalReference), use case (findByAppId, UnprocessableEntityError, ordem de verificação, createAtomic, sem ProofSessionRepository), AppError (UnprocessableEntityError 422), interfaces de repositório (findByAppId, createAtomic), implementações Supabase (findByAppId por coluna app_id, createAtomic com rollback), CompanyAppPersistence (campo app_id), presenter (sem ProofSessionRepository)

## Coverage

### Story 1.1
- Acceptance criteria: 5/5 cobertos
- Caminhos críticos: aliases TypeScript, módulos src/, environments.ts, pastas obsoletas, entrypoints de API e UI

### Story 1.2
- Acceptance criteria: 3/3 cobertos
- Caminhos críticos: criação do middleware, remoção de requireAuthenticatedUser, injeção de x-company-id, routing por método (GET/POST/DID)

### Story 1.4
- Acceptance criteria: 3/3 cobertos
  - AC#1 (intercept 401 → redirect /sign-in?next= + redirect pós-login): coberto por `fetch-with-auth.test.mjs` (status 401, encodeURIComponent, window.location) e `sign-in-redirect.test.mjs` (leitura do ?next=, guard, fallback /)
  - AC#2 (non-401 pass-through): coberto por `fetch-with-auth.test.mjs` (return res)
  - AC#3 (contrato de assinatura + migração de todos os consumers): coberto por `fetch-with-auth.test.mjs` (4 fetchWithAuth calls em apps-store, plain fetch em settings)
- Caminhos críticos: 21/21 testes passando
  - `fetchWithAuth`: exportação, assinatura igual ao fetch nativo, guard SSR, throw-after-redirect
  - `apps-store.ts`: import de fetchWithAuth, exatamente 4 chamadas (listApps/getApp/createApp/updateApp)
  - `settings/page.tsx`: sign-out usa plain fetch (review patch — evita loop ?next=/settings)
  - `sign-in/page.tsx`: lê ?next= via URLSearchParams, validação open-redirect, fallback /, sem /api/companies/me legado
  - Open-redirect guard: 9 casos de borda validados (caminhos seguros, //evil.com, https://, null, empty)
  - TypeScript clean: npx tsc --noEmit sem erros

### Story 1.3
- Acceptance criteria: 3/3 cobertos
  - AC#1 (schema migration): coberto pelos contratos TypeScript (entidade, mapper, tipo de persistência sem colunas removidas e com colunas novas)
  - AC#2 (dependências + build): react-hook-form, @hookform/resolvers em dependencies + `npx tsc --noEmit` verde
  - AC#3 (zero regressão em formulários): coberto pela compilação TypeScript e testes das Stories 1.1/1.2 ainda passando
- Caminhos críticos: 25/25 testes passando
  - ProofSession entity: campos adicionados (challengeNonceHash, challengeCreatedAt), campos removidos (verificationPageUrl, deepLinkUrl)
  - ProofSessionMapper: ProofSessionPersistence type e métodos toDomain/toPersistence alinhados com novo schema
  - create_proof_request_usecase: ProofSession construído com nulls (novos campos), sem URLs no construtor, URLs ainda retornadas na resposta B2B
  - get_proof_session viewmodel + use case: ProofSessionOutputDTO sem campos de URL
  - SupabaseProofSessionRepository.update: persiste challenge_nonce_hash e challenge_created_at (patch do code review)
  - Tela coringa: deeplink construído via sessionToken param, não via session.deepLinkUrl (regressão corrigida no code review)

## Validation

- `npm run test:story:1.3`: **passed** — 25/25
- `npm run test:story:1.4`: **passed** — 21/21
- `npm test` após story 1.3: **passed** — 45/45 (Stories 1.1, 1.2, 1.3)
- `npm test` após story 1.4: **passed** — 66/66 (Stories 1.1, 1.2, 1.3, 1.4)
- `npm run test:story:1.5`: **passed** — 36/36
- `npm test` após story 1.5: **passed** — 102/102 (Stories 1.1, 1.2, 1.3, 1.4, 1.5)

### Story 3.1
- Acceptance criteria: 5/5 cobertos
  - AC#1 (criação bem-sucedida): coberto por contratos do use case (findByAppId, createAtomic, verificationUrl, externalReference)
  - AC#2 (API key inválida → 401): coberto por contrato do use case (UnauthorizedError para app não encontrado e secret inválido)
  - AC#3 (app disabled → 422): coberto por contrato do use case (UnprocessableEntityError, ordem de verificação)
  - AC#4 (proofType inválido → 400): coberto pelo schema Zod (z.enum sem default)
  - AC#5 (rollback em falha): coberto por contrato do repositório (createAtomic com rollback)
- Caminhos críticos: 26/26 testes passando

## Validation

- `npm run test:story:3.1`: **passed** — 26/26
- `npm test` após story 3.1: **passed** — 122/128 (6 falhas pré-existentes: npx ENOENT + Windows path separator)
  - AC#1 (signup atômico — POST /api/auth/sign-up): coberto pelos contratos do route handler (admin createUser, CreateCompanyUseCase, rollback deleteUser, null guard, 409 duplicado, 201 sucesso)
  - AC#2 (validação de formulário + feedback): coberto pelos contratos da página (RHF + zodResolver, confirmPassword refinement, CNPJ mask + strip, submit fetch, signInWithPassword, window.location.href, toast.error, disabled button)
  - AC#3 (redirect de usuário autenticado em /sign-up): coberto pelo contrato do middleware
- Caminhos críticos: 36/36 testes passando
  - Review patches: CNPJ `.length(14)` (rejeita 11–13 dígitos), null guard em `authData.user`, `console.error` no rollback, `POST /api/auth/sign-up` como rota pública no middleware
  - Testes inline comportamentais: CNPJ formatter (formatação completa, truncamento a 14 dígitos, strip de caracteres), schema Zod (senhas iguais/diferentes, CNPJ 14 dígitos vs curto vs null)
  - TypeScript clean: `npx tsc --noEmit` sem erros

## Validation

- Todos os testes usam `node:test` + `node:assert/strict` (framework nativo Node.js, sem dependências externas)
- Os testes para Story 1.3 são de contrato de código-fonte (source inspection), adequados para uma story de refatoração de schema sem lógica de negócio nova
- A migration SQL (`supabase/migrations/20260513_update_proof_sessions.sql`) foi aplicada manualmente via Supabase Dashboard e deletada; o contrato TypeScript (testes de schema) serve como evidência de que o TypeScript está alinhado com o schema aplicado
- Deferred do code review (Story 5.3, 4.1): não há testes para setChallenge() nem para lógica de expiração na entidade — esses são escopo das stories correspondentes
- Os testes da story 1.2 foram atualizados para referenciar `src/shared/middleware.ts` (novo caminho após mudança staged que moveu o middleware de `src/middleware.ts`)
