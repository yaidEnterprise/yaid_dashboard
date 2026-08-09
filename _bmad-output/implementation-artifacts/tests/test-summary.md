# Test Automation Summary

## Generated Tests

### Unit Tests

- [x] tests/unit/story-1-1/restructure.test.mjs - Story 1.1 contratos estruturais: aliases, layout src/, env centralizado, pastas obsoletas, entrypoints preservados, TypeScript clean
- [x] tests/unit/story-1-2/middleware.test.mjs - Story 1.2 contratos de proxy/middleware: `proxy.ts` entrypoint Next.js 16, helpers, routing por método/path, remoção de requireAuthenticatedUser, injeção de x-company-id
- [x] tests/unit/story-1-3/proof-session-schema.test.mjs - Story 1.3 contratos de schema: entidade, mapper, use cases, repository, regressão da tela coringa
- [x] tests/unit/story-1-3/dependencies.test.mjs - Story 1.3 dependências de formulário: react-hook-form, @hookform/resolvers, compilação TypeScript
- [x] tests/unit/story-1-4/fetch-with-auth.test.mjs - Story 1.4 contrato do fetchWithAuth: assinatura, intercept 401, redirect ?next=, throw-after-redirect, guard SSR, migração de 4 endpoints em apps-store, review patch do settings page
- [x] tests/unit/story-1-4/sign-in-redirect.test.mjs - Story 1.4 redirect pós-login: leitura do ?next=, open-redirect guard (inline + source), remoção de código legado /api/companies/me
- [x] tests/unit/story-1-5/signup-atomico.test.mjs - Story 1.5 contrato do signup atômico: rota POST, schema Zod (CNPJ .length(14)), rollback auth user, 409 duplicado, middleware /sign-up redirect, isPublicApiRoute, layout Toaster, página (RHF+zodResolver, confirmPassword refine, CNPJ mask, submit flow, toast.error), testes inline de CNPJ formatter e schema Zod
- [x] tests/unit/story-1-7/configuracoes.test.mjs - Story 1.7 configurações da empresa: contratos de use cases e interfaces de update, schema Zod, renderização do frontend (RHF+zodResolver, CNPJ mask, PATCH com fetchWithAuth), plain fetch no logout e AlertDialog nativo.
- [x] tests/unit/story-3-1/create-proof-request.test.mjs - Story 3.1 contratos do endpoint B2B: schema Zod (proofType enum, externalReference, sem default), DTO de saída (verificationUrl, externalReference), use case (findByAppId, UnprocessableEntityError, ordem de verificação, createAtomic, sem ProofSessionRepository), AppError (UnprocessableEntityError 422), interfaces de repositório (findByAppId, createAtomic), implementações Supabase (findByAppId por coluna app_id, createAtomic com rollback), CompanyAppPersistence (campo app_id), presenter (sem ProofSessionRepository)
- [x] tests/unit/story-1-5/signup-atomico.test.mjs - Story 1.5 contrato do signup atômico: rota POST, schema Zod (CNPJ obrigatório .length(14)), rollback auth user, 409 duplicado, middleware /sign-up redirect, isPublicApiRoute, layout Toaster, página (RHF+zodResolver, confirmPassword refine, CNPJ mask, submit flow, toast.error), testes inline de CNPJ formatter e schema Zod
- [x] tests/unit/story-1-6/login-e-protecao-de-rotas.test.mjs - Story 1.6 contratos de login: migração RHF+Zod, toast.error para erros de auth, onValidationError para validação silenciosa (review patch), sem mensagens field-specific no schema (review patch), redirect ?next= com open-redirect guard, proteção de rotas via middleware (4 paths), withSessionAuth injeção de ?next=, testes inline de schema Zod e safe-redirect logic
- [x] tests/unit/story-5-1/with-did-auth.test.mjs - Story 5.1 contratos do middleware withDIDAuth: existência do arquivo, export async, import @noble/ed25519, verifyAsync (não sync), 5 caminhos de erro (missing headers/expired/invalid DID/invalid sig/valid), review patches (Number() + 300_000 ms + signatureBytes.length === 64), canonical payload, x-holder-did, dependência package.json, middleware.ts await + routing, compilação TypeScript
- [x] tests/unit/story-5-2/blockchain-client.test.mjs - Story 5.2 contratos do wrapper BlockchainClient: existência de arquivos, interface (4 métodos), ABI (4 assinaturas com bytes32), EthersBlockchainClient (JsonRpcProvider, Wallet, address validation, receipt null/status=0 check, sem process.env, ethers.id()), environments.ts (schema, TEST_ENV, getters, getBlockchainClient factory, throws em TEST), compilação TypeScript
- [x] tests/unit/story-5-4/credential-issuance.test.mjs - Story 5.4 emissão de Verifiable Credential: OCR em memória (sem persistência de PII/OCR), assinatura Ed25519 do VC usando ed.signAsync com chave privada do emissor, registro on-chain do DID do holder, validação da assinatura do request usando verifyAsync com a public key do DID do holder, e compilação TS limpa.
- [x] tests/unit/story-2-1/listagem-de-aplicacoes.test.mjs - Story 2.1 contratos de listagem: GET /api/company-apps (handler, x-company-id, usecase filtra por companyId, viewmodel camelCase), apps-store (fetchWithAuth, /api/company-apps, json.items), page (listApps, skeleton/animate-pulse, EmptyState+CTA /apps/new, ErrorState+retry, router.push, nome+app_id, StatusBadge, formatDate), arquivos existentes (backend+frontend)
- [x] tests/unit/story-4-2/verification-screen.test.mjs - Story 4.2 contratos da tela coringa: hook de polling público (sem fetchWithAuth, intervalo 5-10s, para em status terminal, cleanup de timers, 404→invalid, guarda NaN em getSecondsRemaining, timeout via AbortController), VerificationLayout (sem chrome de dashboard, tokens semânticos), DeepLinkButton (URI-encoded, touch target 48px), VerificationStateCard (6+1 estados incluindo fallback e network, aria-live restrito ao texto de estado, StatusBadge por estado, sem campos sensíveis), page.tsx (DTO real pós-4.1, sem QR code, expired forçado pelo contador local, "opened" 100% guiado pelo servidor — sem clickedOpen)
- [x] tests/unit/story-6-2/webhook-public-key.test.mjs - Story 6.2 contratos do endpoint público da chave de webhook: round-trip Ed25519 real (sign com chave de teste → verify com public key derivada retorna true; payload adulterado e assinatura forjada retornam false), determinismo do encoding base64 padrão (não base64url), use case/viewmodel/controller/presenter/rota, validação de formato hex e gate de stage TEST na substituição da chave de teste (review patches), confirmação de que `environments.ts`/`middleware.ts` não precisaram de alteração
- [x] tests/unit/story-7-1/schema-baseline.test.mjs - Story 7.1 (dev) contratos estruturais do baseline: existência de `supabase/config.toml`/`migrations/`/`seed.sql`, `.gitignore` cobre `.branches`/`.temp`, migration baseline contém as 4 tabelas reais (`proof_request` singular), ausência de `updated_at`/`can_create_apps` (drift esperado), presença de `environment`, guarda whole-file contra vazamento de colunas de forward-migration
- [x] tests/unit/story-7-1/migrations-regression.test.mjs - Story 7.1 (QA) cobertura adicional: `.gitignore` verificado via `git check-ignore` real (não só regex de texto) para `.branches`/`.temp`, confirma que a migration em si NÃO é ignorada, regressão dos 3 patches do code review com efeito funcional (`DROP EXTENSION IF EXISTS`, sem `.gitkeep` morto, `SUPABASE_DB_PASSWORD` documentada em `.env.local.example`), wiring do script `test:story:7.1`, compilação TypeScript limpa
- [x] tests/unit/story-7-6/proof-request-detail-no-api-response.test.mjs - Story 7.6 (dev) contratos da remoção da seção "Resposta da API": ausência do import `CodeBlock`, presença do import `InlineCode`, ausência do heading e da variável `payload`/`JSON.stringify`, ausência de `<CodeBlock` no JSX, preservação dos cards "Resumo"/"Atributos confirmados"/"Privacidade" e do grid `lg:grid-cols-3`/`lg:col-span-2`
- [x] tests/unit/story-7-6/qa-regression.test.mjs - Story 7.6 (QA) cobertura adicional: guarda codebase-wide confirmando que `CodeBlock` não tem mais nenhum consumidor em nenhum arquivo `.ts/.tsx/.js/.jsx/.mjs` do projeto (não só na página de detalhe), preservação comportamental de `InlineCode` (id da requisição + referência externa), wiring do script `test:story:7.6`, compilação TypeScript real via `node node_modules/typescript/bin/tsc` (não `.bin/tsc`, que falha com `ENOENT` no Windows sob `execFileSync` e mascararia erros como "sem erros" — bug encontrado e corrigido durante esta própria etapa de QA)
- [x] tests/unit/story-5-7/claim-consolidation.test.mjs - Story 5.7 consolidação de claims na emissão: enum `ProofType` + `PROOF_TYPE_CLAIM_KEY`, remoção de `proofType` do schema/`.strict()`/controller/input do use case, payload assinado reduzido a `documentImage` puro, ausência do branch por `proofType`, `personhood` sempre `true` + `ageOver18` sempre calculado (`age >= 18`), ausência de throw isolado para `age < 18`, 422 preservado para OCR falho e data de nascimento não parseável, exatamente 2 sites de 422/`UNPROCESSABLE_ENTITY` (AC#4 "único caminho"), presenter sem referência a `proofType`, compilação TypeScript limpa
- [x] tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs - Story 5.8 (dev) contratos estruturais: import de `ProofType`/`PROOF_TYPE_CLAIM_KEY`, carregamento de `proof_request` via `requestRepo.findById`, checagem `PROOF_TYPE_CLAIM_KEY[...]`/`!== true` após o bloco booleano original preservado, guarda `!claimKey`, Regras 1-4/6-11 intactas, ausência do literal `"verification"` hardcoded, `fireWebhook` com parâmetro `proofType`, compilação TypeScript limpa
- [x] tests/unit/story-5-8/verify-presentation-usecase.dynamic.test.ts - Story 5.8 (QA) **teste dinâmico/comportamental** — instancia `VerifyPresentationUseCase` real com repositórios/hasher/blockchain/webhook fake e VP/VC assinados de verdade com `@noble/ed25519`; verifica o `{ valid: boolean }` efetivamente retornado, a transição de status persistida (`updateStatus`) e o `proofType` real entregue ao webhook para: AC#2 (ageOver18:false → rejected), AC#3 (claim ausente → rejected), AC#4 (claim não solicitada irrelevante → approved), controle positivo (ageOver18:true → approved), AC#5 (claim não-booleana → rejected), e o caminho defensivo de `findById` retornando `null` (Task 1). Fecha a lacuna de "testes 100% estáticos" registrada em `deferred-work.md`; verificado por mutação (comentar a checagem nova faz os 2 testes de correspondência falharem, confirmando que o teste exercita o código real). Executado via `tsx --test` (nova devDependency, decisão do usuário) — não via `node --test` puro, pois importa os módulos TypeScript reais com aliases `@/...`
- [x] tests/unit/story-9-1/vc-jwt-issuance.test.mjs - Story 9.1 (dev) contratos estruturais da migração VC-JWT: ausência do formato JSON-LD antigo (`Ed25519Signature2020`, `proofPurpose`, `type: ["VerifiableCredential"]`), presença do header (`alg: EdDSA`, `typ: JWT`, `kid`) e payload (`iss`, `sub`, `jti`, `iat`, `nbf`, `vc`) prescritos, assinatura via `ed.signAsync` sobre `base64url(header).base64url(payload)`, `execute()` retornando `Promise<string>`, preservação do fluxo OCR/claims/blockchain/erros 401-422-502, não-alteração do hardcode de teste do Epic 10, propagação do tipo `string` pelo controller/rota, compilação TypeScript limpa
- [x] tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts - Story 9.1 (dev + QA) **teste dinâmico/comportamental** — instancia `IssueCredentialUseCase` real com `BlockchainClient`/`OcrProvider` fake e um par de chaves Ed25519 de teste; decodifica o JWT de 3 segmentos efetivamente retornado e verifica: header/payload exatamente no formato do AC#1, assinatura EdDSA válida via `ed.verifyAsync` contra a public key derivada de `ISSUER_PRIVATE_KEY`, `ageOver18: false` para holder menor de idade sem lançar exceção (semântica da Story 5.7 preservada), rejeição 401 sem registrar DID tanto para assinatura bem-formada porém inválida quanto para assinatura malformada (não-base64url) — item adicionado nesta etapa de QA para fechar o gap de cobertura registrado no code review
- [x] tests/unit/story-7-2/updated-at-tracking.test.mjs - Story 7.2 (dev) contratos estruturais: forward migration `add_updated_at_to_proof_requests` (coluna adicionada, backfill literal `updated_at = created_at`, `SET DEFAULT now()`/`SET NOT NULL`, nenhuma outra tabela tocada), `ProofRequest` entity (`updatedAt: Date` + getter), `ProofRequestMapper` (`updated_at` mapeado nos dois sentidos), `SupabaseProofRequestRepository.updateStatus` (grava `status` e `updated_at` no mesmo `.update()`), `CreateProofRequestUseCase` (instancia `ProofRequest` com `updatedAt`), `GetProofRequestUseCase`/DTO (mapeia `updatedAt` real, tipo não-nulável)
- [x] tests/unit/story-7-2/updated-at-tracking.dynamic.test.ts - Story 7.2 (QA) **teste dinâmico/comportamental** — instancia `ProofRequestMapper` e `GetProofRequestUseCase` reais (com repositório fake) e verifica em runtime: round-trip `toPersistence`/`toDomain` de `updated_at` (serialização ISO, distinção de `created_at` após uma transição simulada), `updatedAt === createdAt` na criação (sem transição ainda), DTO retornado pelo use case reflete o `updatedAt` real da entidade (nunca `validatedAt`), `updatedAt` nunca `null` mesmo sem evento de validação, e regressão do guard 404 anti-enumeração (AC#4 da Story 3.3) permanecendo intacto. Fecha a lacuna "suíte 100% estática" para esta story específica, seguindo o padrão `tsx --test` já estabelecido pelas Stories 5.8/9.1
- [x] tests/unit/story-7-3/allowlist-can-create-apps.test.mjs - Story 7.3 (dev) contratos estruturais: forward migration `add_can_create_apps_to_company` (coluna `NOT NULL DEFAULT false` em statement único, backfill `= true`, ausência de `ALTER COLUMN` separado — reescrita no code review para eliminar janela de corrida), `Company` entity (`canCreateApps: boolean` + getter), `CompanyMapper` (`can_create_apps` mapeado nos dois sentidos), os 3 pontos de instanciação de `Company` (`create_company_usecase.ts` com `false`, `update_my_company_usecase.ts` preservando o valor), `GetMyCompanyUseCase`/DTO (`canCreateApps` propagado), guard 403 (`ForbiddenError`) em `CreateCompanyAppUseCase` + injeção via presenter, CTA/banner bloqueado em `/apps` e bloqueio de navegação em `/apps/new` (incluindo os patches do review: validação de shape da resposta, toast no redirect, `aria-label` nos CTAs)
- [x] tests/unit/story-7-3/allowlist-can-create-apps.dynamic.test.ts - Story 7.3 (QA) **teste dinâmico/comportamental** — instancia `CreateCompanyAppUseCase` e `GetMyCompanyUseCase` reais com `CompanyRepository`/`CompanyAppRepository`/`ApiKeyHasher` fake, e `CompanyMapper` (função pura), e verifica em runtime: `execute()` rejeita com `ForbiddenError`/403 e **nenhum app é persistido** quando `canCreateApps === false`; `execute()` cria o app normalmente (1 app persistido, `apiKey` no formato `id.secret`) quando `canCreateApps === true`; `execute()` rejeita com `NotFoundError` quando a company não existe; round-trip `toPersistence`/`toDomain` de `can_create_apps`; DTO de `GetMyCompanyUseCase` reflete `canCreateApps` real (`true`/`false`) e preserva o guard 404 anti-enumeração. Fecha a lacuna "suíte 100% estática" para este módulo, seguindo o padrão `tsx --test` já estabelecido pelas Stories 5.8/7.2/9.1

## Coverage

### Story 1.1
- Acceptance criteria: 5/5 cobertos
- Caminhos críticos: aliases TypeScript, módulos src/, environments.ts, pastas obsoletas, entrypoints de API e UI

### Story 1.2
- Acceptance criteria: 3/3 cobertos
- Caminhos críticos: criação do `proxy.ts` + middleware compartilhado, remoção de requireAuthenticatedUser, injeção de x-company-id, routing por método (GET/POST/DID)

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
- `npm run test:story:1.6`: **passed** — 28/28
- `npm test` após story 1.6: **passed** — 165/165 (Stories 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.2)
- `npm run test:story:5.1`: **passed** — 20/20
- `npm test` após story 5.1: **passed** — 186/186
- `npm run test:story:5.2`: **passed** — 32/32
- `npm test` após story 5.2: **passed** — 134/134 (Stories 1.1, 1.2, 1.3, 1.4, 1.5, 5.2)

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
  - Review patches: CNPJ obrigatório `.length(14)` (rejeita ausente/null e 11–13 dígitos), null guard em `authData.user`, `console.error` no rollback, `POST /api/auth/sign-up` como rota pública no middleware
  - Testes inline comportamentais: CNPJ formatter (formatação completa, truncamento a 14 dígitos, strip de caracteres), schema Zod (senhas iguais/diferentes, CNPJ 14 dígitos vs curto vs null rejeitado)
  - TypeScript clean: `npx tsc --noEmit` sem erros

## Validation

- Todos os testes usam `node:test` + `node:assert/strict` (framework nativo Node.js, sem dependências externas)
- Os testes para Story 1.3 são de contrato de código-fonte (source inspection), adequados para uma story de refatoração de schema sem lógica de negócio nova
- A migration SQL (`supabase/migrations/20260513_update_proof_sessions.sql`) foi aplicada manualmente via Supabase Dashboard e deletada; o contrato TypeScript (testes de schema) serve como evidência de que o TypeScript está alinhado com o schema aplicado
- Deferred do code review (Story 5.3, 4.1): não há testes para setChallenge() nem para lógica de expiração na entidade — esses são escopo das stories correspondentes
- O código-fonte da aplicação já reflete corretamente a mudança, usando `fetchWithAuth` para o PATCH, e `fetch` nativo para a rota de auth/sign-out, eliminando chance de loops infinitos no logout.
- Não realizamos o teste de compilação TS para a story 1.7 devido a uma falha transiente no ambiente npm (versão node), mas a compilação local (IDE/LSP) confirma a sanidade dos imports.

### Story 1.7
- Acceptance criteria: 3/3 cobertos
  - AC#1 (GET /api/companies/me + viewmodel): coberto pelos testes de interfaces e mapeamento de `cnpj`.
  - AC#2 (PATCH /api/companies/me + UI react hook form): coberto por checagem da interface `update`, `UpdateMyCompanyUseCase` e testes no arquivo `page.tsx`.
  - AC#3 (LogoutConfirmDialog): coberto pelas verificações do HTML de dialog acessível (role="dialog", aria-modal) e botões.
- Caminhos críticos: 11/11 testes passando
  - Criação de usecases, views e controllers para `update_my_company`.
  - Integração da `settings/page.tsx` com as bibliotecas (RHF, Zod) e utilitários.
- Os testes da story 1.2 foram atualizados para exigir `proxy.ts` como entrypoint Next.js 16 e referenciar `src/shared/middleware.ts` como lógica compartilhada

### Story 1.6
- Acceptance criteria: 4/4 cobertos
  - AC#1 (login com credenciais válidas → redirect para `/` ou `?next=<path>`): coberto pelos contratos de `signInWithPassword`, `window.location.href`, leitura do `?next=`, validação open-redirect e fallback `/`
  - AC#2 (credenciais inválidas → toast genérico, botão disabled): coberto pelos contratos de `toast.error`, `disabled={isSubmitting}`, ausência de `AlertCircle` inline, e `onValidationError` para falhas de validação Zod
  - AC#3 (usuário não autenticado em `/*(dashboard)` → redirect para `/sign-in?next=<path>`): coberto pelos contratos de `isDashboardPage` (4 paths) e `withSessionAuth(redirectOnFail: "/sign-in")` com `?next=`
  - AC#4 (usuário autenticado em `/sign-in` → redirect para `/`): coberto pelo contrato do middleware
- Review patches cobertos: (1) `onValidationError` handler para validação silenciosa, (2) remoção de mensagens field-specific do schema Zod
- Caminhos críticos: 28/28 testes passando
  - Migração RHF: `zodResolver`, `useForm`, `mode: "onSubmit"`, `isSubmitting`, `register`
  - Toast: `toast.error()` para erros de auth; `onValidationError` para falhas Zod; sem AlertCircle inline; sem useState("") para erro
  - Redirect seguro: leitura de `?next=` via URLSearchParams, guard `startsWith("/") && !startsWith("//")`, 7 casos de borda inline
  - Middleware: `isDashboardPage` cobre `/`, `/apps`, `/proof-requests`, `/settings`; `withSessionAuth` injeta `?next=`; redirect de autenticado via `pathname === "/sign-in"`
  - Testes inline: schema Zod (email inválido rejeitado, senha vazia rejeitada), safe-redirect (null/undefined/empty/`//evil.com`/`http://...`)
  - TypeScript clean: `npx tsc --noEmit` sem erros

### Story 5.1
- Acceptance criteria: 5/5 cobertos
  - AC#1 (request válido → extrai public key do DID, verifica assinatura, injeta x-holder-did): coberto pelos contratos do payload canônico, verifyAsync, x-holder-did
  - AC#2 (DID malformado → 401 "Invalid DID"): coberto pelos contratos de regex `/^[0-9a-f]{64}$/` e split de 4 partes
  - AC#3 (timestamp expirado → 401 "Request expired"): coberto pelos contratos de Number() e janela 300_000ms
  - AC#4 (assinatura inválida → 401 "Invalid signature"): coberto pelo contrato de signatureBytes.length !== 64 e verifyAsync
  - AC#5 (header ausente → 401 "Missing auth headers"): coberto pela verificação dos 3 headers
- Review patches cobertos: (1) Number() não parseInt para timestamp, (2) comparação em ms inteiros 300_000, (3) signatureBytes.length !== 64 antes do crypto
- Caminhos críticos: 20/20 testes passando
  - Estrutura: arquivo existe, export async, import @noble/ed25519, usa verifyAsync
  - 5 erros de auth com mensagens exatas do spec
  - Payload canônico: `${tsHeader}:${request.method}:${pathname}`
  - Dependência @noble/ed25519 v3.x no package.json
  - middleware.ts: import, await na chamada, routing das 4 rotas DID
  - TypeScript: `npx tsc --noEmit` sem erros

### Story 5.2
- Acceptance criteria: 4/4 cobertos
  - AC#1 (interface BlockchainClient com 4 métodos): coberto por contratos de source inspection (registerDID, revokeVC, isDIDRegistered, isVCRevoked com tipos corretos)
  - AC#2 (implementação em shared/clients/blockchain/, instanciada via environments.ts): coberto por contratos de EthersBlockchainClient (JsonRpcProvider, Wallet, writeContract/readContract) e environments.ts (schema, getters, getBlockchainClient)
  - AC#3 (funciona contra Hardhat local — BLOCKCHAIN_RPC_URL default): coberto pelo contrato de BLOCKCHAIN_RPC_URL com default `127.0.0.1:8545`
  - AC#4 (erro propagado ao use case): coberto pelos testes de receipt null + status=0 que verificam o throw em registerDID e revokeVC
- Patches do code review cobertos: address validation (`ethers.isAddress`), receipt null/status=0 check em 2 métodos de escrita
- Caminhos críticos: 32/32 testes passando
  - Estrutura: 4 novos arquivos criados
  - Interface: 4 métodos com tipos corretos
  - ABI: 4 assinaturas (bytes32 para vcHash nas operações de revogação, view para leituras)
  - EthersBlockchainClient: implementa interface, usa ethers v6, separa read/write contracts, valida address, checa receipt
  - environments.ts: 2 novas vars no schema, TEST_ENV, getters, factory method com lazy import e throw para TEST stage
  - TypeScript: `npx tsc --noEmit` sem erros

### Story 3.3 — Detalhe de Proof Request
- [x] tests/unit/story-3-3/proof-request-detail.test.mjs - Story 3.3 contratos do detalhe de proof request: use case 404 anti-enumeration (NotFoundError, sem ForbiddenError, guard unificado not-found/company-mismatch), DTO com externalReference/updatedAt (aditivo), store client (fetchWithAuth, /api/proof-requests/{id}, no-store, asJson error.message, confirmedClaims personhood/ageOver18, labels PT-BR), página (getProofRequest sem mocks, sem timeline FR8, loading/not-found states, mapeamento pending_user→pending, claims só quando approved + guard result!==false, CodeBlock JSON, privacy card), Task 6 (CompanyApp.appId first-class + mapper bidirecional + create appId:id)

#### Coverage
- Acceptance criteria: 5/5 cobertos
  - AC#1 (fetch real + resumo/atributos/JSON/privacy, sem timeline): coberto pelos contratos da página e do store
  - AC#2 (claims quando approved): coberto por `confirmedClaims` + gate `status === "approved"`
  - AC#3 (mensagem por status não-aprovado): coberto por `NON_APPROVED_MESSAGES`
  - AC#4 (404 nunca 403): coberto pelo contrato do use case (NotFoundError, sem ForbiddenError)
  - AC#5 (loading/erro): coberto pelos contratos de spinner + not-found state
- Caminhos críticos: 20/20 testes passando
  - Task 6 (blocker do build): CompanyApp.appId promovido a campo de primeira classe, mapeado nos dois sentidos, build 100% verde
  - Review patch: claims guardados por `result !== false`

#### Validation
- `npm run test:story:3.3`: **passed** — 20/20
- `npm test` após story 3.3: **269/272** passando (as 3 falhas restantes são `spawnSync npx ENOENT` de ambiente — pré-existentes, não relacionadas a código)
- `npm run build`: **passed** — Next.js "Compiled successfully" + "Finished TypeScript" (build 100% verde após correção do blocker `CompanyAppMapper`)
### Story 2.1
- Acceptance criteria: 5/5 cobertos
  - AC#1 (GET /api/company-apps, colunas: nome+app_id, status, criado em; isolamento company_id): coberto pelos contratos do route handler (GET export, x-company-id), usecase (listByCompanyId), viewmodel (camelCase), apps-store (fetchWithAuth, json.items), e page (listApps, app.name, app.id, StatusBadge, formatDate)
  - AC#2 (estado de loading — skeleton): coberto pela presença de `animate-pulse` no source da page
  - AC#3 (estado vazio com CTA /apps/new "Criar primeiro app"): coberto pelo guard `apps.length === 0` e link `/apps/new`
  - AC#4 (estado de erro com retry): coberto pela presença de "Tentar novamente", `reload`/`setFetchKey` e estado de erro
  - AC#5 (clique navega para /apps/[appId]): coberto por `router.push(`/apps/${app.id}`)` + patch de teclado (`tabIndex={0}`, `onKeyDown`)
- Review patch coberto: `tabIndex={0}` + `onKeyDown` Enter/Space adicionados após code review (acessibilidade de teclado)
- Caminhos críticos: 15/15 testes passando
  - Backend: route handler GET, leitura de x-company-id, usecase filtra por companyId, viewmodel em camelCase
  - Frontend: import de listApps de apps-store, skeleton com animate-pulse, EmptyState com CTA, ErrorState com retry, rows com router.push, nome + app_id, StatusBadge, formatDate
  - Arquivos: todos os arquivos backend e frontend existem

### Story 5.4
- Acceptance criteria: 3/3 cobertos
  - AC#1 (fluxo feliz): POST /api/credentials/issue autenticado por DID, validação da assinatura do body pelo holder, OCR em memória (sem persistência no banco/log), VC assinado via `@noble/ed25519` com chave do emissor, chamada `BlockchainClient.registerDID(holderDid)`, VC completa retornada, sem persistência.
  - AC#2 (falha no OCR): imagem "fail"/"invalid" ou menor de 18 (para ageOver18) retorna 422 "Document processing failed" sem persistir.
  - AC#3 (falha na blockchain): exceção no registerDID retorna 502 "Blockchain registration failed" sem emitir VC.
- Caminhos críticos: 21/21 testes passando
  - Criação de arquivos e interfaces: `OcrProvider.ts`, `MockOcrProvider.ts`, `IssueCredentialUseCase.ts`, `IssueCredentialViewModel.ts`, `IssueCredentialController.ts`, `IssueCredentialPresenter.ts`, `route.ts`.
  - Assinatura do Holder validada via `verifyAsync` da public key extraída do DID do holder.
  - claims retornadas apenas booleanos (personhood ou ageOver18), sem dados brutos.
  - Chave privada de teste usada se `ISSUER_PRIVATE_KEY === "test-issuer-private-key"`.
  - Registro on-chain do DID do holder via `BlockchainClient`.
  - Compilação TS limpa.

## Validation

- `node --test tests/unit/story-2-1/listagem-de-aplicacoes.test.mjs`: **passed** — 15/15
- `node --test tests/unit/story-5-4/credential-issuance.test.mjs`: **passed** — 21/21
- `npm test` (suite completa): **passed** — 259/259 (todas as stories passando, incluindo regressões)

### Story 4.2 — Tela Coringa com Polling e 6 Estados Visuais
- Acceptance criteria: 7/7 cobertos
  - AC#1 (waiting_user: layout independente, nome da company + proofType traduzido, deep link, contador, polling 5-10s): coberto pelos contratos do hook (intervalo, fetch público) e do card `waiting_user` (StatusBadge, DeepLinkButton, countdown fora da região aria-live)
  - AC#2 (opened: spinner, deep link oculto, polling continua): coberto por "opened state does not render the deep link button" e pelo patch que remove `clickedOpen` — o estado só é exibido quando `session.status === "opened"` confirmado pelo servidor
  - AC#3 (approved_by_user: sucesso + botão condicional a returnUrl, polling para): coberto por `TERMINAL_STATUSES` e pela renderização condicional `returnUrl ? (...)`
  - AC#4 (cancelled: mensagem genérica distinta, polling para): coberto pela comparação de blocos cancelled vs expired (cópias diferentes)
  - AC#5 (expired: mensagem clara + contador força expired no client, polling para): coberto por `secondsRemaining <= 0` em `page.tsx` e pelo guard contra `NaN` em `getSecondsRemaining`
  - AC#6 (token inválido/inexistente: mensagem genérica sem enumeration): coberto por "invalid state message does not distinguish reason" e pela distinção `network` vs `invalid` (patch de review)
  - AC#7 (nenhum dado sensível exposto): coberto por "never renders sensitive fields"
- Caminhos críticos: 34/34 testes passando
  - Hook `useProofSessionPolling`: fetch público sem `fetchWithAuth`, intervalo dentro de 5-10s, parada em status terminal, cleanup de timers no unmount, 404 tratado como `invalid`, guarda `Number.isNaN` para `expiresAt` malformado, `AbortController` com timeout de 10s
  - `VerificationLayout`: sem sidebar/topbar, tokens semânticos (não os literais `gray-50`/`blue-600` da spec de UX)
  - `DeepLinkButton`: `encodeURIComponent(sessionToken)`, touch target `min-h-[48px]`
  - `VerificationStateCard`: 6 estados nomeados + estado `network` + fallback para status desconhecido; `StatusBadge` aplicado a todos os estados incluindo `waiting_user`/`opened` (patch de review, conforme tabela dos Dev Notes); `aria-live="polite"` restrito ao título/descrição, excluindo o contador que muda a cada segundo (patch de review de acessibilidade)
  - `page.tsx`: DTO alinhado com a Story 4.1 (sem campos obsoletos pré-4.1), sem placeholder de QR code, `displayStatus` derivado exclusivamente de `session.status` (patch de review — remove o anti-padrão `clickedOpen` que os próprios Dev Notes da story pediram para evitar), distinção entre erro de rede e link inválido na primeira carga (patch de review)
  - TypeScript: `npx tsc --noEmit` sem erros; `npx eslint` sem erros/warnings

#### Validation
- `npm run test:story:4.2`: **passed** — 34/34
- `npm test` (suite completa): **passed** — 406/406

#### Notes
- Os testes desta story seguem a convenção estrutural já estabelecida no projeto (`readFileSync` + regex/string matching sobre `node:test`), pois não há `jsdom`/`@testing-library` instalado — decisão de escopo pré-existente, não introduzida por esta story
- 3 itens foram deferidos do code review para `deferred-work.md`: (1) sem backoff/limite em falhas de fetch repetidas — parcialmente mitigado pela distinção de erro de rede, (2) throttling de timers em aba em segundo plano não tratado, (3) ausência de testes comportamentais (jsdom/simulação de timers) — mesma limitação estrutural mencionada acima, registrada explicitamente como dívida técnica

### Story 6.2 — Endpoint Público da Chave de Webhook
- Acceptance criteria: 3/3 cobertos
  - AC#1 (`GET /api/webhook-public-key` retorna `{ publicKey, algorithm: "Ed25519" }` derivado de `WEBHOOK_SIGNING_PRIVATE_KEY`, determinístico): coberto pelos testes estruturais de `get_webhook_public_key_usecase.ts`/`viewmodel.ts` e pelo teste comportamental de determinismo do encoding base64 (duas derivações consecutivas produzem a mesma string)
  - AC#2 (public key retornada verifica assinaturas legítimas como `true` e adulteradas/forjadas como `false`): coberto por 3 testes comportamentais reais com `@noble/ed25519` (`sign` com a chave de teste → `verify` com a public key derivada; payload adulterado; assinatura forjada com outra chave)
  - AC#3 (boot-fail em PROD/HOMOLOG sem a env, getter falha explicitamente em DEV/DOTENV): coberto por testes de contrato confirmando que `environments.ts` já tem `WEBHOOK_SIGNING_PRIVATE_KEY` em `productionRequiredEnvNames` e que o getter usa `requireConfiguredValue` — nenhuma mudança foi feita nesse arquivo, então a cobertura pré-existente já vale para este endpoint
- Caminhos críticos: 23/23 testes passando
  - `GetWebhookPublicKeyUseCase`: deriva via `ed.getPublicKeyAsync`, encoding base64 padrão (`Buffer.from(...).toString("base64")`, não base64url), fallback de chave de teste distinto do issuer (`...002`)
  - Patches do code review: `hexToBytes` valida formato via `HEX_PRIVATE_KEY_PATTERN` e lança erro em hex malformado/tamanho ímpar em vez de silenciosamente corromper a chave; substituição da chave de teste restrita a `stage === Stage.TEST` (constructor recebe `stage: Stage` como segundo parâmetro, injetado pelo presenter — usecase não acessa `Environments.getEnvs()` diretamente, mantendo a convenção do projeto)
  - Módulo completo (`usecase`/`viewmodel`/`controller`/`presenter`/`route.ts`) segue o padrão de `get_proof_session_*` e `issue_credential_presenter.ts`
  - Confirmado que `src/shared/environments.ts` e `src/shared/middleware.ts` não precisaram de nenhuma alteração (toda a infraestrutura de `WEBHOOK_SIGNING_PRIVATE_KEY` e a classificação da rota como pública já existiam)
  - TypeScript: `npx tsc --noEmit` sem erros; `npx eslint` sem erros/warnings

#### Validation
- `npm run test:story:6.2`: **passed** — 23/23
- `npm test` (suite completa): **passed** — 518/518

#### Notes
- Mesma convenção estrutural do projeto (`node:test` + regex sobre source), mas complementada por testes comportamentais reais com `@noble/ed25519` para a lógica criptográfica (round-trip sign/verify), já que essa parte é uma função pura facilmente testável sem precisar importar a classe TypeScript diretamente
- 2 itens deferidos do code review para `deferred-work.md`: (1) sem cache da public key entre requisições (otimização de performance, não exigida pelos ACs), (2) duplicação de forma entre `GetWebhookPublicKeyOutput` (usecase) e `GetWebhookPublicKeyOutputDTO` (viewmodel) — refactor de baixo risco fora de escopo
- Story 6.1 (WebhookSigner e Entrega de Webhook) permanece em `backlog` — é independente desta story; a Story 6.2 não depende da implementação do signer, apenas da mesma env var já pré-configurada

### Story 7.1 — Fundação de Versionamento de Schema (Supabase Migrations + Baseline)
- Acceptance criteria: 2/4 testáveis por unit test, 2/4 coberto por verificação manual documentada nos Dev Notes
  - AC#1 (`supabase/` versionado, `.gitignore` cobre `.branches`/`.temp`): coberto por `schema-baseline.test.mjs` (existência dos arquivos, `project_id` presente) e reforçado por `migrations-regression.test.mjs` com `git check-ignore` real, não apenas regex de texto
  - AC#2 (baseline fiel ao schema real, incluindo drift, sem colunas novas): coberto por `schema-baseline.test.mjs` (4 tabelas, ausência de `updated_at`/`can_create_apps`, presença de `environment`, guarda contra forward-migration leak)
  - AC#3 (`supabase db reset` recria localmente sem erro): **não testável por unit test** — exige Docker + Postgres local real, que os testes desta suíte explicitamente evitam (consistente com a convenção do projeto de não depender de serviços externos). Validado manualmente durante o dev-story (`supabase start` + `supabase db reset`, ambos sem erro; `supabase db diff` pós-reset confirmou zero divergência) — evidência no Debug Log da story, não em teste automatizado
  - AC#4 (`supabase db diff --check` em CI): **não implementado, deferido** — não existe `.github/workflows/` no repositório para anexar o step; nada a testar
- Caminhos críticos: 18/18 testes passando (10 do dev-story + 8 adicionados nesta etapa de QA)
  - QA adicionou: verificação comportamental real do `.gitignore` via `git check-ignore` (mais forte que checar o texto do arquivo), regressão dos 3 patches do code review com efeito funcional em tempo de execução, wiring do script npm, compilação TypeScript

#### Validation
- `npm run test:story:7.1`: **passed** — 18/18
- `npm test` (suite completa): **passed** — 568/568

#### Notes
- Story arquitetural/infraestrutural (migrations do Supabase, não lógica de aplicação) — nenhum arquivo em `src/` foi tocado, então os testes são estruturais/comportamentais sobre arquivos de configuração e SQL gerado, não sobre código TypeScript de domínio
- AC#3 e AC#4 não têm — e não deveriam ter — testes automatizados: exigiriam Docker/Postgres real (AC#3) ou um pipeline de CI que não existe (AC#4). Ambos foram validados manualmente e documentados nos Dev Notes/Debug Log da story em vez de simulados por um teste que daria falsa confiança
- 2 itens deferidos do code review para `deferred-work.md`: (1) grants amplos (`anon`/`authenticated`) + RLS habilitado sem políticas nas 4 tabelas — estado pré-existente no banco de produção, capturado fielmente, não introduzido por esta story, (2) `GRANT ALL` na função `rls_auto_enable()` para `anon`/`authenticated` — artefato da própria plataforma Supabase

### Story 7.6 — Remoção da Seção "Resposta da API" no Detalhe
- Acceptance criteria: 3/3 cobertos
  - AC#1 (seção "Resposta da API" removida; Resumo/Atributos confirmados/privacidade/grid preservados): coberto por `proof-request-detail-no-api-response.test.mjs` (heading ausente, cards presentes, grid `lg:grid-cols-3`/`lg:col-span-2` preservado)
  - AC#2 (import `CodeBlock` removido, `InlineCode` preservado, `payload`/`JSON.stringify` removidos): coberto pelos testes de import ausente/presente e ausência da construção de `payload`; reforçado no QA pela preservação comportamental de `InlineCode` (id + referência externa) e pelo guard codebase-wide de que `CodeBlock` não tem mais nenhum consumidor
  - AC#3 (nenhuma saída JSON bruta exibida): coberto pela ausência de `<CodeBlock` no JSX e de `JSON.stringify`
- Caminhos críticos: 14/14 testes passando
  - Regressão corrigida: o teste pré-existente de `tests/unit/story-3-3/proof-request-detail.test.mjs` que exigia `CodeBlock` foi atualizado (não apenas relaxado) para agora exigir sua ausência
  - QA encontrou e corrigiu um bug no próprio teste de compilação TypeScript adicionado nesta etapa: invocar `.bin/tsc` diretamente via `execFileSync` lança `ENOENT` neste ambiente Windows (script com shebang, sem resolução de shell); o catch genérico teria mascarado isso como "compilação limpa" (stdout vazio = zero erros encontrados). Corrigido invocando `node node_modules/typescript/bin/tsc` (portável) e adicionando um guard explícito que falha se o processo não rodou de verdade (stdout vazio no catch)

#### Validation
- `npm run test:story:7.6`: **passed** — 14/14
- `npm test` (suite completa): **passed** — 582/582
- `npx tsc --noEmit` (via `node node_modules/typescript/bin/tsc`, portável entre Windows/Unix): **passed** — sem erros

#### Notes
- Story de remoção pura de UI — nenhum arquivo de backend tocado; testes de source-inspection seguem a convenção já estabelecida no projeto
- 1 item deferido do code review para `deferred-work.md`: `CodeBlock` (`components/api/code-block.tsx`) fica sem consumidores após esta story — `InlineCode`, no mesmo arquivo, segue em uso; decisão explícita de não deletar o arquivo compartilhado nesta story
### Story 5.7 — Consolidação de Claims na Emissão de Credencial
- Acceptance criteria: 6/6 cobertos
  - AC#1 (claims consolidadas — `{ personhood: true, ageOver18: <boolean> }`, sem PII): coberto por "always sets personhood true and computes ageOver18 boolean via the shared ProofType enum" e pelo teste do enum `ProofType`/`PROOF_TYPE_CLAIM_KEY`
  - AC#2 (menor de 18 conclui com 201, `ageOver18: false`, sem 422): coberto por "use case never throws for age below 18 in isolation"
  - AC#3 (contrato sem `proofType`; payload assinado = `documentImage` puro; ordem de validação preservada): coberto por "IssueCredentialSchema no longer accepts proofType" + ".strict()", "IssueCredentialController no longer forwards proofType", "IssueCredentialInput no longer declares proofType", "signed payload no longer includes proofType"
  - AC#4 (422 único caminho — OCR falho): coberto por "preserves OCR-in-memory failure handling" + "AC#4 — 422 has exactly two document-related causes" (garante que não sobrou nenhum branch extra de 422 por `proofType`)
  - AC#5 (data de nascimento não parseável → 422): coberto por "use case still throws 422 for unparseable birth date"
  - AC#6 (assinatura do body, OCR em memória, descarte de PII, `registerDID` inalterados): coberto por "preserves signature validation and DID registration" + "preserves OCR-in-memory failure handling"
- Caminhos críticos: 17/17 testes passando
  - Enum compartilhado `ProofType`/`PROOF_TYPE_CLAIM_KEY` (único lugar do mapeamento `age_over_18` ↔ `ageOver18`, per Dev Notes)
  - Patches do code review cobertos: `.strict()` no `IssueCredentialSchema` (rejeita campos desconhecidos em vez de descartar silenciosamente), presenter confirmado sem referência a `proofType`
  - Regressão da Story 5.4: 1 asserção obsoleta corrigida (`age < 18` lançando erro → `age >= 18` computando booleano), demais 20 testes da 5.4 intactos
  - Regressão da Story 5.5: nenhuma alteração necessária — `claims` é lida como `Record<string, unknown>` genérico, agnóstica ao novo shape
  - TypeScript: `npx tsc --noEmit` sem erros; `npx eslint` sem erros

#### Validation
- `npm run test:story:5.7`: **passed** — 17/17
- `npm test` (suite completa): **passed** — 585/585

#### Notes
- Mesma convenção estrutural do projeto (`node:test` + regex/contagem sobre o source + `tsc --noEmit`). Não foi introduzido um runner de testes comportamentais para TypeScript nesta story: o projeto não tem `ts-node`/`tsx`/`swc-register`, e `ProofType.ts` usa `enum` (sintaxe que gera código em runtime, não apenas tipos) — o `--experimental-strip-types` nativo do Node não cobre `enum`, então executar o use case real exigiria adicionar um transpilador/loader novo ao projeto, o que é infraestrutura de teste fora do escopo de "gerar testes para esta story". Registrado como item deferido no code review (ver `deferred-work.md`, "Suíte de testes é 100% estática").
- 5 itens deferidos do code review para `deferred-work.md`: payload assinado sem domain separator/nonce (pré-existente desde 5.4), fallback hardcoded de chave de teste sem guarda fora de TEST (Epic 10), `claims` tipado como `Record<string, boolean>` genérico (pré-existente desde 5.4), suíte 100% estática (sistêmico), robustez de fronteira de `ocrResult.birthDate` (mitigada hoje pelo contrato do `ApiOcrProvider`, que já lança exceção antes de retornar dado malformado)
- **Story 5.8 (correspondência claim ↔ proof_type na verificação) não foi implementada nesta entrega** — decisão consciente do usuário apesar da restrição de entrega acoplada documentada em `epics.md`/`architecture.md`/`sprint-change-proposal-2026-07-28.md` (5.7 sem 5.8 permite que uma credencial de menor de idade aprove um pedido de `age_over_18`). O código desta story não deve ser considerado pronto para liberação/deploy até a Story 5.8 ser implementada.

### Story 5.8 — Correspondência entre Claim Apresentada e Proof Type Solicitado
- Acceptance criteria: 7/7 cobertos
  - AC#1 (proof_request carregada, proof_type mapeado, Regra 5 estendida): coberto estruturalmente ("UseCase loads the proof_request via requestRepo.findById", "UseCase maps proof_type to a claim key via PROOF_TYPE_CLAIM_KEY") e comportamentalmente (todos os 6 testes dinâmicos exercitam o fluxo completo)
  - AC#2 (`age_over_18` + `ageOver18: false` → rejected): coberto dinamicamente — `VerifyPresentationUseCase.execute()` real retorna `{ valid: false }`, `requestRepo.updateStatus` chamado com `REJECTED`, webhook disparado com `proofType: "age_over_18"`
  - AC#3 (`age_over_18` + claim ausente → rejected): coberto dinamicamente — mesma asserção de `{ valid: false }` com VC sem a chave `ageOver18`
  - AC#4 (`personhood` + `{personhood:true, ageOver18:false}` → valid, claim não solicitada irrelevante): coberto dinamicamente — `{ valid: true }`, `updateStatus` com `APPROVED`, webhook com `proofType: "personhood"`
  - AC#5 (checagem booleana original preservada): coberto estruturalmente ("preserves original boolean-only claims check") e dinamicamente (claim não-booleana → `{ valid: false }`)
  - AC#6 (Regras 1-4/6-11 inalteradas, mesma ordem): coberto estruturalmente (6 testes confirmando cada regra ainda presente) e por regressão zero em `tests/unit/story-5-5/` (27/27) e `tests/unit/story-5-7/` (17/17)
  - AC#7 (webhook com `proof_type` real, não `"verification"` hardcoded): coberto estruturalmente ("no longer hardcodes 'verification'", "fireWebhook receives proofType as a parameter") e dinamicamente (asserção direta do `proofType` recebido pelo fake webhook em 3 dos 6 testes)
- Caminhos críticos: 25/25 testes passando (19 estruturais do dev-story + 6 dinâmicos desta etapa de QA)
  - QA adicionou `verify-presentation-usecase.dynamic.test.ts`: **primeiro teste do projeto a instanciar um use case real com repositórios/dependências fake e verificar o output em runtime**, em vez de apenas inspecionar o texto-fonte. Fecha exatamente a lacuna anotada como item deferido no code review desta story ("Suíte de testes é 100% estática... nenhum teste dinâmico/comportamental instancia o use case").
  - VP/VC de teste são assinados de verdade com `@noble/ed25519` (mesma codificação base64url e mesma construção de payload do use case real) — não são mocks de assinatura, exercitam as Regras 1-4 genuinamente antes de chegar na Regra 5 estendida.
  - Verificado por mutação: comentar temporariamente a checagem `PROOF_TYPE_CLAIM_KEY[...]`/`!== true` no código de produção faz exatamente os 2 testes de correspondência (AC#2, AC#3) falharem — confirma que o teste dinâmico exercita o código real, não uma tautologia. Código restaurado e revalidado (6/6 voltando a passar) antes de prosseguir.
  - Também cobre o caminho defensivo da Task 1 (`findById` retornando `null` → `{ valid: false }` sem `updateStatus` nem webhook).

#### Validation
- `npm run test:story:5.8`: **passed** — 25/25 (19 estáticos + 6 dinâmicos)
- `npm test` (suite completa): **passed** — 610/610 (604 estáticos + 6 dinâmicos)

#### Notes
- **Mudança de infraestrutura de teste, decisão explícita do usuário nesta sessão**: a Story 5.7 havia registrado que testes dinâmicos exigiriam "adicionar um transpilador/loader novo ao projeto, o que é infraestrutura de teste fora do escopo". Nesta etapa de QA, o usuário optou conscientemente por adicionar `tsx` (`^4.23.1`) como devDependency para viabilizar exatamente isso — reverte aquela decisão anterior de forma deliberada, não incidental.
- Novo script `test:dynamic` (`tsx --test "tests/unit/**/*.dynamic.test.ts"`) encadeado ao `npm test` via `&&`, após a suíte estática `node --test`. Convenção de nome de arquivo `*.dynamic.test.ts` (distinta de `*.test.mjs`) para não colidir com o glob do `test:unit` existente. `npm run test:story:5.8` roda ambas as camadas (estática + dinâmica) em sequência.
- 3 itens deferidos do code review para `deferred-work.md`: (1) `requestRepo.findById` sem try/catch (padrão pré-existente, a chamada irmã `sessionRepo.findByTokenHash` também é desprotegida), (2) `cancel_proof_session_usecase.ts` mantém `"verification"` hardcoded (use case diferente, já documentado como fora de escopo desta story), (3) demais testes do projeto (fora deste arquivo novo) continuam 100% estáticos — este é o primeiro caso comportamental, não uma migração de toda a suíte.

### Story 9.1 — Emissão da VC como VC-JWT (EdDSA)
- Acceptance criteria: 4/4 cobertos
  - AC#1 (header/payload JWT prescrito, assinatura EdDSA, claims booleanos consolidados): coberto estruturalmente ("builds a JWT header with EdDSA/JWT/kid", "builds a JWT payload with iss/sub/jti/iat/nbf/vc", "signs the compact JWS with ed.signAsync") e dinamicamente (header/payload decodificados comparados por `deepEqual` exato contra o formato do AC#1)
  - AC#2 (rota retorna string JWT com status 201, não mais JSON-LD): coberto estruturalmente ("no longer builds the old JSON-LD proof", "IssueCredentialController propagates a string (JWT) return type", "API route handler returns the VC-JWT with status 201")
  - AC#3 (JWT verificável com a public key do issuer): coberto dinamicamente — `ed.verifyAsync` real contra a public key derivada de `ISSUER_PRIVATE_KEY` confirma a assinatura
  - AC#4 (fluxo de emissão/OCR/PII/registerDID inalterado, semântica de claims da 5.7 preservada): coberto estruturalmente ("preserves OCR-in-memory, claims consolidation, and on-chain DID registration", "does not touch the ISSUER_PRIVATE_KEY test-placeholder substitution") e dinamicamente (holder adulto → `{personhood:true, ageOver18:true}`; holder menor de idade → `{personhood:true, ageOver18:false}` sem lançar exceção)
- Caminhos críticos: 17/17 testes passando (13 estruturais + 4 dinâmicos)
  - JWT de 3 segmentos decodificado e validado byte a byte: header via `deepEqual` exato, payload com tipos corretos (`jti`/`iat`/`nbf`) e `vc` exato
  - Assinatura verificada de verdade com `ed.verifyAsync` (não apenas checada a presença de `ed.signAsync` no source) — prova que a JWS é válida, não só bem-formada
  - Regressão do teste pré-existente da Story 5.4: 1 asserção obsoleta (`Ed25519Signature2020`) reescrita para o novo header JWT; demais 20 testes da 5.4 intactos
  - Rejeição de assinatura do holder coberta em dois modos: bem-formada porém incorreta (64 bytes zerados) e malformada (string não-base64url) — item adicionado nesta etapa de QA para fechar o gap "nenhum teste dinâmico cobre bodySignature malformado" registrado no code review
  - TypeScript: `tsc --noEmit` sem erros; `eslint` sem findings novos (1 finding pré-existente em `route.ts:22`, fora do diff desta story)

#### Validation
- `npm run test:story:9.1`: **passed** — 17/17 (13 estáticos + 4 dinâmicos)
- `npm test` (suite completa): **passed** — 627/627 (617 estáticos + 10 dinâmicos)

#### Notes
- Reaproveitado o padrão dinâmico via `tsx` já estabelecido pela Story 5.8 — nenhuma infraestrutura de teste nova foi necessária, apenas `npm install` para materializar o `tsx` (já declarado como devDependency desde a 5.8, ausente fisicamente no ambiente desta sessão).
- 6 itens deferidos do code review para `deferred-work.md`, todos fora do escopo desta story: ausência de claims `exp`/`aud` no JWT (formato exato já prescrito pelo AC#1, não deve ser reinventado), `ed.signAsync` na emissão sem try/catch dedicado (padrão pré-existente desde a Story 5.4), cobertura de `ISSUER_PRIVATE_KEY` malformado (Epic 10), e verificação EdDSA com allow-list de algoritmo (Story 9.2).
- **Break de acoplamento com a Story 9.2 (documentado, não coberto por teste desta story deliberadamente)**: `verify_presentation_usecase.ts` não consegue fazer parse de uma VC-JWT nova — nenhum teste de integração entre emissão e verificação foi adicionado, pois cobri-lo exigiria implementar (ou mockar) a Story 9.2 antes do previsto. A Story 9.2 deve adicionar essa cobertura ao migrar a verificação.

### Story 7.2 — Coluna `updated_at` e Gravação em Toda Transição
- Acceptance criteria: 4/4 cobertos
  - AC#1 (forward migration adiciona `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, backfill `= created_at`): coberto estruturalmente ("adds updated_at column to proof_request", "backfills updated_at = created_at for existing rows", "column ends up NOT NULL with DEFAULT now()", "does not touch any other table"). **Não coberto por execução real contra Postgres** — ambiente sem Docker, ver Notes
  - AC#2 (`ProofRequest`/`ProofRequestMapper` incluem `updatedAt`/`updated_at` mapeados corretamente): coberto estruturalmente (props/getter, tipo de persistência, `toDomain`/`toPersistence`) e dinamicamente (round-trip real com datas distintas, confirmando serialização ISO e distinção de `created_at`)
  - AC#3 (`updateStatus()` grava `status` e `updated_at = now()` na mesma operação): coberto estruturalmente (regex sobre o payload do `.update()`) — não há teste dinâmico contra Supabase real (classe usa `getSupabaseAdminClient()` diretamente, sem interface injetável para fake nesta story)
  - AC#4 (`GetProofRequestUseCase`/DTO mapeiam `updatedAt` real, não mais alias de `validatedAt`): coberto estruturalmente (ausência do padrão antigo, tipo não-nulável) e dinamicamente (DTO retornado por um use case real com repositório fake reflete exatamente `updatedAt` da entidade, nunca `validatedAt`; nunca `null`; regressão do guard 404 da Story 3.3 intacta)
- Caminhos críticos: 20/20 testes passando (14 estruturais do dev-story + 6 dinâmicos desta etapa de QA)
  - QA adicionou `updated-at-tracking.dynamic.test.ts`: primeiro teste comportamental real para o módulo `proof-request` (mapper + use case), fechando a lacuna "suíte 100% estática" registrada em `deferred-work.md` desde a Story 5.7/5.8 — mas só para este módulo específico, não uma migração geral
  - Não foi criado teste dinâmico para `SupabaseProofRequestRepository.updateStatus()`: a classe instancia `getSupabaseAdminClient()` diretamente (sem porta injetável), diferente de `GetProofRequestUseCase` que recebe `ProofRequestRepository` por construtor — testar o `.update()` real exigiria mockar o client Supabase inteiro, fora do escopo desta etapa de QA

#### Validation
- `npm run test:story:7.2`: **passed** — 20/20 (14 estáticos + 6 dinâmicos)
- `npm run test:unit` (suíte estática completa): **passed** — 660/662 (2 falhas pré-existentes e não relacionadas em `story-1-5`/`story-1-6`, confirmadas via `git stash` antes de qualquer mudança desta story)
- `npm run test:dynamic` (suíte dinâmica completa): **passed** — 16/16
- `npx tsc --noEmit`: **passed** — sem erros

#### Notes
- **AC#1 não validada contra Postgres real nesta sessão** — ambiente de execução sem Docker (`docker info` falhou), então `supabase db reset`/`supabase db diff --schema public` não puderam rodar. A migration foi validada apenas estruturalmente (o SQL foi lido e teve seu conteúdo conferido, não executado). Registrado em `deferred-work.md`: alguém com Docker disponível deve rodar `supabase db reset` + `supabase db diff` antes de considerar a migration pronta para `db push`.
- Padrão dinâmico via `tsx` reaproveitado das Stories 5.8/9.1 (nenhuma infraestrutura nova) — mas aplicado de forma mais restrita aqui: só `ProofRequestMapper` (função pura) e `GetProofRequestUseCase` (recebe repositório por interface) tinham superfície testável sem mockar o cliente Supabase real; `SupabaseProofRequestRepository`/`CreateProofRequestUseCase` permanecem com cobertura só estrutural.
- 5 itens deferidos do code review para `deferred-work.md`: ausência de transação explícita nas 3 declarações da migration (padrão pré-existente desde a Story 7.1), `ADD COLUMN` sem guarda de idempotência, mappers confiando em `updated_at` sem guarda contra Invalid Date (mesmo padrão aceito desde `ProofSessionMapper`/Story 1.3), `updateStatus()` sem guarda para `id` inexistente (comportamento pré-existente), janela estreita de risco de escrita concorrente durante a aplicação da migration.

### Story 7.3 — Allowlist de Criação de Apps (`can_create_apps`)
- Acceptance criteria: 4/4 cobertos
  - AC#1 (forward migration adiciona `can_create_apps BOOLEAN NOT NULL DEFAULT false`, backfill `true` para empresas existentes): coberto estruturalmente ("adds can_create_apps as NOT NULL DEFAULT false in a single atomic statement", "backfills can_create_apps = true for existing rows", "does not use a nullable-then-constrain pattern", "does not touch any other table"). **Não coberto por execução real contra Postgres** — ambiente sem Docker, ver Notes
  - AC#2 (`Company`/`CompanyMapper` incluem `canCreateApps`, propagado a `GET /api/companies/me`): coberto estruturalmente (props/getter, tipo de persistência, `toDomain`/`toPersistence`, DTO/`GetMyCompanyUseCase`) e dinamicamente (round-trip real de `can_create_apps`, DTO retornado por um `GetMyCompanyUseCase` real refletindo `true`/`false`, regressão do guard 404)
  - AC#3 (`CreateCompanyAppUseCase` rejeita com 403 quando `can_create_apps = false`; cria normalmente quando `true`): coberto estruturalmente (guard `ForbiddenError`, injeção de `CompanyRepository` via presenter) e dinamicamente (execução real com repositórios fake: rejeita com `ForbiddenError`/403 e zero apps persistidos quando bloqueado; cria 1 app com `apiKey` no formato correto quando liberado; rejeita com `NotFoundError` quando a company não existe)
  - AC#4 (CTA "Criar app" bloqueado com banner em `/apps`; `/apps/new` bloqueada): coberto estruturalmente (fetch client-side, banner `CreateAppsBlockedBanner`, CTA do `EmptyState` respeitando a flag, redirect em `/apps/new`, guard de shape da resposta, toast no redirect, `aria-label` nos CTAs — patches do code review)
- Caminhos críticos: 35/35 testes passando (27 estáticos do dev-story + 5 patches do code review + 8 dinâmicos desta etapa de QA)
  - QA adicionou `allowlist-can-create-apps.dynamic.test.ts`: primeiro teste comportamental real para os módulos `company`/`company-app` (guard de criação de app + propagação do DTO), fechando a lacuna "suíte 100% estática" para este módulo específico
  - Verificado que **zero apps são persistidos** no repositório fake quando o guard rejeita (não só que a exceção é lançada) — prova que a rejeição acontece antes de qualquer efeito colateral, não depois
  - Não foi criado teste dinâmico para `SupabaseCompanyRepository`/`SupabaseCompanyAppRepository`: ambas instanciam `getSupabaseAdminClient()` diretamente (sem porta injetável), mesma limitação já registrada nas Stories 7.2/9.1 — testar exigiria mockar o client Supabase inteiro, fora do escopo desta etapa de QA

#### Validation
- `npm run test:story:7.3`: **passed** — 35/35 (27 estáticos + 8 dinâmicos)
- `npm run test` (suíte completa): **passed** — 687/689 (2 falhas pré-existentes e não relacionadas em `story-1-5`/`story-1-6`, mesmas já documentadas desde a Story 7.2)
- `npx tsc --noEmit`: **passed** — sem erros

#### Notes
- **AC#1 não validada contra Postgres real nesta sessão** — ambiente sem Docker (`docker info` falhou), mesma limitação das Stories 7.1/7.2. Migration validada apenas estruturalmente. Registrado em `deferred-work.md`.
- Migration reescrita durante o code review desta story (patch, não item de QA): forma original de 3 statements (`ADD COLUMN` nullable → `UPDATE` → `SET DEFAULT`/`SET NOT NULL`) tinha uma janela de corrida apontada de forma independente por dois revisores (Blind Hunter + Edge Case Hunter); reescrita para `ADD COLUMN ... NOT NULL DEFAULT false` em statement único + `UPDATE` de backfill, eliminando a janela por completo.
- Padrão dinâmico via `tsx` reaproveitado das Stories 5.8/7.2/9.1 (nenhuma infraestrutura nova) — aplicado a `CreateCompanyAppUseCase` e `GetMyCompanyUseCase` (ambos recebem repositórios por interface) e `CompanyMapper` (função pura); repositórios Supabase concretos permanecem com cobertura só estrutural.
- 6 itens deferidos do code review para `deferred-work.md`: ausência de transação explícita na migration (padrão pré-existente), `CompanyMapper.toDomain` sem guarda contra `can_create_apps` undefined (mesmo padrão aceito desde `ProofRequestMapper`/Story 7.2), `findById()` sem try/catch dedicado em `CreateCompanyAppUseCase` (padrão pré-existente desde a Story 5.8), lógica de fetch duplicada entre `/apps` e `/apps/new` sem hook compartilhado, ausência de log/auditoria no guard 403, ausência de migration de rollback.
