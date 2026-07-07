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

- **`POST /api/proof-requests` usa match exato (`===`)** — Diferente de outras rotas que usam `startsWith()`. Se rotas aninhadas como `/api/proof-requests/bulk` forem criadas com método POST, elas cairão no fallthrough sem cobertura de auth. Revisar ao criar endpoints aninhados.

## Deferred from: code review of story-3.3 (2026-05-28)

- Spinner de loading da página de detalhe de proof request (`app/(dashboard)/proof-requests/[requestId]/page.tsx`) sem `aria-label`/`role`. Consistente com o padrão atual (`apps/[appId]/page.tsx`) — tratar como melhoria de acessibilidade transversal a todas as telas de loading do dashboard.
