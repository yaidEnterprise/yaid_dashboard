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

- **`setSigningOut(false)` nunca chamado quando `fetchWithAuth` lança no sign-out** — Se a navegação for bloqueada por um `beforeunload` handler, o botão fica preso em "Saindo...". Resolver adicionando `.catch(() => setSigningOut(false))` se necessário [app/(dashboard)/settings/page.tsx:13].

- **Inconsistência de encoding no `?next=` entre middleware e `fetchWithAuth`** — Middleware usa `url.searchParams.set("next", pathname)` (raw), `fetchWithAuth` usa `encodeURIComponent(pathname)` (encoded). Round-trip correto via `URLSearchParams.get()`. Normalizar quando refatorar o middleware.

## Deferred from: code review de 1-3-migration-sql-e-dependencias-de-formulario (2026-05-13)

- **Sem `setChallenge()` na entidade `ProofSession`** — Challenge fields existem apenas como `null` no construtor. Story 5.3 (Challenge e Abertura de Sessão) precisará adicionar método de mutação `setChallenge(nonceHash: string): void` na entidade E atualizar `SupabaseProofSessionRepository.update()` para persistir esses campos.

- **`ProofSessionOutputDTO.status` como string literal em vez de enum** — `get_proof_session_viewmodel.ts` duplica os valores do enum `ProofSessionStatus` como union type. Se um novo status for adicionado ao enum, o DTO não atualizará automaticamente. Corrigir quando refatorar o módulo proof-session.

- **Verificação de expiração duplicada em `get_proof_session_usecase.ts`** — Dois `Date.now()` separados verificam expiração. Em alto throughput, isso pode gerar leituras inconsistentes. A lógica de expiração pertence à entidade (similar ao `markOpened()`). Endereçar ao implementar Story 4.1.

- **`@hookform/resolvers@^5.2.2` compatibilidade com `react-hook-form@7`** — v5 do resolver pode ter sido lançado para RHF v8 (alpha). Verificar se `zodResolver` funciona corretamente ao implementar o primeiro formulário na Story 1.5. Se houver conflito, downgrade para `@hookform/resolvers@^3.x`.

- **`ProofSessionMapper.toDomain()` sem guarda em `challenge_created_at`** — `new Date(invalidString)` resulta em `Invalid Date` silencioso. Dados vêm do banco (confiáveis), mas se a string for corrompida, o erro só aparece em runtime. Baixo risco, mas vale validar ao adicionar cobertura de testes do repositório.

## Deferred from: code review de 1-2-middleware-de-autenticacao (2026-05-13)

- **`isSessionAuthApiRoute` não cobre métodos futuros** — Se DELETE/PATCH for adicionado a `/api/proof-requests/[requestId]`, esses métodos cairão no fallthrough sem auth. Ao adicionar novos handlers para essa rota, verificar se o método precisa de session auth e atualizar `isSessionAuthApiRoute` em `src/middleware.ts`.

- **`isDashboardPage` usa lista hardcoded** — Novas páginas adicionadas ao grupo `/(dashboard)` do Next.js não serão automaticamente protegidas. Ao criar novas rotas de dashboard, lembrar de adicionar o path a `isDashboardPage` em `src/middleware.ts`, ou migrar para detecção via route group.

- **`POST /api/proof-requests` usa match exato (`===`)** — Diferente de outras rotas que usam `startsWith()`. Se rotas aninhadas como `/api/proof-requests/bulk` forem criadas com método POST, elas cairão no fallthrough sem cobertura de auth. Revisar ao criar endpoints aninhados.
