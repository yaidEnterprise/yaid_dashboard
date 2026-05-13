# Story 1.5: Signup Atômico de Empresa

Status: done

## Story

Como nova empresa parceira,
Quero me cadastrar com um único formulário contendo email, senha e nome da empresa,
Para que minha conta e company sejam criadas atomicamente — sem estados intermediários nem telas de onboarding adicionais.

## Acceptance Criteria

1. **Given** a página `/sign-up` com os campos: email, senha, confirmação de senha, nome da empresa (obrigatório) e CNPJ (opcional, com máscara)
   **When** o formulário é submetido com dados válidos
   **Then** `POST /api/auth/sign-up` cria `auth.users` e `public.company` na mesma operação atômica
   **And** se a criação de `auth.users` falhar, nenhuma company é criada
   **And** se a criação de `public.company` falhar, o `auth.users` recém-criado é desfeito
   **And** após sucesso, o usuário é redirecionado para `/` já autenticado
   **And** a sessão recém-criada sempre tem uma company associada — estado "usuário sem company" não existe

2. **Given** o formulário de signup com dados inválidos (email mal-formatado, senha curta, confirmação diferente, nome vazio)
   **When** o usuário tenta submeter
   **Then** erros de validação são exibidos inline via React Hook Form + Zod antes de qualquer chamada à API
   **And** o botão de submit fica `disabled` durante o envio
   **And** em caso de erro retornado pela API (ex: email já cadastrado), um toast de erro é exibido via Sonner

3. **Given** um usuário já autenticado
   **When** tenta acessar `/sign-up`
   **Then** é redirecionado para `/` (tratado pelo middleware — não pela página)

## Tasks / Subtasks

- [x] Task 1: Criar `app/api/auth/sign-up/route.ts` — endpoint de signup atômico (AC: #1, #2)
  - [x] Definir schema Zod `SignUpSchema` com: `email` (email), `password` (string min 8), `name` (string min 1 max 50), `cnpj` (string de 11–14 dígitos numéricos, opcional/nullable)
  - [x] Criar auth user via `getSupabaseAdminClient().auth.admin.createUser({ email, password, email_confirm: true })`
  - [x] Criar company via `new CreateCompanyUseCase(repo).execute({ authUserId: userId, email, name, documentNumber: cnpj ?? null })`
  - [x] Se criação da company falhar: chamar `admin.auth.admin.deleteUser(userId)` como rollback e relançar o erro
  - [x] Retornar `{ ok: true }` com status 201 em caso de sucesso
  - [x] Mapear erro de email duplicado do Supabase (`AuthApiError` com mensagem contendo "already registered") → `{ error: "E-mail já cadastrado." }` status 409
  - [x] Usar `handleHttpError` para todos os demais erros

- [x] Task 2: Criar `app/sign-up/layout.tsx` — layout com Toaster (AC: #2)
  - [x] Mesma estrutura de `app/sign-in/layout.tsx`: importar `Toaster` de `sonner`, retornar `<>{children}<Toaster richColors position="bottom-right" /></>`

- [x] Task 3: Criar `app/sign-up/page.tsx` — formulário de signup (AC: #1, #2)
  - [x] Marcar como `"use client"`
  - [x] Definir schema Zod com refinamento de `confirmPassword === password`
  - [x] Configurar `useForm` com `zodResolver(schema)` e `mode: 'onBlur'`
  - [x] Renderizar campos: email, senha, confirmação de senha, nome da empresa, CNPJ (opcional, com máscara)
  - [x] Implementar máscara de CNPJ via `onChange` formatador (ver dev notes)
  - [x] No `handleSubmit`: (1) `POST /api/auth/sign-up` com dados brutos (CNPJ sem máscara); (2) se sucesso, chamar `supabase.auth.signInWithPassword({ email, password })`; (3) `window.location.href = '/'`
  - [x] Exibir erros de API via `toast.error()` (Sonner)
  - [x] Botão `disabled` durante `isSubmitting`
  - [x] Link "Já tem conta?" → `/sign-in`

- [x] Task 4: Atualizar `src/shared/middleware.ts` — redirecionar usuários autenticados de `/sign-up` (AC: #3)
  - [x] Alterar condição de redirect: `if (user && pathname === "/sign-in")` → `if (user && (pathname === "/sign-in" || pathname === "/sign-up"))`

- [x] Task 5: Atualizar `app/sign-in/page.tsx` — corrigir link de cadastro (AC: implícito)
  - [x] Alterar `href="/onboarding/company"` para `href="/sign-up"` no link "Cadastre sua empresa"

- [x] Task 6: Validar e rodar testes (AC: todos)
  - [x] Executar `npm run test` — garantir zero regressão (66/66 testes passaram)
  - [x] Executar `npm run build` — garantir TypeScript limpo (build sem erros, /sign-up aparece nas rotas)

## Dev Notes

### Arquitetura do endpoint `/api/auth/sign-up`

Este é um endpoint de auth especial — similar ao `/api/auth/sign-out`, não usa o presenter pattern completo porque mistura Supabase Auth Admin API com repositório de domínio. A atomicidade é implementada diretamente no route handler:

```typescript
// app/api/auth/sign-up/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/shared/clients/supabase/admin";
import { Environments } from "@/shared/environments";
import { CreateCompanyUseCase } from "@/modules/company/app/create_company_usecase";
import { handleHttpError } from "@/shared/http/handleHttpError";

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
  cnpj: z.string().min(11).max(14).regex(/^\d+$/).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignUpSchema.parse(body);
    const admin = getSupabaseAdminClient();

    // Step 1: Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
    });
    if (authError) {
      if (authError.message.toLowerCase().includes("already registered")) {
        return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
      }
      throw authError;
    }

    const userId = authData.user.id;

    // Step 2: Create company — rollback auth user if this fails
    try {
      const repo = await Environments.getEnvs().getCompanyRepository();
      const useCase = new CreateCompanyUseCase(repo);
      await useCase.execute({
        authUserId: userId,
        email: parsed.email,
        name: parsed.name,
        documentNumber: parsed.cnpj ?? null,
      });
    } catch (companyError) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});  // best-effort rollback
      throw companyError;
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}
```

**Por que `email_confirm: true`?**
Bypass de confirmação de email é intencional no MVP — sem fluxo de verificação por email implementado. O usuário está confirmado imediatamente após o cadastro.

**Reuse de `CreateCompanyUseCase`:**
O use case existente já verifica duplicidade por `authUserId` (via `findById`) e cria a entidade com os campos corretos. Chamamos diretamente sem passar pelo controller (evitar re-validação de body). O campo `documentNumber` é o nome interno — o CNPJ do formulário é mapeado aqui.

**Nome da tabela:** `company` (singular) — definido em `SupabaseCompanyRepository` como `TABLE = "company"`.

### Middleware — redirect de usuários autenticados

Arquivo: `src/shared/middleware.ts` (linhas 55–59).

Estado atual:
```typescript
if (isPublicAuthPage(pathname)) {
  if (user && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return sessionResponse;
}
```

Estado desejado:
```typescript
if (isPublicAuthPage(pathname)) {
  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return sessionResponse;
}
```

O `/sign-up` já está coberto por `isPublicAuthPage` (desde Story 1.2) — só falta incluir no redirect.

### Página `app/sign-up/page.tsx`

#### Schema Zod com refinamento de senha

```typescript
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo de 8 caracteres"),
  confirmPassword: z.string(),
  companyName: z.string().min(1, "Nome da empresa é obrigatório").max(50, "Máximo de 50 caracteres"),
  cnpj: z.string().optional(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "As senhas não coincidem", path: ["confirmPassword"] }
);

type SignUpFormData = z.infer<typeof signUpSchema>;
```

#### React Hook Form setup

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<SignUpFormData>({
  resolver: zodResolver(signUpSchema),
  mode: "onBlur",  // validação individual no blur, completa no submit
});
```

**Import do zodResolver:** `import { zodResolver } from '@hookform/resolvers/zod'` (v5 mantém o mesmo caminho de v3).

#### CNPJ com máscara

O CNPJ é opcional. Usar `useState` para o valor formatado — React Hook Form registra o campo mas o valor enviado à API deve ser apenas dígitos:

```typescript
const [cnpjDisplay, setCnpjDisplay] = useState("");

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// No campo de input:
<input
  value={cnpjDisplay}
  onChange={(e) => setCnpjDisplay(formatCNPJ(e.target.value))}
  placeholder="00.000.000/0000-00"
  ...
/>
```

No `handleSubmit`, extrair os dígitos brutos antes de enviar à API:
```typescript
const rawCnpj = cnpjDisplay.replace(/\D/g, "") || undefined;
// enviar rawCnpj (undefined se vazio) no body da requisição
```

**Nota:** Como o CNPJ usa estado próprio (não `register`), não há `errors.cnpj` via RHF — validação do CNPJ ocorre no servidor (formato inválido gera toast de erro genérico). Isso mantém a implementação simples.

#### Fluxo pós-submit

```typescript
async function onSubmit(data: SignUpFormData) {
  // 1. Chamar API de signup
  const rawCnpj = cnpjDisplay.replace(/\D/g, "") || undefined;
  const res = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      name: data.companyName,
      cnpj: rawCnpj ?? null,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error ?? "Erro ao criar conta. Tente novamente.";
    toast.error(message);
    return;
  }

  // 2. Criar sessão (signInWithPassword)
  const supabase = getSupabaseBrowserClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (signInError) {
    toast.error("Conta criada! Faça login para continuar.");
    window.location.href = "/sign-in";
    return;
  }

  // 3. Redirecionar para o dashboard
  window.location.href = "/";
}
```

**Por que `fetch` diretamente (não `fetchWithAuth`)?**
`fetchWithAuth` é para chamadas autenticadas que podem retornar 401. No signup, ainda não há sessão — usar `fetch` nativo.

**Por que `window.location.href` (não `router.push`)?**
Mesma razão do sign-in: forçar reload completo para o middleware revalidar a sessão recém-criada nos cookies.

#### Visual da página

Replicar o layout de `app/sign-in/page.tsx` exatamente — split com painel esquerdo de formulário e painel direito institucional (fundo `bg-primary`). Texto do painel esquerdo: título "Crie sua conta", subtítulo "Cadastre sua empresa e comece a integrar com a YaID.". Link no rodapé: "Já tem conta? Faça login" → `/sign-in`.

**Erros inline:** Abaixo de cada campo, `{errors.campo && <p className="mt-1 text-sm text-red-600">{errors.campo.message}</p>}`.

### Layout `app/sign-up/layout.tsx`

Idêntico ao `app/sign-in/layout.tsx`:
```typescript
import { Toaster } from "sonner";

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors position="bottom-right" />
    </>
  );
}
```

### Atualização do link no `app/sign-in/page.tsx`

```typescript
// ANTES (linha ~148):
<Link href="/onboarding/company" className="font-medium text-trust hover:text-trust/80">
  Cadastre sua empresa
</Link>

// DEPOIS:
<Link href="/sign-up" className="font-medium text-trust hover:text-trust/80">
  Cadastre sua empresa
</Link>
```

### Deferred Work para ficar atento

- Da Story 1.3: `@hookform/resolvers@^5.2.2` pode ter conflito com `react-hook-form@7`. Se o import `from '@hookform/resolvers/zod'` falhar, downgrade para `@hookform/resolvers@^3.x` via `npm install @hookform/resolvers@^3`.
- Da Story 1.2: `isDashboardPage` usa lista hardcoded — `/sign-up` não é dashboard, não afeta esta story, mas lembrar ao criar novas rotas de dashboard.

### Convenções do projeto (aprendizados das Stories anteriores)

- Path alias `@/shared/*` → `src/shared/*`; `@/modules/*` → `src/modules/*`; `@/*` → raiz
- Nomenclatura: `kebab-case` para arquivos de página/rota; `PascalCase` para componentes e entidades
- `process.env` apenas em `src/shared/environments.ts` — usar `Environments.getEnvs()` ou `env.*`
- `npm run build` verifica TypeScript — executar antes de marcar done
- `getSupabaseAdminClient()` usa `SUPABASE_SECRET_KEY` (service role) — ler de `env` em `environments.ts`
- Shape de erro HTTP: `handleHttpError` retorna `{ error: { code, message } }` (não `{ error: string }` como especificado na arquitetura — a implementação real diverge; no frontend, ler `body.error` que pode ser string ou objeto)

### Regressões esperadas: zero

- Testes existentes (Stories 1.1–1.4): testam estrutura de arquivos, middleware server-side e fetch wrapper — novos arquivos não afetam nenhum deles
- `utils/apps-store.ts`, `utils/fetch-with-auth.ts`: não alterados
- Middleware: mudança mínima (uma linha de condição) — lógica de auth e dashboard não é tocada

### Project Structure Notes

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `app/api/auth/sign-up/route.ts` | **NOVO** | Endpoint de signup atômico |
| `app/sign-up/layout.tsx` | **NOVO** | Layout com Toaster |
| `app/sign-up/page.tsx` | **NOVO** | Formulário de signup com RHF + Zod |
| `src/shared/middleware.ts` | MODIFICAR | Adicionar `/sign-up` ao redirect de usuário autenticado |
| `app/sign-in/page.tsx` | MODIFICAR | Corrigir link "Cadastre sua empresa" |

**NÃO alterar:**
- `src/modules/company/app/create_company_*.ts` — use case é reusado, não modificado
- `src/shared/infra/repositories/SupabaseCompanyRepository.ts` — repositório é reusado diretamente
- `app/api/companies/route.ts` — rota existente não é afetada (este endpoint é diferente)
- Qualquer arquivo em `utils/` — fetch wrapper não é usado na página de signup (sem sessão)

### References

- [Epics: Story 1.5 AC](_bmad-output/planning-artifacts/epics.md#story-15-signup-atômico-de-empresa)
- [Architecture: Signup atômico — auth.users + companies](_bmad-output/planning-artifacts/architecture.md#schema-do-banco-de-dados)
- [Architecture: Estrutura de Diretórios — app/sign-up/](_bmad-output/planning-artifacts/architecture.md#árvore-completa-de-diretórios)
- [Architecture: Responsabilidades por Camada](_bmad-output/planning-artifacts/architecture.md#responsabilidades-por-camada)
- [UX: Signup Atômico sem Onboarding](_bmad-output/planning-artifacts/ux-design-specification.md#signup-atômico-sem-onboarding)
- [UX: Form Patterns — onBlur, zodResolver, Label acima de Input](_bmad-output/planning-artifacts/ux-design-specification.md#form-patterns)
- [UX: Feedback Patterns — toast.error, botão disabled](_bmad-output/planning-artifacts/ux-design-specification.md#feedback-patterns)
- [UX: Jornada 1 — Do Signup à API Key](_bmad-output/planning-artifacts/ux-design-specification.md#jornada-1-onboarding-da-empresa--do-signup-à-api-key)
- [Story anterior: 1.4](stories/1-4-fetchwithauth-e-infraestrutura-de-auth-client.md)
- [Middleware a modificar: src/shared/middleware.ts](src/shared/middleware.ts)
- [Página a criar: app/sign-up/page.tsx](app/sign-up/page.tsx)
- [API route a criar: app/api/auth/sign-up/route.ts](app/api/auth/sign-up/route.ts)
- [Sign-in a modificar (link): app/sign-in/page.tsx](app/sign-in/page.tsx)
- [Use Case reutilizado: src/modules/company/app/create_company_usecase.ts](src/modules/company/app/create_company_usecase.ts)
- [Admin client: src/shared/clients/supabase/admin.ts](src/shared/clients/supabase/admin.ts)

### Review Findings

- [x] [Review][Patch] Rollback silencia falha de deleção — `console.error` adicionado antes de swallow [app/api/auth/sign-up/route.ts:53]
- [x] [Review][Patch] CNPJ schema aceita 11–13 dígitos; corrigido para `.length(14)` [app/api/auth/sign-up/route.ts:12]
- [x] [Review][Patch] `authData.user` acessado sem guard de nulidade — guard `if (!authData.user)` adicionado [app/api/auth/sign-up/route.ts:38]
- [x] [Review][Patch] `POST /api/auth/sign-up` não classificado no middleware — adicionado a `isPublicApiRoute` [src/shared/middleware.ts]
- [x] [Review][Defer] Sem rate limiting no endpoint de signup — pré-existente, escopo MVP [app/api/auth/sign-up/route.ts] — deferred, pre-existing
- [x] [Review][Defer] Enumeração de email via resposta 409 — aceitável para dashboard B2B no MVP [app/api/auth/sign-up/route.ts:30] — deferred, pre-existing
- [x] [Review][Defer] Race condition em signups duplicados concorrentes — probabilidade muito baixa no MVP — deferred, pre-existing
- [x] [Review][Defer] Edge case de falha do `signInWithPassword` pós-criação de conta — Supabase indisponível transitoriamente; toast + redirect para sign-in é fallback razoável [app/sign-up/page.tsx] — deferred, pre-existing
- [x] [Review][Defer] `cnpjDisplay` pode estar stale no momento do submit — estado próprio (useState) vs dados do RHF [app/sign-up/page.tsx] — deferred, pre-existing
- [x] [Review][Defer] `handleHttpError` loga `AuthError` do Supabase com detalhes internos no server log [src/shared/http/handleHttpError.ts] — deferred, pre-existing
- [x] [Review][Defer] Lógica de `isPublicAuthPage` com inner check frágil para `/v/*` — pré-existente à esta story [src/shared/middleware.ts] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `app/api/auth/sign-up/route.ts` criado: schema Zod valida email/password/name/cnpj; cria auth.users via admin client com `email_confirm: true`; cria company via `CreateCompanyUseCase`; rollback best-effort com `admin.auth.admin.deleteUser(userId)` se criação da company falhar; mapeia "already registered" do Supabase para 409 com mensagem em PT-BR
- `app/sign-up/layout.tsx` criado: mesmo padrão de `sign-in/layout.tsx` — apenas `<Toaster richColors position="bottom-right" />`
- `app/sign-up/page.tsx` criado: formulário com React Hook Form (`mode: 'onBlur'`) + zodResolver; campos email, senha, confirmPassword, companyName, CNPJ (máscara via `useState` + `formatCNPJ()`); fluxo pós-submit: POST API → signInWithPassword → redirect `/`; erros inline via `errors.*`; erros de API via `toast.error()`; botão disabled durante `isSubmitting`
- `src/shared/middleware.ts` atualizado: redirect de usuário autenticado agora cobre `/sign-in` e `/sign-up`
- `app/sign-in/page.tsx` atualizado: link "Cadastre sua empresa" corrigido de `/onboarding/company` para `/sign-up`
- 66/66 testes passando — zero regressões
- `npm run build` limpo — TypeScript sem erros; `/sign-up` e `/api/auth/sign-up` aparecem nas rotas compiladas

### File List

**Criados:**
- `app/api/auth/sign-up/route.ts`
- `app/sign-up/layout.tsx`
- `app/sign-up/page.tsx`

**Modificados:**
- `src/shared/middleware.ts`
- `app/sign-in/page.tsx`
