# Story 1.6: Login e Proteção de Rotas

Status: done

## Story

Como empresa parceira cadastrada,
Quero fazer login e ser redirecionada ao dashboard,
Para que eu acesse meus dados de forma segura sem que usuários não autenticados vejam as rotas protegidas.

## Acceptance Criteria

1. **Given** a página `/sign-in` com campos email e senha
   **When** o usuário submete credenciais válidas
   **Then** é autenticado via Supabase Auth e redirecionado para `/` (ou para `?next=<path>` se o parâmetro existir na URL)

2. **Given** a página `/sign-in` com credenciais inválidas
   **When** o usuário submete
   **Then** um toast de erro é exibido com mensagem genérica (sem detalhar se email ou senha está errado)
   **And** o botão fica `disabled` durante o envio e reabilita após a resposta

3. **Given** um usuário não autenticado
   **When** tenta acessar qualquer rota de `/(dashboard)` (ex: `/`, `/apps`, `/proof-requests`, `/settings`)
   **Then** o middleware redireciona para `/sign-in?next=<path-tentado>`

4. **Given** um usuário autenticado
   **When** tenta acessar `/sign-in`
   **Then** é redirecionado para `/`

## Tasks / Subtasks

- [x] Task 1: Migrar `app/sign-in/page.tsx` para React Hook Form + Zod com toast de erro (AC: #1, #2)
  - [x] Adicionar imports: `useForm` de `react-hook-form`, `zodResolver` de `@hookform/resolvers/zod`, `toast` de `sonner`, `z` de `zod`
  - [x] Definir schema Zod `signInSchema` com: `email` (string.email) e `password` (string.min(1)). **Nota:** Validação inline mínima apenas — verificação real é no Supabase
  - [x] Configurar `useForm<SignInFormData>` com `zodResolver(signInSchema)` e `mode: 'onSubmit'` (sem validação prematura no sign-in)
  - [x] Substituir `useState(email)` + `useState(password)` + `useState(loading)` + `useState(error)` pelo `register`, `handleSubmit`, `formState.isSubmitting` do RHF
  - [x] No `handleSubmit`: chamar `supabase.auth.signInWithPassword({ email, password })` e em caso de erro chamar `toast.error("E-mail ou senha inválidos.")` (sem inline AlertCircle)
  - [x] Em caso de sucesso: ler `?next=` da URL (validar que começa com `/` e não com `//`) e fazer `window.location.href = safePath`
  - [x] Botão submit: `disabled={isSubmitting}` com ícone `Loader2` enquanto `isSubmitting === true`
  - [x] Remover o bloco `{error && <div className="flex items-center gap-2...">`  — toda sinalização de erro agora vai para o toast
  - [x] Manter exatamente o mesmo layout visual (split com painel esquerdo de formulário e painel direito institucional)

- [x] Task 2: Verificar que o middleware já cobre os ACs #3 e #4 (sem mudança de código — apenas validação)
  - [x] Confirmar que `isDashboardPage` em `src/shared/middleware.ts` cobre `/`, `/apps`, `/proof-requests`, `/settings`
  - [x] Confirmar que usuário não autenticado é redirecionado via `withSessionAuth(redirectOnFail: "/sign-in")` com `?next=<path>`
  - [x] Confirmar que usuário autenticado em `/sign-in` já é redirecionado para `/` pela linha `if (user && (pathname === "/sign-in" || pathname === "/sign-up"))`

- [x] Task 3: Validar e rodar testes (AC: todos)
  - [x] Executar `npm run test` — 163/163 testes passando (zero regressões)
  - [x] Executar `npm run build` — TypeScript limpo sem erros

### Review Findings

- [x] [Review][Patch] Validação Zod falha silenciosamente — adicionado `onValidationError` como segundo argumento de `handleSubmit`; exibe `toast.error("Preencha e-mail e senha para continuar.")` [app/sign-in/page.tsx]
- [x] [Review][Patch] Schema Zod usa mensagem field-specific `"E-mail inválido"` — removidas mensagens customizadas do schema; violação latente eliminada [app/sign-in/page.tsx]
- [x] [Review][Defer] Open redirect via slashes codificados (`/%2F`) — padrão pré-existente em toda a codebase (mesma validação na Story 1.5 e fetchWithAuth) — deferred, pre-existing
- [x] [Review][Defer] `isSubmitting` permanece `true` se `window.location.href` travar — padrão pré-existente (mesmo comportamento na página sign-up) — deferred, pre-existing
- [x] [Review][Defer] Erro de rede exibe mesmo toast que credencial inválida — intencional por spec ("mensagem genérica sem detalhar") — deferred, intentional
- [x] [Review][Defer] Toast não anuncia corretamente para todos os leitores de tela — trade-off aceito em toda a arquitetura do projeto — deferred, pre-existing

## Dev Notes

### Análise do Estado Atual (O que já existe)

**Middleware já implementado (Story 1.2 + update da Story 1.5):**

`src/shared/middleware.ts` já cobre todos os ACs de proteção de rotas:

```typescript
// AC #3: Unauthenticated users on dashboard pages → sign-in redirect
if (isDashboardPage(pathname)) {
  return withSessionAuth(request, sessionResponse, user, {
    redirectOnFail: "/sign-in",
  });
}
// isDashboardPage cobre: "/", "/apps", "/proof-requests", "/settings"

// AC #4: Authenticated users on /sign-in or /sign-up → redirect to /
if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
  return NextResponse.redirect(new URL("/", request.url));
}
```

`withSessionAuth` em `src/shared/middlewares/withSessionAuth.ts` quando `redirectOnFail: "/sign-in"`:
- Injeta `?next=<pathname>` na URL de redirect
- Preserva cookies de sessão do Supabase

**Página sign-in atual (`app/sign-in/page.tsx`):**
- Já implementa redirect para `?next=<path>` após login bem-sucedido
- Já desabilita botão durante loading (`disabled={loading}`)
- Exibe erro com inline `AlertCircle` div — **precisa mudar para toast**
- Usa `useState` para form state — **migrar para RHF**

**Layout já tem Toaster:**
`app/sign-in/layout.tsx` já importa e renderiza `<Toaster richColors position="bottom-right" />` — sem mudanças necessárias no layout.

### Implementação da Página Sign-In com RHF

```typescript
"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldHalf, Loader2, Code2, Lock, Zap, FlaskConical } from "lucide-react";
import { getSupabaseBrowserClient } from "@/shared/clients/supabase/client";

const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: "onSubmit",
  });

  async function onSubmit(data: SignInFormData) {
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email.trim(),
      password: data.password,
    });

    if (signInError) {
      toast.error("E-mail ou senha inválidos.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const safePath =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    window.location.href = safePath;
  }

  // ... return JSX usando register("email"), register("password"), handleSubmit(onSubmit), isSubmitting
}
```

**Por que `mode: "onSubmit"` no sign-in?**
Diferente do sign-up (que usa `mode: "onBlur"` para validação por campo), no sign-in a validação client-side é mínima — a verificação real é no Supabase. Disparar validação no blur em campos de login cria fricção desnecessária. No submit, o schema Zod só checa que os campos não estão vazios — erros vão via toast.

**Por que sem erros inline no sign-in?**
UX spec: "Feedback Patterns — toast de erro genérico sem detalhar email/senha". O erro de autenticação não deve indicar qual campo está errado (evita enumeration de usuários). Mantemos `errors.email` e `errors.password` do RHF apenas para os casos de campo vazio (antes da requisição ao Supabase), com mensagem mínima se necessário — mas preferencialmente o formulário não exibe erros inline para credenciais de login.

**Por que não usar `fetchWithAuth` no sign-in?**
Sign-in chama Supabase Auth diretamente via browser client, não um endpoint interno. `fetchWithAuth` é para endpoints autenticados que podem retornar 401 — irrelevante aqui pois ainda não há sessão.

**Por que `window.location.href` e não `router.push`?**
Forçar reload completo garante que o middleware do Next.js revalide os cookies de sessão recém-criados. `router.push` pode não forçar revalidação da sessão.

### Campos de Formulário com RHF

```tsx
{/* Email */}
<div>
  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-primary">
    E-mail
  </label>
  <input
    id="email"
    type="email"
    {...register("email")}
    placeholder="seu@email.com"
    className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
    autoComplete="email"
  />
</div>

{/* Password */}
<div>
  <div className="mb-1.5 flex items-center justify-between">
    <label htmlFor="password" className="block text-sm font-medium text-text-primary">
      Senha
    </label>
    <a href="#" className="text-xs font-medium text-trust hover:text-trust/80">
      Esqueci minha senha
    </a>
  </div>
  <input
    id="password"
    type="password"
    {...register("password")}
    placeholder="••••••••"
    className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
    autoComplete="current-password"
  />
</div>

{/* Submit button */}
<button
  type="submit"
  disabled={isSubmitting}
  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
>
  {isSubmitting ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Entrando…
    </>
  ) : (
    "Entrar"
  )}
</button>
```

### O que NÃO alterar

- `app/sign-in/layout.tsx` — já tem `<Toaster>`, não mexer
- `src/shared/middleware.ts` — já implementa todos os ACs #3 e #4
- `src/shared/middlewares/withSessionAuth.ts` — já implementado corretamente
- Qualquer arquivo em `src/modules/` — nenhum módulo backend é tocado
- `app/sign-up/page.tsx` — não é escopo desta story

### Convenções do Projeto (aprendizados das Stories anteriores)

- Path alias `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`
- `process.env` somente em `src/shared/environments.ts` — jamais direto no componente
- React Hook Form `zodResolver` import: `import { zodResolver } from '@hookform/resolvers/zod'`
- Toast: `import { toast } from 'sonner'` — chamar `toast.error()` ou `toast.success()`
- `npm run build` verifica TypeScript — executar antes de marcar done
- Shape de erro inline: `text-sm text-red-600` abaixo do campo (apenas para erros de validação, não auth)
- Erros de API/auth: sempre via `toast.error()`, nunca inline
- `window.location.href` (não `router.push`) após login — força reload completo para revalidar sessão

### Baseline de Testes

137 testes passando. Zero regressões esperadas — mudança limitada a `app/sign-in/page.tsx` (componente client-only), sem impacto em módulos de backend ou middleware.

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `app/sign-in/page.tsx` | MODIFICAR | Migrar para RHF + Zod; trocar AlertCircle inline por toast.error |
| `app/sign-in/layout.tsx` | NÃO ALTERAR | Já tem `<Toaster>` |
| `src/shared/middleware.ts` | NÃO ALTERAR | AC #3 e #4 já cobertos |
| `src/shared/middlewares/withSessionAuth.ts` | NÃO ALTERAR | Já implementado |

### References

- [Epics: Story 1.6 AC](../../planning-artifacts/epics.md#story-16-login-e-proteção-de-rotas)
- [Architecture: Arquitetura Frontend — Fetch Wrapper + RHF](../../planning-artifacts/architecture.md#arquitetura-frontend)
- [Architecture: Middleware de auth global](../../planning-artifacts/architecture.md#autenticação--segurança)
- [UX: Form Patterns — onBlur, zodResolver, Label acima de Input](../../planning-artifacts/ux-design-specification.md#form-patterns)
- [UX: Feedback Patterns — toast.error, botão disabled](../../planning-artifacts/ux-design-specification.md#feedback-patterns)
- [UX: Navigation Patterns — redirect pós-login para `/` ou `?next=<path>`](../../planning-artifacts/ux-design-specification.md#navigation-patterns)
- [Story anterior: 1.5](./1-5-signup-atomico-de-empresa.md)
- [Página a modificar: app/sign-in/page.tsx](../../../../app/sign-in/page.tsx)
- [Middleware: src/shared/middleware.ts](../../../../src/shared/middleware.ts)
- [withSessionAuth: src/shared/middlewares/withSessionAuth.ts](../../../../src/shared/middlewares/withSessionAuth.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Nenhum — implementação direta sem bloqueios.

### Completion Notes List

- `app/sign-in/page.tsx` migrado: removidos `useState` para email/password/loading/error; adicionados `useForm` com `zodResolver(signInSchema)` e `mode: "onSubmit"`; schema Zod com `email` (string.email) e `password` (string.min(1))
- Erro de autenticação agora exibido via `toast.error("E-mail ou senha inválidos.")` — sem bloco AlertCircle inline
- Botão disabled via `isSubmitting` do RHF (não mais `loading` state)
- Layout visual 100% preservado: split de dois painéis, feature cards no painel direito, link `/sign-up`
- Redirect pós-login mantido: valida `?next=` com `startsWith("/")` e `!startsWith("//")` antes de usar
- AC #3 e #4 já cobertos pelo middleware da Story 1.2 (sem alteração necessária)
- 26/26 testes da Story 1.6 passando; 163/163 testes totais passando (zero regressões)
- `npm run build` limpo — TypeScript sem erros, `/sign-in` na rota compilada

### File List

**Criados:**
- `tests/unit/story-1-6/login-e-protecao-de-rotas.test.mjs`

**Modificados:**
- `app/sign-in/page.tsx`

**Não alterados (verificados apenas):**
- `app/sign-in/layout.tsx`
- `src/shared/middleware.ts`
- `src/shared/middlewares/withSessionAuth.ts`

## Change Log

- 2026-05-27: Implementação da Story 1.6 — migração de `app/sign-in/page.tsx` para React Hook Form + Zod; substituição de AlertCircle inline por `toast.error()`; 26 testes novos adicionados; 163 testes totais passando
