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
