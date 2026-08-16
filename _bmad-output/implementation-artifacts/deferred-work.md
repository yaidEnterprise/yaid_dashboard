## Deferred from: code review of story-7-5-review-manual-em-apps-homologacao (2026-08-16)

- **Race condition (TOCTOU) na transição de status** — `ReviewProofRequestUseCase` lê um snapshot via `findById()`, valida o guard de status terminal contra esse snapshot, e escreve via `updateStatus()` sem compare-and-swap. Duas chamadas de review concorrentes para a mesma request (duas abas, retry duplicado) podem ambas passar o guard 422 antes de qualquer escrita, resultando em dois disparos de webhook ou um `reject` sobrescrevendo um `approve` recém-aplicado. `ProofRequestRepository.updateStatus()` não suporta update condicional (`WHERE status IN (...)`) e é compartilhada por `cancel_proof_session_usecase.ts` e `verify_presentation_usecase.ts`, que têm a mesma limitação — corrigir exige mudar a interface do repositório, uma mudança cross-cutting fora do escopo desta story. [`src/modules/proof-request/app/review_proof_request_usecase.ts`, `src/shared/domain/interfaces/repositories/ProofRequestRepository.ts`]

- **`updatedAt` calculado em memória em vez de lido de volta do banco** — `ReviewProofRequestUseCase.execute()` retorna `new Date().toISOString()` computado na aplicação, não o valor que `updateStatus()` efetivamente persistiu (`updateStatus()` retorna `Promise<void>`). O drift prático é sub-milissegundo dentro da mesma request, mas o response/webhook/UI podem, em teoria, divergir do valor real no banco. Mesma limitação estrutural do item acima. [`src/modules/proof-request/app/review_proof_request_usecase.ts`]

- **`req.headers.get("x-company-id")!` sem guard contra `null`** — se o middleware não rotear a request por `withSessionAuth` por algum motivo não previsto, `companyId` chega `null` e o `!` silencia o type system. Padrão idêntico ao já existente na rota GET irmã (`app/api/proof-requests/[requestId]/route.ts`), não introduzido por esta story. [`app/api/proof-requests/[requestId]/review/route.ts`]

- **`await req.json()` sem tratamento de corpo malformado/vazio** — um `SyntaxError` de JSON inválido cai no branch genérico 500 de `handleHttpError` em vez de um 400 mais preciso. Padrão idêntico ao já existente em `app/api/proof-requests/route.ts` (rota B2B de criação), não introduzido por esta story. [`app/api/proof-requests/[requestId]/review/route.ts`]

- **`ReviewConfirmDialog` sem focus trap** — Tab pode levar o foco para fora do modal enquanto ele está visível. Mesma lacuna de acessibilidade já presente no `DisableConfirmDialog` (`app/(dashboard)/apps/[appId]/page.tsx`) que esta story reaproveitou como padrão de referência; corrigir isoladamente aqui deixaria os dois diálogos inconsistentes entre si — considerar um fix compartilhado se um terceiro diálogo aparecer. [`app/(dashboard)/proof-requests/[requestId]/page.tsx`]

- **`useEffect` do diálogo re-executa em re-renders não relacionados do pai** — depende de `onCancel`, passado como arrow function inline (`onCancel={() => setReviewDialog(null)}`), então qualquer re-render do pai por motivo não relacionado recria a referência e rechama `.focus()` no botão de confirmação. Padrão idêntico ao já existente em `DisableConfirmDialog`/`app/(dashboard)/apps/[appId]/page.tsx:621`, não introduzido por esta story. [`app/(dashboard)/proof-requests/[requestId]/page.tsx`]

- **Botões "Aprovar"/"Reprovar" do header não desabilitados durante `reviewLoading`** — clicar novamente enquanto uma decisão está em voo reabre/reseta o diálogo; sem risco de double-submit real porque o botão de confirmação do diálogo já fica desabilitado pelo mesmo estado `reviewLoading` compartilhado. Severidade baixa. [`app/(dashboard)/proof-requests/[requestId]/page.tsx`]

- **Sem validação de formato do `requestId`** antes de chegar ao repositório (UUID ou outro formato). Mesmo padrão da rota GET irmã, que também não valida. [`app/api/proof-requests/[requestId]/review/route.ts`]

- **Resposta de `reviewProofRequest()` é apenas type-cast, sem validação de schema em runtime** — `(await asJson(res)) as ReviewProofRequestResult` confia no shape sem checagem. Mesmo padrão já usado por `getProofRequest()` no mesmo arquivo. [`utils/proof-requests-store.ts`]

## Deferred from: code review of story-7-3-allowlist-de-criacao-de-apps (2026-08-09)

- **Migration sem transação explícita** — `ADD COLUMN ... NOT NULL DEFAULT false` + `UPDATE` não estão envolvidas em `BEGIN`/`COMMIT` explícito. Pré-existente como padrão do projeto (mesma observação já feita e deferida nas Stories 7.1/7.2). [`supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`]

- **`CompanyMapper.toDomain` confia em `raw.can_create_apps` sem guarda contra `undefined`/malformado** — se o valor vier nulo/corrompido do banco (linha lida antes do backfill terminar, réplica defasada), o campo booleano da entidade recebe um valor não-booleano silenciosamente. Mesmo padrão já aceito em outros mappers do projeto (ex.: `ProofRequestMapper.updated_at`, deferido desde a Story 7.2, que por sua vez cita o precedente da Story 1.3 em `ProofSessionMapper`). [`src/shared/infra/dto/CompanyMapper.ts`]

- **`CreateCompanyAppUseCase.execute()` não envolve `companyRepository.findById()` em try/catch dedicado** — se a chamada lançar um erro cru do Supabase/Postgres (não um `AppError`), ele se propaga sem tradução até `handleHttpError` na borda da rota, que converte para 500 genérico. Mesmo padrão pré-existente em outros use cases do projeto (ex.: `verify_presentation_usecase.ts`, documentado desde a Story 5.8). [`src/modules/company-app/app/create_company_app_usecase.ts`]

- **Lógica de fetch/guard de `canCreateApps` duplicada entre `/apps` e `/apps/new`** — ambas as páginas implementam independentemente o fetch de `GET /api/companies/me`, a validação de shape e o fallback fail-open. Nenhum hook compartilhado foi extraído (ex.: `useCanCreateApps()`). Risco baixo de drift; considerar extrair se um terceiro consumidor aparecer. [`app/(dashboard)/apps/page.tsx`, `app/(dashboard)/apps/new/page.tsx`]

- **Nenhum log/auditoria quando o guard 403 rejeita uma tentativa de criação de app** — rota de rejeição relevante para segurança sem visibilidade operacional (quem tentou, quando). Fora do escopo dos ACs desta story; considerar ao evoluir observabilidade. [`src/modules/company-app/app/create_company_app_usecase.ts`]

- **Migration `add_can_create_apps_to_company` não validada contra Postgres real** — ambiente de execução desta story não tinha Docker disponível (`docker info` falhou, sem daemon), então `supabase db reset`/`supabase db diff --schema public` não puderam ser rodados. Mesma limitação já registrada nas Stories 7.1/7.2. A migration foi validada apenas estruturalmente (teste lê o SQL e confere `ADD COLUMN ... NOT NULL DEFAULT false` + backfill `true`, sem `ALTER COLUMN` separado). Antes de `supabase db push`, alguém com Docker disponível deve rodar `supabase db reset` localmente e confirmar `supabase db diff --schema public` retornando "No schema changes found". [`supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`]

- **Client-side "fails open" em `/apps` e `/apps/new` para qualquer falha de fetch (não só rede/timeout)** — se `GET /api/companies/me` retornar erro de rede, resposta não-2xx, ou corpo com shape inesperado, ambas as páginas assumem `true`/`"yes"` (CTA habilitado / formulário renderizável) em vez de bloquear. Decisão deliberada: o guard real (403) vive no `CreateCompanyAppUseCase`, então o pior caso é o usuário ver o formulário e receber um toast de erro ao submeter — não uma falha de segurança. Se esse padrão gerar reclamações de UX, considerar "fail closed" com uma tela de erro dedicada. [`app/(dashboard)/apps/page.tsx`, `app/(dashboard)/apps/new/page.tsx`]

- **Sem endpoint/UI para alternar `can_create_apps`** — a Story 7.3 só implementa o guard e o estado bloqueado; a liberação em si é manual via SQL/admin direto no banco, sem ferramenta de gestão nem trilha de auditoria de quem liberou/quando. Fora do escopo da AC atual; considerar uma story futura de "gestão de allowlist" se o volume de empresas crescer. [`src/shared/domain/entities/Company.ts`]

- **Sem migration de rollback** — só a forward migration existe; reverter após deploy exige SQL manual. Padrão consistente com as Stories 7.1/7.2 (nenhuma delas tem rollback scriptado). [`supabase/migrations/20260809165356_add_can_create_apps_to_company.sql`]

## Deferred from: code review of story-7-2-coluna-updated-at-e-gravacao-em-toda-transicao (2026-08-05)

- **Migration sem transação explícita entre as 3 declarações** — `ADD COLUMN` → `UPDATE` backfill → `ALTER ... SET NOT NULL` não estão envolvidas em `BEGIN`/`COMMIT` explícito; se o runner não tratar o arquivo como uma transação implícita, uma falha no meio deixa a coluna nullable sem default. Pré-existente como padrão do projeto (o baseline da Story 7.1 também não usa transação explícita). [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]

- **`ADD COLUMN` sem guarda de idempotência** — replay parcial da migration falha em vez de fazer no-op. Risco baixo, migrations não costumam ser replayadas manualmente neste projeto. [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]

- **`ProofRequestMapper`/`GetProofRequestUseCase` confiam em `updated_at` sem guarda contra Invalid Date** — se o valor vier `null`/malformado do banco, `new Date(...)` e o posterior `.toISOString()` falham silenciosa ou ruidosamente. Mesmo padrão já aceito em outros mappers do projeto (ex.: `ProofSessionMapper.challenge_created_at`, deferido desde a Story 1.3). [`src/shared/infra/dto/ProofRequestMapper.ts`, `src/modules/proof-request/app/get_proof_request_usecase.ts`]

- **`SupabaseProofRequestRepository.updateStatus()` não verifica se `id` correspondeu a alguma linha** — update silencioso vira no-op sem sinalizar erro ao chamador. Comportamento pré-existente, não introduzido por esta story (que só adicionou `updated_at` ao payload). [`src/shared/infra/repositories/SupabaseProofRequestRepository.ts:106-112`]

- **Janela estreita de risco: escrita concorrente sem `updated_at` durante a aplicação da migration** — se uma linha for inserida entre o `ADD COLUMN` e o `SET NOT NULL`, este último falha. Risco baixo em deploy single-writer; mesmo perfil de risco de qualquer migration aditiva `NOT NULL`. [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]

## Deferred from: story-7-2-coluna-updated-at-e-gravacao-em-toda-transicao (2026-08-05)

- **Migration `add_updated_at_to_proof_requests` não validada contra Postgres real** — ambiente de execução desta story não tinha Docker disponível (`docker info` falhou), então `supabase db reset`/`supabase db diff --schema public` não puderam ser rodados. A migration foi validada apenas estruturalmente (teste lê o SQL e confere a presença de `ADD COLUMN`/`UPDATE ... SET updated_at = created_at`/`SET NOT NULL`). Antes de `supabase db push`, alguém com Docker disponível deve rodar `supabase db reset` localmente e confirmar `supabase db diff --schema public` retornando "No schema changes found". [`supabase/migrations/20260805223534_add_updated_at_to_proof_requests.sql`]
## Deferred from: code review of story-11-8-sync-autoritativo-de-env-vars-no-amplify (2026-08-09)

- **Valor vazio (`""`) e valor ausente são indistinguíveis na resolução do sync** — o passo usa `jq -r --arg n "$name" '.[$n] // empty'` contra `SECRETS_JSON`/`VARS_JSON`; uma GitHub Variable/Secret legitimamente configurada como string vazia é tratada exatamente como "ausente" e omitida do payload em vez de sincronizada como `""`. Baixa probabilidade prática (nenhuma das 13 vars do `.env.local.example` é esperada como string vazia legítima hoje). Corrigir exigiria trocar para `has($n)` e decidir a semântica correta para "existe mas é vazio" — decisão de produto, não puramente técnica. [`.github/jobs/deploy-amplify/action.yml`]

- **`toJSON(secrets)` expõe todos os secrets do repositório/environment ao composite `deploy-amplify`** — antes desta story, só um secret curado (`AMPLIFY_ENVIRONMENT_VARIABLES`) entrava no composite; agora o payload inteiro de `secrets.*` (incluindo `AWS_*`, `SUPABASE_ACCESS_TOKEN`, ARNs, etc.) é serializado para dentro do step via `SECRETS_JSON`. É uma decisão arquitetural explícita da AC4/Story 11.8 (mandatada pela sprint-change-proposal 2026-08-09), não um bug de implementação — mas aumenta o blast radius em caso de bug futuro no script. Mitigado parcialmente por um denylist de nomes de secrets de infra adicionado no code review (ver patch aplicado), mas o payload continua sendo o superset completo de secrets. Reavaliar se o modelo deve migrar para GitHub Environments com Secrets escopados por ambiente. [`.github/jobs/deploy-amplify/action.yml`, `.github/workflows/production.yml`]

- **`.env.local.example` trocou defaults funcionais por placeholders `YOUR_*`** — `NEXT_PUBLIC_APP_URL` (antes `http://localhost:3000`), `NEXT_PUBLIC_SUPABASE_URL`, `OCR_API_URL` etc. agora usam placeholders não-funcionais em vez de valores prontos para dev local. Pré-existente ao trabalho da Story 11.8 (a reorganização do arquivo já estava assim no working tree antes desta story começar; a Story 11.8 só reconciliou `SUPABASE_DB_PASSWORD`/`YAID_VERIFICATION_BASE_URL`). Considerar restaurar defaults funcionais para `NEXT_PUBLIC_APP_URL` num commit separado, já que agora o arquivo também é o manifesto operacional de nomes sincronizados com produção. [`.env.local.example`]

- **Suíte de testes do sync nunca executa de fato o pipeline grep/sed/jq** — `tests/unit/story-11-5/*.test.mjs` e `tests/unit/story-11-8/env-var-sync-authoritative.test.mjs` fazem apenas parsing YAML + regex sobre o texto do step `run:`, nunca rodam a lógica bash real contra fixtures de `SECRETS_JSON`/`VARS_JSON`/`.env.local.example`. Isso significa que bugs de comportamento real (ex.: a precedência Secrets→Variables, ou o bug de string vazia acima) não são pegos por teste automatizado, só por revisão manual/adversarial. Segue o padrão estrutural já estabelecido em todas as Stories 11.2–11.7 (GitHub Actions/AWS não rodam no sandbox); mudar exigiria uma decisão de estratégia de teste para o Epic 11 inteiro (ex.: extrair o script para um arquivo `.sh` standalone testável via `child_process`). [`tests/unit/story-11-5/`, `tests/unit/story-11-8/`]

## Deferred from: code review of story-11-3-workflow-job-tests (2026-08-09)

- **GitHub Actions referenciados por tags de major mutáveis em vez de commit SHAs** — `actions/checkout@v4` e `actions/setup-node@v4` usam tags que apontam para o head da major version, permitindo (em tese) que uma atualização maliciosa da action rode no CI sem alteração no repo. Hardening de supply-chain recomendado: fixar por commit SHA (`actions/checkout@<sha>`). Consistente com o restante do projeto (nenhuma story fixa SHA); deferido para a Story 11.7 (documentação/hardening operacional do Epic 11), onde faz sentido estabelecer a política de pinning para toda a pipeline de uma vez. [`.github/jobs/tests/action.yml`, `.github/workflows/production.yml`]

## Deferred from: code review of story-11-2-amplify-yml-e-desabilitar-auto-build (2026-08-09)

- **Testes estruturais desta story usam regex/string-matching sobre `amplify.yml` em vez de um parser YAML real** — `js-yaml` está presente apenas transitivamente em `node_modules`, não declarado em `package.json`. O AC #1 ("YAML válido") é verificado por proximidade de texto, não por parse semântico real; uma reordenação de chaves ou inserção de uma fase `postBuild` legítima entre `build` e `artifacts` poderia, em tese, escapar da captura de regex sem quebrar o teste. Padrão sistêmico já estabelecido em todas as stories anteriores do projeto (nenhuma dependência de parsing YAML declarada); introduzir `js-yaml` como dependência nova exigiria aprovação explícita do usuário, fora do escopo desta execução autônoma. [`tests/unit/story-11-2/amplify-yml-e-desabilitar-auto-build.test.mjs`]

- **Nada no repositório verifica automaticamente que a desabilitação do Auto Build foi de fato executada na conta AWS de produção** — `docs/ops/amplify-deploy.md` documenta a ação manual (Console/CLI), mas o status desta story reflete apenas que o código/config/documentação foram autorados corretamente, não que o estado real do Amplify App foi alterado. Limitação inerente ao escopo declarado (sem credenciais AWS neste ambiente), mitigada pela seção "Verificação" do documento. Considerar incluir num checklist de rollout de produção em story futura (ex.: Story 11.7 — documentação operacional). [`docs/ops/amplify-deploy.md`]

- **App Amplify real também precisa estar configurado como "Web Compute" (SSR) no nível do próprio App, não só via `amplify.yml`** — se o App tiver sido originalmente detectado/criado como site estático, `baseDirectory: .next` textualmente correto não evita 404 em rotas SSR/middleware. O documento menciona a exigência, mas — diferente do tratamento dado à desabilitação do Auto Build — não tem passo a passo Console/CLI nem verificação dedicada para essa precondição. Fora do escopo desta story (depende de acesso ao Amplify App real); considerar formalizar via story futura ou ampliar a seção existente. [`docs/ops/amplify-deploy.md`]

## Deferred from: code review of story-11-1-health-check-endpoint (2026-08-08)

- **`updateSupabaseSession` roda para toda requisição a `/api/health` antes do check `isPublicApiRoute`** — o `middleware()` refresca a sessão Supabase (chamada de rede) para toda rota interceptada pelo matcher, incluindo `/api/health`, antes de qualquer branch de classificação de rota decidir se ela exige autenticação. Isso injeta uma dependência de rede no caminho do health check, na leitura ampla do AC #5 ("nenhuma chamada de rede/IO bloqueante... pode estar no caminho do handler"). Pré-existente: o mesmo padrão já se aplica a `/api/webhook-public-key`, que também é documentado como rota "sem DB". Corrigir exige reestruturar a ordem de early-return do `middleware()` para toda uma categoria de rotas públicas — fora do escopo de uma story de whitelist de uma linha. [`src/shared/middleware.ts:53`]

- **Teste estrutural de `isPublicApiRoute`/outros classificadores usa `indexOf("function ...")` → `indexOf("\n}", fnStart)` para delimitar o corpo da função** — frágil a blocos com chaves aninhadas antes do fechamento real da função (ex.: um `if` multi-linha). Correto hoje porque nenhuma das 4 funções de classificação (`isDashboardPage`, `isPublicAuthPage`, `isSessionAuthApiRoute`, `isPublicApiRoute`, `isDIDAuthRoute`) tem chaves aninhadas antes do fechamento. Considerar usar um parser real (ex.: regex de limite de função ou AST) se o middleware crescer em complexidade. [`tests/unit/story-11-1/health-check-endpoint.test.mjs`]

## Deferred from: one-shot icone-maior-e-favicon (2026-08-05)

- **Safari exibe `favicon.ico` placeholder** — Safari não suporta SVG favicon; usa o `app/favicon.ico` padrão do Next.js. Gerar um `.ico` real (16×16 e 32×32) requer tooling externo (sharp, imagemagick). Considerar adicionar um script de build que converta `yaid_icon.svg` para `.ico` quando a stack de build for estabilizada. [`app/favicon.ico`]

## Deferred from: one-shot remocao-texto-yaid-icone (2026-08-04)

- **Margin do conteúdo principal não ajusta ao colapsar sidebar** — `app/(dashboard)/layout.tsx` hardcoda `lg:ml-[260px]` como offset, mas quando o sidebar colapsa para `w-[60px]` o conteúdo não acompanha, gerando ~200px de espaço em branco. Pré-existente; considerar tornar a margem dinâmica via CSS var ou contexto React. [`app/(dashboard)/layout.tsx`]

- **`useSidebarWidth()` retorna sempre 260** — hook exportado em `app-sidebar.tsx` ignora o estado `collapsed` (local ao componente) e hardcoda 260. Qualquer consumidor futuro receberá o valor errado quando o sidebar estiver colapsado. Pré-existente, não introduzido por esta mudança. [`components/layout/app-sidebar.tsx`]

## Deferred from: code review of story-7-6-remocao-secao-resposta-da-api (2026-07-30)

- **Componente `CodeBlock` fica sem consumidores após a remoção** — `components/api/code-block.tsx` exporta `CodeBlock` e `InlineCode`; `InlineCode` segue em uso ativo nesta mesma página, mas `CodeBlock` (grep confirmado) não é mais importado em nenhum lugar da codebase após esta story. Não deletado nesta story por decisão explícita de escopo (o arquivo é compartilhado e `InlineCode` continua em uso); avaliar remover o export `CodeBlock` (ou o componente inteiro, se nenhuma outra tela vier a precisar de um bloco de código copiável) numa limpeza futura, ou reaproveitá-lo caso surja uma tela de documentação/API que precise dele. [`components/api/code-block.tsx`]
## Deferred from: code review of story-5-8-correspondencia-entre-claim-e-proof-type (2026-07-31)

- **`requestRepo.findById(proofRequestId)` sem try/catch** — se retornar `null` (integridade referencial quebrada), o método sai por `{ valid: false }` sem chamar `updateStatus` nem disparar webhook (sem rastro de auditoria); se a chamada lançar (erro transitório de rede/DB), a exceção só é convertida em 500 genérico na borda da rota (`handleHttpError`), diferente do padrão gracioso `reject()` usado nas Regras 9/10 para chamadas de blockchain. A chamada irmã `sessionRepo.findByTokenHash` (linha 95) já é igualmente desprotegida — corrigir só o `findById` novo criaria uma inconsistência local; corrigir ambas está fora do escopo desta story. [`src/modules/presentation/app/verify_presentation_usecase.ts:106-110`]

- **`cancel_proof_session_usecase.ts:50` mantém o literal `"verification"` hardcoded no payload do webhook** — use case e endpoint diferentes (Story 5.6, `POST /api/proof-sessions/{token}/cancel`). Nenhuma AC da Story 5.8 cobre esse fluxo; já documentado como fora de escopo no Dev Notes da própria story. [`src/modules/proof-session/app/cancel_proof_session_usecase.ts:50`]

- **Suíte de testes é 100% estática** — nenhum teste dinâmico/comportamental instancia `VerifyPresentationUseCase` com repositórios mockados para verificar o `{ valid: true/false }` retornado em runtime nem a transição real de `proof_request.status` para os novos cenários de correspondência claim ↔ proof_type. Padrão sistêmico em todas as stories desde a 5.4/5.5, já deferido no code review da Story 5.7. [`tests/unit/story-5-8/claim-proof-type-correspondence.test.mjs`]

## Deferred from: code review of story-5-7-consolidacao-de-claims-na-emissao (2026-07-31)

- **Payload assinado (`documentImage` puro) sem domain separator/nonce** — replayable se o mesmo valor assinado for reaproveitado. Pré-existente desde a Story 5.4 (o antigo `:${proofType}` no payload não funcionava como nonce/anti-replay, era só um classificador fixo); não introduzido nem agravado pela consolidação de claims desta story. [`src/modules/credential/app/issue_credential_usecase.ts:83`]

- **Fallback hardcoded `test-issuer-private-key` → chave privada conhecida publicamente permanece sem guarda fora do stage TEST** — já mapeado como escopo do Epic 10 (Story 10.2 — validação de formato de chaves no boot). Não tocado nesta story por instrução explícita do Dev Notes. [`src/modules/credential/app/issue_credential_usecase.ts:143-146`]

- **`claims` tipado como `Record<string, boolean>` genérico** — sem garantia em tempo de compilação restrita às duas chaves conhecidas (`personhood`, `ageOver18`). Forma de tipo pré-existente desde a Story 5.4. [`src/modules/credential/app/issue_credential_usecase.ts:20`]

- **Suíte de testes é 100% estática (regex sobre o source + `tsc --noEmit`)** — nenhum teste dinâmico/comportamental executa o use case com dependências mockadas para verificar o output em runtime (ex.: assinatura real, cálculo de idade com datas de teste). Padrão sistêmico em todas as stories do projeto, não específico deste diff. [`tests/unit/story-5-7/claim-consolidation.test.mjs`]

- **Robustez de fronteira de `ocrResult.birthDate` depende inteiramente do contrato do `OcrProvider`** — sem checagem defensiva no use case para `OcrResult` nulo/indefinido ou datas de nascimento futuras/implausíveis. O mesmo padrão já existia no branch `ageOver18` pré-5.7 (mesmo código, mesma ausência de guarda), agora exercitado em 100% das requisições em vez de só quando `proofType === "ageOver18"` era pedido. Mitigado hoje porque `ApiOcrProvider` lança exceção antes de retornar dado malformado (`ApiOcrProvider.ts:73`), mas não defendido explicitamente na fronteira do use case. [`src/modules/credential/app/issue_credential_usecase.ts:118-130`]

## Deferred from: code review of story-7-1-fundacao-de-versionamento-de-schema (2026-07-28)

- **Grants amplos + RLS habilitado sem políticas nas 4 tabelas públicas** — o baseline captura `GRANT DELETE, INSERT, SELECT, UPDATE` para `anon`/`authenticated` em `company`, `company_apps`, `proof_request`, `proof_sessions`, com RLS habilitado mas zero políticas definidas. Estado pré-existente no banco de produção (capturado fielmente por esta story, não introduzido por ela). Hoje o app usa a service role key server-side (bypassa RLS), consistente com `architecture.md` ("sem RLS no MVP"), então não é uma vulnerabilidade ativa — mas vale uma story de governança de RLS dado o tema do Epic 7 ("Governança de Criação"). [`supabase/migrations/20260728015653_remote_schema.sql`]

- **`GRANT ALL` na função `rls_auto_enable()` para `anon`/`authenticated`** — permite `EXECUTE` direto numa função `SECURITY DEFINER` fora do contexto de event trigger. Artefato injetado pela própria plataforma Supabase (não escrito pela equipe), capturado fielmente no baseline. Fora do escopo de uma story de captura de schema; considerar revogar o grant numa forward migration futura se alguém tocar em `company`/`company_apps`/`proof_request`/`proof_sessions`. [`supabase/migrations/20260728015653_remote_schema.sql`]

## Deferred from: code review of story-6-2-endpoint-publico-da-chave-de-webhook (2026-07-22)

- **Sem cache da public key entre requisições** — `GetWebhookPublicKeyUseCase.execute()` recomputa `ed.getPublicKeyAsync` a cada `GET /api/webhook-public-key`, mesmo a resposta sendo determinística (constante enquanto `WEBHOOK_SIGNING_PRIVATE_KEY` não mudar). Sem `Cache-Control`/`ETag` na rota. Otimização de performance para uma rota pública que pode ser chamada com frequência; não exigida pelos ACs da Story 6.2. [`src/modules/webhook/app/get_webhook_public_key_usecase.ts`, `app/api/webhook-public-key/route.ts`]

- **Duplicação de forma de saída sem fonte única de verdade** — `GetWebhookPublicKeyOutput` (interface no usecase) e `GetWebhookPublicKeyOutputDTO` (type no viewmodel) declaram a mesma forma `{ publicKey: string; algorithm: "Ed25519" }` de forma independente, e o literal `"Ed25519"` é repetido em 3 lugares (interface, DTO, valor retornado). Risco baixo de drift; refactor de unificação é de baixo risco mas fora do escopo desta story. [`src/modules/webhook/app/get_webhook_public_key_usecase.ts`, `src/modules/webhook/app/get_webhook_public_key_viewmodel.ts`]

## Deferred from: code review of story-4-2-tela-coringa-com-polling-e-6-estados-visuais (2026-07-15)

- **Sem backoff/limite em falhas de fetch repetidas** — `useProofSessionPolling` retenta a cada 7s indefinidamente mesmo com falhas consecutivas, sem backoff exponencial ou limite de tentativas. Parcialmente mitigado pelo patch que distingue erro de rede na UI (usuário passa a ver o erro em vez de tela travada). Implementar backoff/cap fica para hardening futuro fora do escopo do MVP. [`app/v/[sessionToken]/use-proof-session-polling.ts`]

- **Throttling de timers em aba em segundo plano não tratado** — O `setInterval` de 1s do contador regressivo é pausado/throttled por browsers quando a aba fica em background (especialmente mobile), podendo causar "salto" perceptível no contador ao voltar o foco. Comportamento padrão de qualquer polling por timer em browser; não é governado pelos ACs da Story 4.2. Resolver com `visibilitychange` + resync se virar reclamação real de usuário. [`app/v/[sessionToken]/use-proof-session-polling.ts`]

- **Testes da tela coringa são apenas inspeção estrutural de string** — `tests/unit/story-4-2/verification-screen.test.mjs` verifica padrões no código-fonte via regex/string matching, sem jsdom, sem simulação de timers e sem mock de fetch — não captura bugs comportamentais reais (estado preso, corrida de timers, etc.). Este é o padrão de teste já estabelecido em todas as stories anteriores do projeto (não há `jsdom`/`@testing-library` nas devDependencies). Considerar introduzir testes comportamentais com jsdom quando a stack de testes for expandida. [`tests/unit/story-4-2/verification-screen.test.mjs`]

## Deferred from: code review de 5-4-emissao-de-verifiable-credential (2026-07-08)

- **Mock OCR Provider em produção** — O OCR de documento e extração de idade/personhood para emissão de credenciais está mockado usando `MockOcrProvider`. Antes de ir para produção, a factory em `Environments` deve ser estendida para instanciar e retornar um provider OCR de produção real (como Google Cloud Vision API ou AWS Textract) com base nas variáveis de ambiente do estágio. [`src/shared/clients/ocr/MockOcrProvider.ts`, `src/shared/environments.ts`]

- **Fallback de chave privada de teste em ambiente de produção** — Na classe `IssueCredentialUseCase`, se o `issuerPrivateKey` for igual ao valor de teste `"test-issuer-private-key"`, há um fallback silencioso para uma chave padrão predefinida. No estágio de produção, se essa chave de teste for configurada incorretamente, o sistema usará a chave mockada silenciosamente em vez de falhar. Recomendado lançar um erro explícito se a chave de teste for fornecida em ambientes produtivos (Stage.PROD ou Stage.HOMOLOG). [`src/modules/credential/app/issue_credential_usecase.ts`]

## Deferred from: code review de 5-1-middleware-de-auth-por-did-withdidauth (2026-05-27)

- **`@noble/ed25519` v3 requer `crypto.subtle`** — Disponível no Edge runtime do Next.js (onde o middleware roda). Se a função for movida para runtime Node.js, o catch trata a falha como "Invalid signature" 401, mascarando o erro real. Adicionar polyfill ou configuração explícita de `ed.etc.sha512Async` ao migrar. [`src/shared/middlewares/withDIDAuth.ts`]

- **Cookies de sessão Supabase não propagados no return path de DID auth** — `withDIDAuth` retorna `NextResponse.next()` diretamente, sem propagar `sessionResponse`. Aceitável no MVP (rotas DID são chamadas por app mobile sem sessão Supabase). Se uma rota DID precisar acessar dados via Supabase server-side, o cookie de sessão não estará atualizado. [`src/shared/middleware.ts`]

- **Header `x-holder-did` sem consumer downstream** — Middleware injeta o DID autenticado mas nenhum route handler lê `x-holder-did` ainda. Histórias 5.3–5.6 devem ler este header para identificar o holder e aplicar autorização de nível de negócio. [`src/shared/middlewares/withDIDAuth.ts`]

- **Method case no payload canônico não documentado** — `request.method` é sempre uppercase no Next.js (GET, POST, etc.). O app mobile deve assinar o payload com método uppercase. Se assinar com lowercase, a verificação falha silenciosamente com 401 "Invalid signature". Documentar o contrato de assinatura com o time mobile antes das histórias 5.3–5.6.

- **Sem testes unitários dedicados para `withDIDAuth`** — A story excluiu testes explicitamente; critério foi build + suite existente. Considerar adicionar testes de contrato para os 5 casos de erro (missing headers, expired, invalid DID, invalid sig, valid) em sprints futuros para guardar regressões no middleware.

## Deferred from: code review de 1-6-login-e-protecao-de-rotas (2026-05-27)

- **Open redirect via slashes codificados (`/%2F`)** — Guard `startsWith("/") && !startsWith("//")` é padrão pré-existente na codebase (fetchWithAuth, sign-up). Para segurança maior, considerar `new URL(next, origin).origin === origin`. Impacto baixo no contexto B2B do MVP [app/sign-in/page.tsx].

- **`isSubmitting` permanece `true` se `window.location.href` travar** — Padrão intencional: a página deve desaparecer antes do reset. Se navegação falhar (CSP, `beforeunload`), botão fica preso. Mesmo comportamento em sign-up. Resolver se monitoramento detectar reclamações [app/sign-in/page.tsx].

- **Erro de rede exibe mesmo toast que credencial inválida** — "E-mail ou senha inválidos." aparece em falhas de rede/timeout também. Intencional por spec ("mensagem genérica"). Melhorar distinção se Supabase expuser código de erro estruturado em produção [app/sign-in/page.tsx].

- **Toast não anuncia corretamente para todos os leitores de tela** — Remoção do AlertCircle inline em favor de toast quebra anúncio via ARIA em alguns screen readers. Trade-off arquitetural aceito; considerar `aria-live` region paralela se acessibilidade for requisito crítico.

## Deferred from: code review de 5-2-wrapper-blockchainclient (2026-05-21)

- **getBlockchainClient() sem cache** — cria nova instância de `EthersBlockchainClient` (e novo `JsonRpcProvider`) por chamada. Consistente com padrão dos outros getters em `Environments`, mas providers blockchain mantêm conexões. Adicionar cache se chamadas forem frequentes. [`src/shared/environments.ts`]

- **toJSON() serializa BLOCKCHAIN_WALLET_PRIVATE_KEY** — comportamento pré-existente em `Environments.toJSON()`. Risco de leak em logs estruturados. Considerar redação de secrets antes de logging. [`src/shared/environments.ts`]

- **Sem timeout em tx.wait()** — transações presas no mempool bloqueiam indefinidamente. Decisão explícita de MVP (sem retry). Implementar timeout + retry em produção. [`src/shared/clients/blockchain/EthersBlockchainClient.ts`]

- **Sem validação de formato DID/vcId nos métodos do client** — strings vazias ou malformadas chegam ao RPC e consomem gas. Validação é responsabilidade do use case, não do client. [`src/shared/clients/blockchain/EthersBlockchainClient.ts`]

- **Key exposure em stack trace** — risco teórico de private key aparecer em erro do ethers.Wallet na construção. Risco baixo na prática (ethers v6 não inclui o valor no erro), mas considerar sanitização de erros em logs. [`src/shared/clients/blockchain/EthersBlockchainClient.ts`]

## Deferred from: code review de 1-5-signup-atomico-de-empresa (2026-05-13)

- **Sem rate limiting no endpoint de signup** — `POST /api/auth/sign-up` não tem throttle ou CAPTCHA. Permite enumeração de emails via 409 e abuso de quota do Supabase. Implementar rate limiting ao adicionar infraestrutura de segurança global [app/api/auth/sign-up/route.ts].

- **Enumeração de email via resposta 409** — Retornar HTTP 409 com mensagem "E-mail já cadastrado." revela quais emails estão cadastrados. Para MVP B2B é aceitável; considerar uma resposta genérica em produção [app/api/auth/sign-up/route.ts:30].

- **Race condition em signups duplicados concorrentes** — Duas requisições simultâneas com o mesmo email podem ambas chamar `createUser` antes que o Supabase rejeite a segunda. Probabilidade muito baixa; aceitar no MVP [app/api/auth/sign-up/route.ts].

- **Edge case de falha do `signInWithPassword` pós-criação de conta** — Se o Supabase estiver transitoriamente indisponível após a criação da conta, `signInWithPassword` falha e o usuário é redirecionado para `/sign-in` com toast. A conta existe mas o usuário não sabe disso claramente. Melhorar a mensagem ou implementar retry [app/sign-up/page.tsx].

- **`cnpjDisplay` pode estar stale no submit** — O CNPJ é gerenciado via `useState` separado do React Hook Form. Em condições de race (submit muito rápido), o estado pode ser capturado antes do último `onChange`. Migrar para campo registrado no RHF ao refatorar o formulário [app/sign-up/page.tsx].

- **`handleHttpError` loga `AuthError` do Supabase com detalhes internos** — Quando `throw authError` é atingido (erros Supabase não mapeados), o erro é logado via `console.error` com detalhes internos do Supabase (endpoint, request ID). Filtrar ou sanitizar logs em produção [src/shared/http/handleHttpError.ts].

- **Lógica de `isPublicAuthPage` com inner check frágil para `/v/*`** — O inner check `pathname === "/sign-in" || pathname === "/sign-up"` dentro do `if (isPublicAuthPage)` não cobre rotas `/v/*` acidentalmente. Se `/v/*` for removido de `isPublicAuthPage`, a lógica quebra silenciosamente. Pré-existente à Story 1.5 [src/shared/middleware.ts].

## Deferred from: code review de 1-4-fetchwithauth-e-infraestrutura-de-auth-client (2026-05-13)

- **Query string/hash descartados no `?next=` redirect** — `fetchWithAuth` usa `window.location.pathname` e perde `?query` e `#hash`. Impacto mínimo pois filtros no dashboard são client-side state, mas ao implementar páginas com estado em URL considerar usar `pathname + search` [utils/fetch-with-auth.ts:8].

- **Error flash transitório antes do redirect em páginas de lista** — Quando `fetchWithAuth` lança após 401, o `.catch()` nas páginas (`setError("Session expired")`) executa antes da navegação completar, causando um flash da mensagem de erro. Inerente ao padrão throw-after-redirect; resolver se causar alarmes em monitoramento.

- **Open redirect teórico via `/\evil.com`** — Guard `startsWith('/') && !startsWith('//')` está alinhado com a spec. Em browsers antigos `/\` pode ser tratado como `//`. Considerar usar `new URL(next, window.location.origin).origin === window.location.origin` como validação mais robusta em futura melhoria [app/sign-in/page.tsx].

- **Sign-out usa `fetch` direto por design** — `app/(dashboard)/settings/page.tsx` não deve usar `fetchWithAuth` em `/api/auth/sign-out`, para evitar redirect de sessão expirada para `/sign-in?next=/settings`. Se a API falhar, o handler já chama `setSigningOut(false)`.

- **Inconsistência de encoding no `?next=` entre middleware e `fetchWithAuth`** — Middleware usa `url.searchParams.set("next", pathname)` (raw), `fetchWithAuth` usa `encodeURIComponent(pathname)` (encoded). Round-trip correto via `URLSearchParams.get()`. Normalizar quando refatorar o middleware.

## Deferred from: code review de 1-3-migration-sql-e-dependencias-de-formulario (2026-05-13)

- **Sem `setChallenge()` na entidade `ProofSession`** — Challenge fields existem apenas como `null` no construtor. Story 5.3 (Challenge e Abertura de Sessão) precisará adicionar método de mutação `setChallenge(nonceHash: string): void` na entidade E atualizar `SupabaseProofSessionRepository.update()` para persistir esses campos.

- **`ProofSessionOutputDTO.status` como string literal em vez de enum** — `get_proof_session_viewmodel.ts` duplica os valores do enum `ProofSessionStatus` como union type. Se um novo status for adicionado ao enum, o DTO não atualizará automaticamente. Corrigir quando refatorar o módulo proof-session.

- **Verificação de expiração duplicada em `get_proof_session_usecase.ts`** — Dois `Date.now()` separados verificam expiração. Em alto throughput, isso pode gerar leituras inconsistentes. A lógica de expiração pertence à entidade (similar ao `markOpened()`). Endereçar ao implementar Story 4.1.

- **`@hookform/resolvers@^5.2.2` compatibilidade com `react-hook-form@7`** — v5 do resolver pode ter sido lançado para RHF v8 (alpha). Verificar se `zodResolver` funciona corretamente ao implementar o primeiro formulário na Story 1.5. Se houver conflito, downgrade para `@hookform/resolvers@^3.x`.

- **`ProofSessionMapper.toDomain()` sem guarda em `challenge_created_at`** — `new Date(invalidString)` resulta em `Invalid Date` silencioso. Dados vêm do banco (confiáveis), mas se a string for corrompida, o erro só aparece em runtime. Baixo risco, mas vale validar ao adicionar cobertura de testes do repositório.

## Deferred from: code review de 1-2-middleware-de-autenticacao (2026-05-13)

- **`isSessionAuthApiRoute` não cobre métodos futuros** — Se DELETE/PATCH for adicionado a `/api/proof-requests/[requestId]`, esses métodos cairão no fallthrough sem auth. Ao adicionar novos handlers para essa rota, verificar se o método precisa de session auth e atualizar `isSessionAuthApiRoute` em `src/shared/middleware.ts`.

- **`isDashboardPage` usa lista hardcoded** — Novas páginas adicionadas ao grupo `/(dashboard)` do Next.js não serão automaticamente protegidas. Ao criar novas rotas de dashboard, lembrar de adicionar o path a `isDashboardPage` em `src/shared/middleware.ts`, ou migrar para detecção via route group.

- **`isSessionAuthApiRoute` não cobre métodos futuros** — Se DELETE/PATCH for adicionado a `/api/proof-requests/[requestId]`, esses métodos cairão no fallthrough sem auth. Ao adicionar novos handlers para essa rota, verificar se o método precisa de session auth e atualizar `isSessionAuthApiRoute` em `src/shared/middleware.ts`.

- **`isDashboardPage` usa lista hardcoded** — Novas páginas adicionadas ao grupo `/(dashboard)` do Next.js não serão automaticamente protegidas. Ao criar novas rotas de dashboard, lembrar de adicionar o path a `isDashboardPage` em `src/shared/middleware.ts`, ou migrar para detecção via route group.

- **`POST /api/proof-requests` usa match exato (`===`)** — Diferente de outras rotas que usam `startsWith()`. Se rotas aninhadas como `/api/proof-requests/bulk` forem criadas com método POST, elas cairão no fallthrough sem cobertura de auth. Revisar ao criar endpoints aninhados.

## Deferred from: code review of story-3.3 (2026-05-28)

- Spinner de loading da página de detalhe de proof request (`app/(dashboard)/proof-requests/[requestId]/page.tsx`) sem `aria-label`/`role`. Consistente com o padrão atual (`apps/[appId]/page.tsx`) — tratar como melhoria de acessibilidade transversal a todas as telas de loading do dashboard.
## Deferred from: code review de 2-1-listagem-de-aplicacoes (2026-06-03)

- **Race condition latente no `reload()`** — `setApps([])` + `setLoading(true)` + `setFetchKey()` são batched pelo React, sem flash real; padrão pre-existente no projeto. Se em algum modo concurrency futuro causar flash de EmptyState, refatorar `reload` para usar `useReducer`. [`app/(dashboard)/apps/page.tsx`]

- **Propagação de click em filhos futuros do `<tr>`** — Sem `e.stopPropagation()` em filhos interativos, qualquer botão adicionado à row no futuro propagará click para o `router.push`. Adicionar `e.stopPropagation()` nos botões ao implementar Story 2.3 (detalhe/edição). [`app/(dashboard)/apps/page.tsx`]

- **`colSpan={3}` hardcoded em EmptyState/ErrorState** — Tech debt MVP: adicionar coluna no futuro exige atualizar manualmente os três estados. Extrair colSpan para constante `COL_COUNT = 3` ou usar `colspan="100%"` via CSS. [`app/(dashboard)/apps/page.tsx`]

## Deferred from: code review of story-9-1-emissao-da-vc-como-vc-jwt-eddsa (2026-08-03)

- **Payload do JWT não carrega claim `exp` (expiração)** — apenas `iat`/`nbf`; uma VC-JWT emitida não tem prazo de validade explícito no próprio JWT, só a revogação on-chain como controle de ciclo de vida. Não exigido pelo AC #1/Dev Notes desta story ("não inventar variações" do formato); considerar em story futura se o produto precisar de expiração automática. [`src/modules/credential/app/issue_credential_usecase.ts:139-146`]

- **Payload do JWT não carrega claim `aud`** (amarração a um verificador/apresentação específica) — mesma razão do achado anterior, fora do formato exato prescrito pelo AC #1. [`src/modules/credential/app/issue_credential_usecase.ts:139-146`]

- **`ed.signAsync` na emissão não tem try/catch dedicado** — diferente do try/catch em torno de `blockchainClient.registerDID`; uma falha de assinatura vira erro genérico não classificado. Padrão pré-existente: a assinatura JSON-LD anterior também não tinha tratamento dedicado — não introduzido pela Story 9.1. [`src/modules/credential/app/issue_credential_usecase.ts:151`]

- **Nenhum teste dinâmico cobre `bodySignature` base64url malformado** (caracteres inválidos, comprimento ímpar) além do caso "64 bytes zerados" — o trecho de validação da assinatura do holder não foi tocado pela Story 9.1 (reaproveitado sem alteração da Story 5.4); gap de cobertura pré-existente. [`tests/unit/story-9-1/issue-credential-usecase.dynamic.test.ts`]

- **Nenhum teste dinâmico cobre `ISSUER_PRIVATE_KEY` vazio/malformado no caminho de emissão** — a resolução da chave do issuer é escopo do Epic 10 (`backlog`), não tocado pela Story 9.1. [`src/modules/credential/app/issue_credential_usecase.ts:126-129`]

- **Verificação EdDSA (allow-list de algoritmo, proteção contra confusão de tipo/alg) pertence à Story 9.2** (`backlog`, verificação) — a Story 9.1 só cobre emissão; nenhuma AC desta story exige código de verificação. [`src/modules/presentation/app/verify_presentation_usecase.ts`]

## Deferred from: code review of story-9-2-verificacao-da-vc-jwt-em-presentations-verify (2026-08-11)

- **Challenge com timestamp futuro pode contornar a janela de dez minutos** — a regra atual só rejeita timestamps antigos; corrigir junto à evolução transversal de validade de sessão. [`src/modules/presentation/app/verify_presentation_usecase.ts:299`]
- **Chamadas blockchain não têm timeout explícito** — uma RPC que nunca resolve mantém a verificação pendente; tratar na infraestrutura blockchain compartilhada. [`src/modules/presentation/app/verify_presentation_usecase.ts:309`]
- **Request terminal pode ser reaprovada se a sessão continuar `OPENED`** — validar/coordenar o estado da request quando o fluxo transacional for revisto. [`src/modules/presentation/app/verify_presentation_usecase.ts:107`]
- **Submissões concorrentes podem emitir decisões ou webhooks contraditórios** — requer compare-and-set/controle de concorrência no repositório, fora do escopo da serialização JWT. [`src/modules/presentation/app/verify_presentation_usecase.ts:113`]
- **Aprovação de sessão e request não é persistida atomicamente** — falha parcial entre os dois updates pode deixar estados inconsistentes; requer unidade transacional de repositório. [`src/modules/presentation/app/verify_presentation_usecase.ts:332`]
## Deferred from: code review of story-11.4-workflow-job-deploy-supabase (2026-08-09)

- **`supabase/setup-cli@v1` usa `version: latest`** — a versão da Supabase CLI instalada no runner não é determinística entre releases; uma mudança de comportamento da CLI poderia alterar `db push` sem aviso. Pinar uma versão específica da CLR (e/ou SHA das actions) na Story 11.7 (hardening operacional), junto com o defer de SHA-pinning de `actions/checkout`/`actions/setup-node` registrado na Story 11.3. [`.github/jobs/deploy-supabase/action.yml`]

- **`supabase db push` (apply) pode exigir confirmação interativa em CI não-TTY** — historicamente a CLI pergunta "Do you want to push these migrations...?"; em runner não interativo isso pode falhar/travar. Não reproduzível no sandbox (GitHub Actions e Supabase Cloud não rodam aqui) e o contrato §4-D da proposta não especifica flag. Verificar no primeiro release real; se necessário, adicionar flag não-interativa/auto-confirm ao step de apply. [`.github/jobs/deploy-supabase/action.yml`]

## Deferred from: code review of story-11.5-workflow-job-deploy-amplify (2026-08-09)

- **`aws-actions/configure-aws-credentials@v4` pinada por tag de major (não SHA)** — a versão da action de auth AWS não é determinística entre releases; uma mudança de comportamento poderia alterar a assunção de role sem aviso. Pinar SHA na Story 11.7 (hardening operacional), junto com os defers de SHA-pinning das actions registrados nas Stories 11.3/11.4. [`.github/jobs/deploy-amplify/action.yml`]

- **Polling do Amplify sem tolerância a erros transitórios da API AWS** — o step de espera roda sob `set -euo pipefail`; uma única falha de rede em `aws amplify get-job` aborta a espera inteira do deploy (exit não-zero). Não reproduzível no sandbox (AWS não roda aqui). Avaliar retry/backoff tolerante a erros transitórios no primeiro release real, mantendo o loop finito (timeout total preservado). [`.github/jobs/deploy-amplify/action.yml`]

- **Sync de env assume payload JSON válido** — `jq --argjson incoming "$NEW_ENVIRONMENT_VARIABLES"` falha se `amplify-environment-variables` não for JSON válido; o step aborta sem mensagem dedicada. Fail-fast é aceitável, mas uma validação/mensagem explícita ("payload de env vars inválido") facilitaria o diagnóstico. Considerar no hardening da Story 11.7. [`.github/jobs/deploy-amplify/action.yml`]

## Deferred from: code review of story-11.6-workflow-job-smoke-test (2026-08-09)

- **`actions/checkout@v4` pinada por tag de major (não SHA) no job `smoke-test`** — a versão da action de checkout não é determinística entre releases. Pinar SHA na Story 11.7 (hardening operacional), junto com os defers de SHA-pinning das actions registrados nas Stories 11.3/11.4/11.5. [`.github/workflows/production.yml`]

- **Smoke-test retenta uniformemente e não valida a URL de produção** — o loop de `curl` retenta qualquer falha (rede transitória ou app indisponível) do mesmo modo; se `production-url` vier vazio/malformado, o step apenas falha após esgotar as 30 tentativas (5 min) sem uma mensagem dedicada. Fail-fast é aceitável (input `required`), mas uma validação explícita da URL e/ou distinção entre erro transitório e app genuinamente fora do ar facilitaria o diagnóstico. Não reproduzível no sandbox (GitHub Actions e HTTP contra produção não rodam aqui). Considerar no hardening da Story 11.7. [`.github/jobs/smoke-test/action.yml`]

## Deferred from: fix de falhas do npm run test (proxy.ts + story-2.2 tests) (2026-08-11)

- **Artefato da Story 2.2 desatualizado e contraditório** — `_bmad-output/implementation-artifacts/stories/2-2-criacao-de-app-com-api-key-one-shot.md` ainda documenta `environment` default `"dev"` e lista o card "Ambiente" como "fora do escopo desta story"/"removido". Isso contradiz o código e os testes atuais desde que a Story 7.4 (done) reintroduziu o seletor de Ambiente com default `"homol"`. O doc da Story 2.2 nunca foi atualizado para refletir essa superseção. [`_bmad-output/implementation-artifacts/stories/2-2-criacao-de-app-com-api-key-one-shot.md`]

- **Nenhum teste verifica que o `defaultValues.environment` da página `/apps/new` está sincronizado com o default do schema Zod (`"homol"`)** — hoje são dois pontos de verdade independentes (`app/(dashboard)/apps/new/page.tsx` e `src/modules/company-app/app/create_company_app_viewmodel.ts`); um poderia divergir silenciosamente do outro sem que nenhum teste falhe. [`app/(dashboard)/apps/new/page.tsx`, `src/modules/company-app/app/create_company_app_viewmodel.ts`]

- **Testes em `tests/unit/story-1-2/middleware.test.mjs` e `tests/unit/story-2-2/create-company-app.test.mjs` verificam apenas texto-fonte via regex/`includes`, não comportamento real** — ex.: `assert.match(src, /export function proxy/, ...)` e `assert.ok(src.includes("Ambiente"), ...)` passariam mesmo com um comentário morto ou uma referência não utilizada contendo a palavra-chave. Pré-existente ao longo do arquivo, não introduzido por este fix; oportunidade de reforçar para testes comportamentais/de import real caso essas suítes sejam revisitadas. [`tests/unit/story-1-2/middleware.test.mjs`, `tests/unit/story-2-2/create-company-app.test.mjs`]
