# Test Automation Summary

## Generated Tests

### Unit Tests

- [x] tests/unit/story-1-1/restructure.test.mjs - Story 1.1 contratos estruturais: aliases, layout src/, env centralizado, pastas obsoletas, entrypoints preservados, TypeScript clean
- [x] tests/unit/story-1-2/middleware.test.mjs - Story 1.2 contratos de middleware: arquivo, helpers, routing por método/path, remoção de requireAuthenticatedUser, injeção de x-company-id
- [x] tests/unit/story-1-3/proof-session-schema.test.mjs - Story 1.3 contratos de schema: entidade, mapper, use cases, repository, regressão da tela coringa
- [x] tests/unit/story-1-3/dependencies.test.mjs - Story 1.3 dependências de formulário: react-hook-form, @hookform/resolvers, compilação TypeScript
- [x] tests/unit/story-1-4/fetch-with-auth.test.mjs - Story 1.4 contrato do fetchWithAuth: assinatura, intercept 401, redirect ?next=, throw-after-redirect, guard SSR, migração de 4 endpoints em apps-store, review patch do settings page
- [x] tests/unit/story-1-4/sign-in-redirect.test.mjs - Story 1.4 redirect pós-login: leitura do ?next=, open-redirect guard (inline + source), remoção de código legado /api/companies/me

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

## Notes

- Todos os testes usam `node:test` + `node:assert/strict` (framework nativo Node.js, sem dependências externas)
- Os testes para Story 1.3 são de contrato de código-fonte (source inspection), adequados para uma story de refatoração de schema sem lógica de negócio nova
- A migration SQL (`supabase/migrations/20260513_update_proof_sessions.sql`) foi aplicada manualmente via Supabase Dashboard e deletada; o contrato TypeScript (testes de schema) serve como evidência de que o TypeScript está alinhado com o schema aplicado
- Deferred do code review (Story 5.3, 4.1): não há testes para setChallenge() nem para lógica de expiração na entidade — esses são escopo das stories correspondentes
- Os testes da story 1.2 foram atualizados para referenciar `src/shared/middleware.ts` (novo caminho após mudança staged que moveu o middleware de `src/middleware.ts`)
